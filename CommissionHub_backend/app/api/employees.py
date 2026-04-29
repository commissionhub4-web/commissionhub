from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.constants import COMMISSION_DEPARTMENTS, COMMISSION_DEPARTMENT_SET
from app.database import get_db
from app.models import AuditAction, AuditEntityType, Department, Employee, EmployeeStatus
from app.schemas import (
    AdminLifecyclePayload,
    EmployeeCreate,
    EmployeeRead,
    EmployeeStatusPayload,
    EmployeeUpdate,
    HardDeletePayload,
    LifecyclePayload,
)
from app.services import add_audit_log, apply_employee_lifecycle, apply_employee_status_change


router = APIRouter()


def normalize_email(email: str) -> str:
    return email.strip().lower()


def get_employee_or_404(db: Session, employee_id: uuid.UUID) -> Employee:
    employee = db.scalar(select(Employee).where(Employee.id == employee_id))
    if employee is None:
        raise HTTPException(status_code=404, detail="Employee not found")
    return employee


def ensure_unique_employee_email(db: Session, email: str, exclude_employee_id: uuid.UUID | None = None) -> None:
    query = select(Employee).where(func.lower(Employee.email) == normalize_email(email))
    existing = db.scalar(query)
    if existing is None:
        return
    if exclude_employee_id is not None and existing.id == exclude_employee_id:
        return
    raise HTTPException(status_code=409, detail="Employee with this email already exists")


def resolve_departments(db: Session, names: list[str]) -> list[Department]:
    normalized_names: list[str] = []
    for name in names:
        value = name.strip()
        if not value:
            continue
        if value not in COMMISSION_DEPARTMENT_SET:
            raise HTTPException(status_code=422, detail=f"Department '{value}' is not allowed")
        if value not in normalized_names:
            normalized_names.append(value)

    if not normalized_names:
        raise HTTPException(status_code=422, detail="At least one department is required")

    existing_rows = db.scalars(select(Department).where(Department.name.in_(normalized_names))).all()
    existing_by_name = {row.name: row for row in existing_rows}

    departments: list[Department] = []
    for name in normalized_names:
        department = existing_by_name.get(name)
        if department is None:
            department = Department(name=name)
            db.add(department)
            db.flush()
            existing_by_name[name] = department
        departments.append(department)

    return departments


@router.get("/departments", response_model=list[str])
def list_allowed_departments() -> list[str]:
    return list(COMMISSION_DEPARTMENTS)


@router.get("", response_model=list[EmployeeRead])
def list_employees(include_inactive: bool = Query(default=False), db: Session = Depends(get_db)) -> list[Employee]:
    query = select(Employee)
    if not include_inactive:
        query = query.where(Employee.status == EmployeeStatus.ACTIVE)
    return list(db.scalars(query.order_by(Employee.created_at.desc())).all())


@router.post("", response_model=EmployeeRead)
def create_employee(payload: EmployeeCreate, db: Session = Depends(get_db)) -> Employee:
    ensure_unique_employee_email(db, payload.email)
    department_rows = resolve_departments(db, payload.departments)

    employee = Employee(
        name=payload.name.strip(),
        email=normalize_email(payload.email),
        phone_number=payload.phone_number.strip(),
        department=department_rows[0].name,
        managers=payload.managers,
        designation=payload.designation.strip(),
        salary=payload.salary,
        allowances=payload.allowances,
        bank=payload.bank.strip(),
        bank_account_number=payload.bank_account_number.strip(),
    )
    employee.departments_rel = department_rows
    db.add(employee)
    db.commit()
    db.refresh(employee)
    return employee


