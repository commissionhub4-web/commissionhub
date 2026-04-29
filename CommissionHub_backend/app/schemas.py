import uuid
from datetime import date, datetime

from pydantic import BaseModel, Field

from app.models import AuditAction, AuditEntityType, AuthUserStatus, EmployeeStatus, ProjectStatus


class LifecyclePayload(BaseModel):
    reason: str | None = None
    user_id: str | None = None
    audit_notes: str | None = None


class AdminLifecyclePayload(LifecyclePayload):
    is_admin: bool = False


class HardDeletePayload(LifecyclePayload):
    is_admin: bool = False
    confirm: bool = False


class EmployeeStatusPayload(LifecyclePayload):
    status: EmployeeStatus


class EmployeeBase(BaseModel):
    name: str
    email: str = Field(min_length=5, max_length=255)
    phone_number: str = Field(min_length=7, max_length=11, pattern=r"^\d+$")
    managers: list[str] | None = None
    designation: str
    salary: float = 0
    allowances: float = 0
    bank: str
    bank_account_number: str = Field(min_length=6, max_length=16)


class EmployeeCreate(EmployeeBase):
    departments: list[str] = Field(min_length=1)


class EmployeeUpdate(EmployeeBase):
    departments: list[str] = Field(min_length=1)


class EmployeeRead(EmployeeBase):
    id: uuid.UUID
    department: str
    departments: list[str] = Field(default_factory=list)
    email: str | None = None
    phone_number: str | None = None
    status: EmployeeStatus
    status_changed_at: datetime | None = None
    status_reason: str | None = None
    bank_account_number: str | None = None
    paused_at: datetime | None = None
    deleted_at: datetime | None = None
    deleted_by: str | None = None
    audit_notes: str | None = None

    class Config:
        from_attributes = True


class ProjectCreate(BaseModel):
    name: str
    client_name: str | None = None


class ProjectRead(BaseModel):
    id: uuid.UUID
    name: str
    client_name: str | None = None
    status: ProjectStatus
    status_changed_at: datetime | None = None
    status_reason: str | None = None
    paused_at: datetime | None = None
    deleted_at: datetime | None = None
    deleted_by: str | None = None
    audit_notes: str | None = None

    class Config:
        from_attributes = True


class BillingCreate(BaseModel):
    project_id: uuid.UUID
    month: date = Field(description="Use first day of month, e.g. 2025-11-01")
    total_bill: float
    deduction: float = 0
    additions: float = 0
    deletions: float = 0


class BillingRead(BillingCreate):
    id: uuid.UUID
    commissionable_bill: float | None = None

    class Config:
        from_attributes = True


class CommissionCreate(BaseModel):
    billing_id: uuid.UUID
    employee_id: uuid.UUID
    department: str
    project_role: str
    contribution_percent: float = Field(gt=0, le=100)


class CommissionRead(CommissionCreate):
    id: uuid.UUID

    class Config:
        from_attributes = True


class EligibleResponse(BaseModel):
    month: str
    employees: list[EmployeeRead]
    projects: list[ProjectRead]


class BillingContextResponse(BaseModel):
    project: ProjectRead
    month: str
    billing: BillingRead | None = None
    commissionable_bill: float = 0
    commissions: list[CommissionRead] = Field(default_factory=list)


class EmployeeCommissionDetail(BaseModel):
    project_id: uuid.UUID
    project_name: str
    department: str
    project_role: str
    month: str
    contribution_percent: float
    commissionable_bill: float
    commission_earned: float


class EmployeeMonthlyReport(BaseModel):
    employee_id: uuid.UUID
    employee_name: str
    month: str
    total_commission: float
    details: list[EmployeeCommissionDetail] = Field(default_factory=list)


class ProjectCommissionDetail(BaseModel):
    employee_id: uuid.UUID
    employee_name: str
    department: str
    project_role: str
    contribution_percent: float
    commission_earned: float


class ProjectDepartmentBreakdown(BaseModel):
    department: str
    total_commission: float
    employees: list[str] = Field(default_factory=list)


class ProjectMonthlyReport(BaseModel):
    project_id: uuid.UUID
    project_name: str
    month: str
    commissionable_bill: float
    total_payout: float
    department_breakdown: list[ProjectDepartmentBreakdown] = Field(default_factory=list)
    details: list[ProjectCommissionDetail] = Field(default_factory=list)


class DepartmentProjectBreakdown(BaseModel):
    project_id: uuid.UUID
    project_name: str
    total_commission: float
    employees: list[str] = Field(default_factory=list)


class DepartmentMonthlyReport(BaseModel):
    department: str
    month: str
    total_commission: float
    employees: list[str] = Field(default_factory=list)
    projects: list[DepartmentProjectBreakdown] = Field(default_factory=list)


class AuditRead(BaseModel):
    id: uuid.UUID
    entity_type: AuditEntityType
    entity_id: str
    action: AuditAction
    reason: str | None = None
    user_id: str | None = None
    notes: str | None = None
    created_at: datetime

    class Config:
        from_attributes = True


class AuthSignupRequest(BaseModel):
    email: str
    password: str = Field(min_length=6)
    name: str = Field(min_length=2)


class AuthLoginRequest(BaseModel):
    email: str
    password: str


class AuthSendResetCodeRequest(BaseModel):
    email: str
    code: str = Field(min_length=4, max_length=20)


class AuthUserRead(BaseModel):
    id: uuid.UUID
    email: str
    name: str
    status: AuthUserStatus
    is_admin: bool
    created_at: datetime
    approved_at: datetime | None = None

    class Config:
        from_attributes = True


class AuthResult(BaseModel):
    success: bool
    message: str
    user: AuthUserRead | None = None


class AuthUserActionResponse(BaseModel):
    ok: bool
    user: AuthUserRead
