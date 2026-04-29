from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import BillingEntry, CommissionEntry, Employee, Project
from app.schemas import CommissionCreate, CommissionRead, EligibleResponse
from app.services import enforce_contribution_cap, is_active_for_month, parse_month_string, validate_commission_department


router = APIRouter()


@router.get("", response_model=list[CommissionRead])
def list_commissions(db: Session = Depends(get_db)) -> list[CommissionEntry]:
    return list(db.scalars(select(CommissionEntry).order_by(CommissionEntry.created_at.desc())).all())


@router.post("", response_model=CommissionRead)
def create_commission(payload: CommissionCreate, db: Session = Depends(get_db)) -> CommissionEntry:
    billing = db.scalar(select(BillingEntry).where(BillingEntry.id == payload.billing_id))
    if billing is None:
        raise HTTPException(status_code=404, detail="Billing entry not found")

    employee = db.scalar(select(Employee).where(Employee.id == payload.employee_id))
    if employee is None:
        raise HTTPException(status_code=404, detail="Employee not found")

    project = db.scalar(select(Project).where(Project.id == billing.project_id))
    if project is None:
        raise HTTPException(status_code=404, detail="Project not found")

    if not is_active_for_month(employee.status, employee.status_changed_at, billing.month):
        raise HTTPException(status_code=400, detail="Employee is not eligible for the selected month")

    if not is_active_for_month(project.status, project.status_changed_at, billing.month):
        raise HTTPException(status_code=400, detail="Project is not eligible for the selected month")

    validate_commission_department(payload.department)
    enforce_contribution_cap(db, payload.billing_id, payload.contribution_percent)

    commission = CommissionEntry(
        billing_id=payload.billing_id,
        employee_id=payload.employee_id,
        department=payload.department.strip(),
        project_role=payload.project_role.strip(),
        contribution_percent=payload.contribution_percent,
    )
    db.add(commission)
    db.commit()
    db.refresh(commission)
    return commission


@router.get("/eligible", response_model=EligibleResponse)
def eligible_entities(month: str = Query(..., description="YYYY-MM"), db: Session = Depends(get_db)) -> EligibleResponse:
    month_value = parse_month_string(month)
    employees = [
        employee
        for employee in db.scalars(select(Employee)).all()
        if is_active_for_month(employee.status, employee.status_changed_at, month_value)
    ]
    projects = [
        project
        for project in db.scalars(select(Project)).all()
        if is_active_for_month(project.status, project.status_changed_at, month_value)
    ]
    return EligibleResponse(month=month, employees=employees, projects=projects)
