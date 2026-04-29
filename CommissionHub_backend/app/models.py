import enum
import uuid
from datetime import date, datetime

from sqlalchemy import Column, Date, DateTime, Enum, Float, ForeignKey, Numeric, String, Table, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class EmployeeStatus(str, enum.Enum):
    ACTIVE = "Active"
    PAUSED = "Paused"
    ON_LEAVE = "On Leave"
    RESIGNED = "Resigned"
    TERMINATED = "Terminated"
    DELETED = "Deleted"


class ProjectStatus(str, enum.Enum):
    ACTIVE = "Active"
    PAUSED = "Paused"
    DELETED = "Deleted"


class AuditEntityType(str, enum.Enum):
    EMPLOYEE = "employee"
    PROJECT = "project"


class AuditAction(str, enum.Enum):
    PAUSE = "pause"
    UNPAUSE = "unpause"
    SOFT_DELETE = "soft-delete"
    RESTORE = "restore"
    HARD_DELETE = "hard-delete"
    STATUS_CHANGE = "status-change"


class AuthUserStatus(str, enum.Enum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"


employee_department_link = Table(
    "employee_department_link",
    Base.metadata,
    Column("employee_id", UUID(as_uuid=True), ForeignKey("employees.id", ondelete="CASCADE"), primary_key=True),
    Column("department_id", UUID(as_uuid=True), ForeignKey("departments.id", ondelete="CASCADE"), primary_key=True),
)


class Employee(Base):
    __tablename__ = "employees"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    phone_number: Mapped[str | None] = mapped_column(String(11), nullable=True)
    department: Mapped[str] = mapped_column(String(100), nullable=False)
    managers: Mapped[list[str] | None] = mapped_column(JSONB, nullable=True)
    designation: Mapped[str] = mapped_column(String(150), nullable=False)
    salary: Mapped[float] = mapped_column(Numeric(14, 2), nullable=False, default=0)
    allowances: Mapped[float] = mapped_column(Numeric(14, 2), nullable=False, default=0)
    bank: Mapped[str] = mapped_column(String(120), nullable=False)
    bank_account_number: Mapped[str | None] = mapped_column(String(16), nullable=True)

    status: Mapped[EmployeeStatus] = mapped_column(Enum(EmployeeStatus), default=EmployeeStatus.ACTIVE, nullable=False)
    status_changed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    status_reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    paused_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    deleted_by: Mapped[str | None] = mapped_column(String(120), nullable=True)
    audit_notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    commissions: Mapped[list["CommissionEntry"]] = relationship(back_populates="employee")
    departments_rel: Mapped[list["Department"]] = relationship(
        secondary=employee_department_link,
        back_populates="employees",
    )

    @property
    def departments(self) -> list[str]:
        return [department.name for department in self.departments_rel]


class Department(Base):
    __tablename__ = "departments"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(120), unique=True, nullable=False, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)

    employees: Mapped[list[Employee]] = relationship(
        secondary=employee_department_link,
        back_populates="departments_rel",
    )


class Project(Base):
    __tablename__ = "projects"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(200), unique=True, nullable=False)
    client_name: Mapped[str | None] = mapped_column(String(200), nullable=True)

    status: Mapped[ProjectStatus] = mapped_column(Enum(ProjectStatus), default=ProjectStatus.ACTIVE, nullable=False)
    status_changed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    status_reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    paused_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    deleted_by: Mapped[str | None] = mapped_column(String(120), nullable=True)
    audit_notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    billing_entries: Mapped[list["BillingEntry"]] = relationship(back_populates="project")


class BillingEntry(Base):
    __tablename__ = "billing_entries"
    __table_args__ = (UniqueConstraint("project_id", "month", name="uq_billing_project_month"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    project_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    month: Mapped[date] = mapped_column(Date, nullable=False)
    total_bill: Mapped[float] = mapped_column(Numeric(14, 2), nullable=False)
    deduction: Mapped[float] = mapped_column(Numeric(14, 2), nullable=False, default=0)
    additions: Mapped[float] = mapped_column(Numeric(14, 2), nullable=False, default=0)
    deletions: Mapped[float] = mapped_column(Numeric(14, 2), nullable=False, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)

    project: Mapped["Project"] = relationship(back_populates="billing_entries")
    commissions: Mapped[list["CommissionEntry"]] = relationship(back_populates="billing_entry")


class CommissionEntry(Base):
    __tablename__ = "commissions"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    billing_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("billing_entries.id", ondelete="CASCADE"), nullable=False)
    employee_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("employees.id", ondelete="CASCADE"), nullable=False)
    department: Mapped[str] = mapped_column(String(120), nullable=False)
    project_role: Mapped[str] = mapped_column(String(120), nullable=False)
    contribution_percent: Mapped[float] = mapped_column(Float, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)

    billing_entry: Mapped["BillingEntry"] = relationship(back_populates="commissions")
    employee: Mapped["Employee"] = relationship(back_populates="commissions")


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    entity_type: Mapped[AuditEntityType] = mapped_column(Enum(AuditEntityType), nullable=False)
    entity_id: Mapped[str] = mapped_column(String(64), nullable=False)
    action: Mapped[AuditAction] = mapped_column(Enum(AuditAction), nullable=False)
    reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    user_id: Mapped[str | None] = mapped_column(String(120), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)


class AuthUser(Base):
    __tablename__ = "auth_users"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    status: Mapped[AuthUserStatus] = mapped_column(Enum(AuthUserStatus), default=AuthUserStatus.PENDING, nullable=False)
    is_admin: Mapped[bool] = mapped_column(default=False, nullable=False)
    approved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)


class Admin(Base):
    __tablename__ = "admins"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    is_superadmin: Mapped[bool] = mapped_column(default=False, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