@router.put("/{employee_id}", response_model=EmployeeRead)
def update_employee(employee_id: uuid.UUID, payload: EmployeeUpdate, db: Session = Depends(get_db)) -> Employee:
    employee = get_employee_or_404(db, employee_id)
    ensure_unique_employee_email(db, payload.email, exclude_employee_id=employee_id)
    department_rows = resolve_departments(db, payload.departments)

    employee.name = payload.name.strip()
    employee.email = normalize_email(payload.email)
    employee.phone_number = payload.phone_number.strip()
    employee.department = department_rows[0].name
    employee.departments_rel = department_rows
    employee.managers = payload.managers
    employee.designation = payload.designation.strip()
    employee.salary = payload.salary
    employee.allowances = payload.allowances
    employee.bank = payload.bank.strip()
    employee.bank_account_number = payload.bank_account_number.strip()

    db.commit()
    db.refresh(employee)
    return employee


@router.post("/{employee_id}/pause", response_model=EmployeeRead)
def pause_employee(employee_id: uuid.UUID, payload: LifecyclePayload, db: Session = Depends(get_db)) -> Employee:
    employee = get_employee_or_404(db, employee_id)
    apply_employee_lifecycle(
        db,
        employee,
        AuditAction.PAUSE,
        reason=payload.reason,
        user_id=payload.user_id,
        notes=payload.audit_notes,
    )
    db.commit()
    db.refresh(employee)
    return employee


@router.post("/{employee_id}/unpause", response_model=EmployeeRead)
def unpause_employee(employee_id: uuid.UUID, payload: LifecyclePayload, db: Session = Depends(get_db)) -> Employee:
    employee = get_employee_or_404(db, employee_id)
    apply_employee_lifecycle(
        db,
        employee,
        AuditAction.UNPAUSE,
        reason=payload.reason,
        user_id=payload.user_id,
        notes=payload.audit_notes,
    )
    db.commit()
    db.refresh(employee)
    return employee


@router.post("/{employee_id}/delete", response_model=EmployeeRead)
def soft_delete_employee(employee_id: uuid.UUID, payload: LifecyclePayload, db: Session = Depends(get_db)) -> Employee:
    employee = get_employee_or_404(db, employee_id)
    apply_employee_lifecycle(
        db,
        employee,
        AuditAction.SOFT_DELETE,
        reason=payload.reason,
        user_id=payload.user_id,
        notes=payload.audit_notes,
    )
    db.commit()
    db.refresh(employee)
    return employee


@router.post("/{employee_id}/restore", response_model=EmployeeRead)
def restore_employee(employee_id: uuid.UUID, payload: AdminLifecyclePayload, db: Session = Depends(get_db)) -> Employee:
    if not payload.is_admin:
        raise HTTPException(status_code=403, detail="Only admin can restore deleted employees")
    employee = get_employee_or_404(db, employee_id)
    apply_employee_lifecycle(
        db,
        employee,
        AuditAction.RESTORE,
        reason=payload.reason,
        user_id=payload.user_id,
        notes=payload.audit_notes,
    )
    db.commit()
    db.refresh(employee)
    return employee


@router.post("/{employee_id}/status", response_model=EmployeeRead)
def change_employee_status(employee_id: uuid.UUID, payload: EmployeeStatusPayload, db: Session = Depends(get_db)) -> Employee:
    employee = get_employee_or_404(db, employee_id)
    apply_employee_status_change(
        db,
        employee,
        status=payload.status,
        reason=payload.reason,
        user_id=payload.user_id,
        notes=payload.audit_notes,
    )
    db.commit()
    db.refresh(employee)
    return employee


@router.post("/{employee_id}/hard-delete")
def hard_delete_employee(employee_id: uuid.UUID, payload: HardDeletePayload, db: Session = Depends(get_db)) -> dict[str, bool]:
    if not payload.is_admin:
        raise HTTPException(status_code=403, detail="Only admin can hard delete employees")
    if not payload.confirm:
        raise HTTPException(status_code=400, detail="Hard delete requires explicit confirmation")

    employee = get_employee_or_404(db, employee_id)
    add_audit_log(
        db,
        entity_type=AuditEntityType.EMPLOYEE,
        entity_id=str(employee.id),
        action=AuditAction.HARD_DELETE,
        reason=payload.reason,
        user_id=payload.user_id,
        notes=payload.audit_notes,
    )
    db.flush()
    db.delete(employee)
    db.commit()
    return {"ok": True}
