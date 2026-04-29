from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import AuditLog
from ..schemas import AuditRead


router = APIRouter()


@router.get("", response_model=list[AuditRead])
def list_audit_logs(db: Session = Depends(get_db)) -> list[AuditLog]:
    return list(db.scalars(select(AuditLog).order_by(AuditLog.created_at.desc())).all())
