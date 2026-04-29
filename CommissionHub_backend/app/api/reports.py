from __future__ import annotations

import uuid
from collections import defaultdict

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import BillingEntry, CommissionEntry, Employee, Project
from app.schemas import (
    DepartmentMonthlyReport,
    DepartmentProjectBreakdown,
    EmployeeCommissionDetail,
    EmployeeMonthlyReport,
    ProjectCommissionDetail,
    ProjectDepartmentBreakdown,
    ProjectMonthlyReport,
)
from app.services import commissionable_bill, parse_month_string


router = APIRouter()


def _round_money(value: float) -> float:
    return round(float(value), 2)


def _load_month_context(db: Session, month: str) -> tuple[list[BillingEntry], dict[uuid.UUID, Project], dict[uuid.UUID, Employee]]:
    month_value = parse_month_string(month)
    billing_rows = db.scalars(select(BillingEntry).where(BillingEntry.month == month_value)).all()
    project_ids = {row.project_id for row in billing_rows}
    if project_ids:
        projects = {
            item.id: item
            for item in db.scalars(select(Project).where(Project.id.in_(project_ids)))
        }
    else:
        projects = {}
    employees = {item.id: item for item in db.scalars(select(Employee))}
    return billing_rows, projects, employees


def _load_commissions_for_billing(db: Session, billing_ids: set[uuid.UUID]) -> list[CommissionEntry]:
    if not billing_ids:
        return []
    return list(
        db.scalars(
            select(CommissionEntry)
            .where(CommissionEntry.billing_id.in_(billing_ids))
            .order_by(CommissionEntry.created_at.asc())
        )
    )


@router.get("/employee-monthly", response_model=list[EmployeeMonthlyReport])
def employee_monthly_report(
    month: str = Query(..., description="YYYY-MM"),
    employee_id: uuid.UUID | None = Query(default=None),
    db: Session = Depends(get_db),
) -> list[EmployeeMonthlyReport]:
    billing_rows, projects, employees = _load_month_context(db, month)
    billing_by_id = {row.id: row for row in billing_rows}
    commissions = _load_commissions_for_billing(db, set(billing_by_id))

    details_by_employee: dict[uuid.UUID, list[EmployeeCommissionDetail]] = defaultdict(list)

    for commission in commissions:
        bill = billing_by_id.get(commission.billing_id)
        employee = employees.get(commission.employee_id)
        if bill is None or employee is None:
            continue
        if employee_id is not None and employee.id != employee_id:
            continue

        project = projects.get(bill.project_id)
        comm_bill = commissionable_bill(bill.total_bill, bill.deduction, bill.additions, bill.deletions)
        earned = comm_bill * (float(commission.contribution_percent) / 100.0)
        details_by_employee[employee.id].append(
            EmployeeCommissionDetail(
                project_id=bill.project_id,
                project_name=project.name if project else "Unknown Project",
                department=commission.department,
                project_role=commission.project_role,
                month=month,
                contribution_percent=float(commission.contribution_percent),
                commissionable_bill=_round_money(comm_bill),
                commission_earned=_round_money(earned),
            )
        )

    reports: list[EmployeeMonthlyReport] = []
    for emp_id, detail_rows in details_by_employee.items():
        employee = employees.get(emp_id)
        if employee is None:
            continue
        total = _round_money(sum(item.commission_earned for item in detail_rows))
        reports.append(
            EmployeeMonthlyReport(
                employee_id=emp_id,
                employee_name=employee.name,
                month=month,
                total_commission=total,
                details=detail_rows,
            )
        )

    reports.sort(key=lambda item: item.total_commission, reverse=True)
    return reports


