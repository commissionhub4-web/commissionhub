from __future__ import annotations

import uuid
from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.constants import month_floor
from app.database import get_db
from app.models import BillingEntry, CommissionEntry, Project
from app.schemas import BillingContextResponse, BillingCreate, BillingRead, CommissionRead, ProjectRead
from app.services import commissionable_bill, is_active_for_month


router = APIRouter()


def get_project_or_404(db: Session, project_id: uuid.UUID) -> Project:
    project = db.scalar(select(Project).where(Project.id == project_id))
    if project is None:
        raise HTTPException(status_code=404, detail="Project not found")
    return project


def get_billing_by_id_or_404(db: Session, billing_id: uuid.UUID) -> BillingEntry:
    billing = db.scalar(select(BillingEntry).where(BillingEntry.id == billing_id))
    if billing is None:
        raise HTTPException(status_code=404, detail="Billing entry not found")
    return billing


def serialize_billing(billing: BillingEntry) -> BillingRead:
    return BillingRead(
        id=billing.id,
        project_id=billing.project_id,
        month=billing.month,
        total_bill=float(billing.total_bill),
        deduction=float(billing.deduction),
        additions=float(billing.additions),
        deletions=float(billing.deletions),
        commissionable_bill=commissionable_bill(billing.total_bill, billing.deduction, billing.additions, billing.deletions),
    )


def serialize_commission(entry: CommissionEntry) -> CommissionRead:
    return CommissionRead(
        id=entry.id,
        billing_id=entry.billing_id,
        employee_id=entry.employee_id,
        department=entry.department,
        project_role=entry.project_role,
        contribution_percent=float(entry.contribution_percent),
    )


@router.get("", response_model=list[BillingRead])
def list_billing(db: Session = Depends(get_db)) -> list[BillingRead]:
    rows = db.scalars(select(BillingEntry).order_by(BillingEntry.month.desc(), BillingEntry.created_at.desc())).all()
    return [serialize_billing(row) for row in rows]


@router.get("/context", response_model=BillingContextResponse)
def get_billing_context(
    project_id: uuid.UUID = Query(...),
    month: str = Query(..., description="YYYY-MM"),
    db: Session = Depends(get_db),
) -> BillingContextResponse:
    try:
        month_value = month_floor(date.fromisoformat(f"{month}-01"))
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="month must be in YYYY-MM format") from exc
    project = get_project_or_404(db, project_id)
    billing = db.scalar(
        select(BillingEntry).where(BillingEntry.project_id == project_id, BillingEntry.month == month_value)
    )

    if billing is None:
        return BillingContextResponse(
            project=ProjectRead.model_validate(project),
            month=month,
            billing=None,
            commissionable_bill=0,
            commissions=[],
        )

    commissions = db.scalars(
        select(CommissionEntry).where(CommissionEntry.billing_id == billing.id).order_by(CommissionEntry.created_at.asc())
    ).all()

    return BillingContextResponse(
        project=ProjectRead.model_validate(project),
        month=month,
        billing=serialize_billing(billing),
        commissionable_bill=commissionable_bill(billing.total_bill, billing.deduction, billing.additions, billing.deletions),
        commissions=[serialize_commission(item) for item in commissions],
    )


@router.post("", response_model=BillingRead)
def create_or_update_billing(payload: BillingCreate, db: Session = Depends(get_db)) -> BillingRead:
    month_value = month_floor(payload.month)
    project = get_project_or_404(db, payload.project_id)
    if not is_active_for_month(project.status, project.status_changed_at, month_value):
        raise HTTPException(status_code=400, detail="Project is not eligible for this billing month")

    billing = db.scalar(
        select(BillingEntry).where(BillingEntry.project_id == payload.project_id, BillingEntry.month == month_value)
    )
    if billing is None:
        billing = BillingEntry(
            project_id=payload.project_id,
            month=month_value,
            total_bill=payload.total_bill,
            deduction=payload.deduction,
            additions=payload.additions,
            deletions=payload.deletions,
        )
        db.add(billing)
    else:
        billing.total_bill = payload.total_bill
        billing.deduction = payload.deduction
        billing.additions = payload.additions
        billing.deletions = payload.deletions

    db.commit()
    db.refresh(billing)
    return serialize_billing(billing)


@router.put("/{billing_id}", response_model=BillingRead)
def update_billing(billing_id: uuid.UUID, payload: BillingCreate, db: Session = Depends(get_db)) -> BillingRead:
    month_value = month_floor(payload.month)
    project = get_project_or_404(db, payload.project_id)
    if not is_active_for_month(project.status, project.status_changed_at, month_value):
        raise HTTPException(status_code=400, detail="Project is not eligible for this billing month")

    billing = get_billing_by_id_or_404(db, billing_id)
    duplicate = db.scalar(
        select(BillingEntry).where(
            BillingEntry.project_id == payload.project_id,
            BillingEntry.month == month_value,
            BillingEntry.id != billing_id,
        )
    )
    if duplicate is not None:
        raise HTTPException(status_code=409, detail="A billing entry for this project and month already exists")

    billing.project_id = payload.project_id
    billing.month = month_value
    billing.total_bill = payload.total_bill
    billing.deduction = payload.deduction
    billing.additions = payload.additions
    billing.deletions = payload.deletions
    db.commit()
    db.refresh(billing)
    return serialize_billing(billing)
