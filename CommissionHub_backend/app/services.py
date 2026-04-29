from __future__ import annotations

from datetime import date, datetime

from fastapi import HTTPException
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.constants import COMMISSION_DEPARTMENT_SET, month_floor
from app.models import (
    AuditAction,
    AuditEntityType,
    AuditLog,
    BillingEntry,
    CommissionEntry,
    Employee,
    EmployeeStatus,
    Project,
    ProjectStatus,
)


def parse_month_string(value: str) -> date:
    try:
        year, month = value.split("-")
        return date(int(year), int(month), 1)
    except Exception as exc:
        raise HTTPException(status_code=400, detail="month must be in YYYY-MM format") from exc


def status_month(status_changed_at: datetime | None) -> date | None:
    if not status_changed_at:
        return None
    return date(status_changed_at.year, status_changed_at.month, 1)


def is_active_for_month(status: EmployeeStatus | ProjectStatus, status_changed_at: datetime | None, month_value: date) -> bool:
    if status == EmployeeStatus.ACTIVE or status == ProjectStatus.ACTIVE:
        return True

    changed_month = status_month(status_changed_at)
    if changed_month is None:
        return False

    # Lifecycle actions affect future months, but must preserve current/historical month eligibility.
    return month_floor(month_value) <= changed_month


def commissionable_bill(total_bill: float, deduction: float, additions: float, deletions: float) -> float:
    return float(total_bill) - float(deduction) + (float(additions) - float(deletions))


def validate_commission_department(department: str) -> str:
    normalized = department.strip()
    if not normalized:
        raise HTTPException(status_code=422, detail="Department is required")
    if normalized not in COMMISSION_DEPARTMENT_SET:
        raise HTTPException(status_code=422, detail="Department is not allowed for commission allocation")
    return normalized


def add_audit_log(
    db: Session,
    *,
    entity_type: AuditEntityType,
    entity_id: str,
    action: AuditAction,
    reason: str | None = None,
    user_id: str | None = None,
    notes: str | None = None,
) -> None:
    db.add(
        AuditLog(
            entity_type=entity_type,
            entity_id=entity_id,
            action=action,
            reason=reason,
            user_id=user_id,
            notes=notes,
        )
    )


def _set_deleted_state(target, *, user_id: str | None) -> None:
    target.deleted_at = datetime.utcnow()
    target.deleted_by = user_id


def _clear_deleted_state(target) -> None:
    target.deleted_at = None
    target.deleted_by = None


def _set_lifecycle_fields(target, *, reason: str | None, notes: str | None) -> None:
    now = datetime.utcnow()
    target.status_changed_at = now
    target.status_reason = reason
    target.audit_notes = notes


def apply_employee_lifecycle(
    db: Session,
    employee: Employee,
    action: AuditAction,
    reason: str | None = None,
    user_id: str | None = None,
    notes: str | None = None,
) -> Employee:
    if action == AuditAction.PAUSE:
        employee.status = EmployeeStatus.PAUSED
        employee.paused_at = datetime.utcnow()
    elif action == AuditAction.UNPAUSE:
        employee.status = EmployeeStatus.ACTIVE
        employee.paused_at = None
    elif action == AuditAction.SOFT_DELETE:
        employee.status = EmployeeStatus.DELETED
        employee.paused_at = None
        _set_deleted_state(employee, user_id=user_id)
    elif action == AuditAction.RESTORE:
        employee.status = EmployeeStatus.ACTIVE
        employee.paused_at = None
        _clear_deleted_state(employee)
    else:
        raise HTTPException(status_code=400, detail="Unsupported lifecycle action")

    _set_lifecycle_fields(employee, reason=reason, notes=notes)
    add_audit_log(
        db,
        entity_type=AuditEntityType.EMPLOYEE,
        entity_id=str(employee.id),
        action=action,
        reason=reason,
        user_id=user_id,
        notes=notes,
    )
    return employee


def apply_employee_status_change(
    db: Session,
    employee: Employee,
    *,
    status: EmployeeStatus,
    reason: str | None = None,
    user_id: str | None = None,
    notes: str | None = None,
) -> Employee:
    if status in {EmployeeStatus.DELETED, EmployeeStatus.PAUSED}:
        raise HTTPException(status_code=422, detail="Use dedicated lifecycle endpoints for Paused/Deleted statuses")

    employee.status = status
    if status == EmployeeStatus.ACTIVE:
        employee.paused_at = None
        _clear_deleted_state(employee)
    _set_lifecycle_fields(employee, reason=reason, notes=notes)

    add_audit_log(
        db,
        entity_type=AuditEntityType.EMPLOYEE,
        entity_id=str(employee.id),
        action=AuditAction.STATUS_CHANGE,
        reason=reason,
        user_id=user_id,
        notes=f"status={status.value}" if notes is None else f"status={status.value}; {notes}",
    )
    return employee


def apply_project_lifecycle(
    db: Session,
    project: Project,
    action: AuditAction,
    reason: str | None = None,
    user_id: str | None = None,
    notes: str | None = None,
) -> Project:
    if action == AuditAction.PAUSE:
        project.status = ProjectStatus.PAUSED
        project.paused_at = datetime.utcnow()
    elif action == AuditAction.UNPAUSE:
        project.status = ProjectStatus.ACTIVE
        project.paused_at = None
    elif action == AuditAction.SOFT_DELETE:
        project.status = ProjectStatus.DELETED
        project.paused_at = None
        _set_deleted_state(project, user_id=user_id)
    elif action == AuditAction.RESTORE:
        project.status = ProjectStatus.ACTIVE
        project.paused_at = None
        _clear_deleted_state(project)
    else:
        raise HTTPException(status_code=400, detail="Unsupported lifecycle action")

    _set_lifecycle_fields(project, reason=reason, notes=notes)
    add_audit_log(
        db,
        entity_type=AuditEntityType.PROJECT,
        entity_id=str(project.id),
        action=action,
        reason=reason,
        user_id=user_id,
        notes=notes,
    )
    return project


def ensure_commission_safe(db: Session, billing_entry: BillingEntry, employee: Employee) -> None:
    if not is_active_for_month(employee.status, employee.status_changed_at, billing_entry.month):
        raise HTTPException(status_code=400, detail="Employee is not eligible for the selected month")

    project = db.scalar(select(Project).where(Project.id == billing_entry.project_id))
    if project is None:
        raise HTTPException(status_code=404, detail="Project not found")

    if not is_active_for_month(project.status, project.status_changed_at, billing_entry.month):
        raise HTTPException(status_code=400, detail="Project is not eligible for the selected month")


def enforce_contribution_cap(db: Session, billing_id, new_percent: float) -> None:
    existing_sum = db.scalar(
        select(func.coalesce(func.sum(CommissionEntry.contribution_percent), 0.0)).where(CommissionEntry.billing_id == billing_id)
    )
    if float(existing_sum) + float(new_percent) > 100:
        raise HTTPException(status_code=400, detail="Total contribution exceeds 100%")