@router.get("/project-monthly", response_model=list[ProjectMonthlyReport])
def project_monthly_report(
    month: str = Query(..., description="YYYY-MM"),
    project_id: uuid.UUID | None = Query(default=None),
    db: Session = Depends(get_db),
) -> list[ProjectMonthlyReport]:
    billing_rows, projects, employees = _load_month_context(db, month)
    if project_id is not None:
        billing_rows = [row for row in billing_rows if row.project_id == project_id]

    billing_by_id = {row.id: row for row in billing_rows}
    commissions = _load_commissions_for_billing(db, set(billing_by_id))
    commissions_by_billing: dict[uuid.UUID, list[CommissionEntry]] = defaultdict(list)
    for entry in commissions:
        commissions_by_billing[entry.billing_id].append(entry)

    reports: list[ProjectMonthlyReport] = []
    for billing in billing_rows:
        comm_bill = commissionable_bill(billing.total_bill, billing.deduction, billing.additions, billing.deletions)
        detail_rows: list[ProjectCommissionDetail] = []
        dept_totals: dict[str, float] = defaultdict(float)
        dept_employees: dict[str, set[str]] = defaultdict(set)
        total_payout = 0.0

        for commission in commissions_by_billing.get(billing.id, []):
            employee = employees.get(commission.employee_id)
            employee_name = employee.name if employee else "Unknown"
            earned = comm_bill * (float(commission.contribution_percent) / 100.0)
            total_payout += earned
            dept_totals[commission.department] += earned
            dept_employees[commission.department].add(employee_name)
            detail_rows.append(
                ProjectCommissionDetail(
                    employee_id=commission.employee_id,
                    employee_name=employee_name,
                    department=commission.department,
                    project_role=commission.project_role,
                    contribution_percent=float(commission.contribution_percent),
                    commission_earned=_round_money(earned),
                )
            )

        breakdown_rows = [
            ProjectDepartmentBreakdown(
                department=department,
                total_commission=_round_money(total),
                employees=sorted(list(dept_employees[department])),
            )
            for department, total in dept_totals.items()
        ]
        breakdown_rows.sort(key=lambda row: row.total_commission, reverse=True)

        project = projects.get(billing.project_id)
        reports.append(
            ProjectMonthlyReport(
                project_id=billing.project_id,
                project_name=project.name if project else "Unknown Project",
                month=month,
                commissionable_bill=_round_money(comm_bill),
                total_payout=_round_money(total_payout),
                department_breakdown=breakdown_rows,
                details=detail_rows,
            )
        )

    reports.sort(key=lambda item: item.project_name.lower())
    return reports


@router.get("/department-monthly", response_model=list[DepartmentMonthlyReport])
def department_monthly_report(
    month: str = Query(..., description="YYYY-MM"),
    department: str | None = Query(default=None),
    db: Session = Depends(get_db),
) -> list[DepartmentMonthlyReport]:
    billing_rows, projects, employees = _load_month_context(db, month)
    billing_by_id = {row.id: row for row in billing_rows}
    commissions = _load_commissions_for_billing(db, set(billing_by_id))

    grouped: dict[str, dict] = {}
    for commission in commissions:
        if department is not None and commission.department != department:
            continue
        billing = billing_by_id.get(commission.billing_id)
        if billing is None:
            continue
        project = projects.get(billing.project_id)
        employee = employees.get(commission.employee_id)
        earned = commissionable_bill(
            billing.total_bill,
            billing.deduction,
            billing.additions,
            billing.deletions,
        ) * (float(commission.contribution_percent) / 100.0)

        if commission.department not in grouped:
            grouped[commission.department] = {
                "total": 0.0,
                "employees": set(),
                "projects": defaultdict(lambda: {"total": 0.0, "employees": set()}),
            }

        bucket = grouped[commission.department]
        employee_name = employee.name if employee else "Unknown"
        project_name = project.name if project else "Unknown Project"
        bucket["total"] += earned
        bucket["employees"].add(employee_name)
        project_bucket = bucket["projects"][billing.project_id]
        project_bucket["total"] += earned
        project_bucket["employees"].add(employee_name)
        project_bucket["name"] = project_name

    reports: list[DepartmentMonthlyReport] = []
    for dept_name, bucket in grouped.items():
        project_rows: list[DepartmentProjectBreakdown] = []
        for proj_id, proj_bucket in bucket["projects"].items():
            project_rows.append(
                DepartmentProjectBreakdown(
                    project_id=proj_id,
                    project_name=proj_bucket["name"],
                    total_commission=_round_money(proj_bucket["total"]),
                    employees=sorted(list(proj_bucket["employees"])),
                )
            )
        project_rows.sort(key=lambda row: row.total_commission, reverse=True)
        reports.append(
            DepartmentMonthlyReport(
                department=dept_name,
                month=month,
                total_commission=_round_money(bucket["total"]),
                employees=sorted(list(bucket["employees"])),
                projects=project_rows,
            )
        )

    reports.sort(key=lambda row: row.total_commission, reverse=True)
    return reports
