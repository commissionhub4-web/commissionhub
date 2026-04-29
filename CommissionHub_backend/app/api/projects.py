from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import AuditAction, AuditEntityType, Project, ProjectStatus
from app.schemas import AdminLifecyclePayload, HardDeletePayload, LifecyclePayload, ProjectCreate, ProjectRead
from app.services import add_audit_log, apply_project_lifecycle


router = APIRouter()


def normalize_project_name(name: str) -> str:
    return name.strip()


def get_project_or_404(db: Session, project_id: uuid.UUID) -> Project:
    project = db.scalar(select(Project).where(Project.id == project_id))
    if project is None:
        raise HTTPException(status_code=404, detail="Project not found")
    return project


def ensure_unique_project_name(db: Session, name: str, *, exclude_project_id: uuid.UUID | None = None) -> None:
    query = select(Project).where(func.lower(Project.name) == normalize_project_name(name).lower())
    existing = db.scalar(query)
    if existing is None:
        return
    if exclude_project_id is not None and existing.id == exclude_project_id:
        return
    raise HTTPException(status_code=409, detail="Project with this name already exists")


@router.get("", response_model=list[ProjectRead])
def list_projects(include_inactive: bool = Query(default=False), db: Session = Depends(get_db)) -> list[Project]:
    query = select(Project)
    if not include_inactive:
        query = query.where(Project.status == ProjectStatus.ACTIVE)
    return list(db.scalars(query.order_by(Project.created_at.desc())).all())


@router.post("", response_model=ProjectRead)
def create_project(payload: ProjectCreate, db: Session = Depends(get_db)) -> Project:
    project_name = normalize_project_name(payload.name)
    if not project_name:
        raise HTTPException(status_code=422, detail="Project name is required")
    ensure_unique_project_name(db, project_name)

    project = Project(name=project_name, client_name=payload.client_name.strip() if payload.client_name else None)
    db.add(project)
    db.commit()
    db.refresh(project)
    return project


@router.post("/{project_id}/pause", response_model=ProjectRead)
def pause_project(project_id: uuid.UUID, payload: LifecyclePayload, db: Session = Depends(get_db)) -> Project:
    project = get_project_or_404(db, project_id)
    apply_project_lifecycle(
        db,
        project,
        AuditAction.PAUSE,
        reason=payload.reason,
        user_id=payload.user_id,
        notes=payload.audit_notes,
    )
    db.commit()
    db.refresh(project)
    return project


@router.post("/{project_id}/unpause", response_model=ProjectRead)
def unpause_project(project_id: uuid.UUID, payload: LifecyclePayload, db: Session = Depends(get_db)) -> Project:
    project = get_project_or_404(db, project_id)
    apply_project_lifecycle(
        db,
        project,
        AuditAction.UNPAUSE,
        reason=payload.reason,
        user_id=payload.user_id,
        notes=payload.audit_notes,
    )
    db.commit()
    db.refresh(project)
    return project


@router.post("/{project_id}/delete", response_model=ProjectRead)
def soft_delete_project(project_id: uuid.UUID, payload: LifecyclePayload, db: Session = Depends(get_db)) -> Project:
    project = get_project_or_404(db, project_id)
    apply_project_lifecycle(
        db,
        project,
        AuditAction.SOFT_DELETE,
        reason=payload.reason,
        user_id=payload.user_id,
        notes=payload.audit_notes,
    )
    db.commit()
    db.refresh(project)
    return project


@router.post("/{project_id}/restore", response_model=ProjectRead)
def restore_project(project_id: uuid.UUID, payload: AdminLifecyclePayload, db: Session = Depends(get_db)) -> Project:
    if not payload.is_admin:
        raise HTTPException(status_code=403, detail="Only admin can restore deleted projects")
    project = get_project_or_404(db, project_id)
    apply_project_lifecycle(
        db,
        project,
        AuditAction.RESTORE,
        reason=payload.reason,
        user_id=payload.user_id,
        notes=payload.audit_notes,
    )
    db.commit()
    db.refresh(project)
    return project


@router.post("/{project_id}/hard-delete")
def hard_delete_project(project_id: uuid.UUID, payload: HardDeletePayload, db: Session = Depends(get_db)) -> dict[str, bool]:
    if not payload.is_admin:
        raise HTTPException(status_code=403, detail="Only admin can hard delete projects")
    if not payload.confirm:
        raise HTTPException(status_code=400, detail="Hard delete requires explicit confirmation")

    project = get_project_or_404(db, project_id)
    add_audit_log(
        db,
        entity_type=AuditEntityType.PROJECT,
        entity_id=str(project.id),
        action=AuditAction.HARD_DELETE,
        reason=payload.reason,
        user_id=payload.user_id,
        notes=payload.audit_notes,
    )
    db.flush()
    db.delete(project)
    db.commit()
    return {"ok": True}
