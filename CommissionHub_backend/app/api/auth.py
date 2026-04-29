import hashlib
import logging
import secrets
import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.database import get_db
from app.email_service import (
    SmtpAuthenticationError,
    SmtpConfigurationError,
    SmtpConnectionError,
    SmtpDeliveryError,
    send_reset_code_email,
)
from app.models import AuthUser, AuthUserStatus
from app.config import settings
from app.schemas import (
    AuthLoginRequest,
    AuthResult,
    AuthSendResetCodeRequest,
    AuthSignupRequest,
    AuthUserActionResponse,
    AuthUserRead,
)


router = APIRouter()
logger = logging.getLogger(__name__)

ADMIN_EMAIL = "admin@commissionpro.com"
ADMIN_PASSWORD = "admin123"


def hash_password(password: str) -> str:
    salt = secrets.token_hex(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt.encode("utf-8"), 100_000).hex()
    return f"{salt}${digest}"


def verify_password(password: str, stored_password_hash: str) -> bool:
    try:
        salt, digest = stored_password_hash.split("$", maxsplit=1)
    except ValueError:
        return False
    expected_digest = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt.encode("utf-8"), 100_000).hex()
    return secrets.compare_digest(digest, expected_digest)


def normalize_email(email: str) -> str:
    return email.strip().lower()


def ensure_admin_user(db: Session) -> None:
    existing = db.scalar(select(AuthUser).where(func.lower(AuthUser.email) == ADMIN_EMAIL))
    if existing is not None:
        return
    admin_user = AuthUser(
        email=ADMIN_EMAIL,
        password_hash=hash_password(ADMIN_PASSWORD),
        name="Admin",
        status=AuthUserStatus.APPROVED,
        is_admin=True,
        approved_at=datetime.utcnow(),
    )
    db.add(admin_user)
    db.commit()


@router.post("/signup", response_model=AuthResult)
def signup(payload: AuthSignupRequest, db: Session = Depends(get_db)) -> AuthResult:
    ensure_admin_user(db)
    email = normalize_email(payload.email)

    if email == ADMIN_EMAIL:
        return AuthResult(success=False, message="This email is reserved.")

    existing = db.scalar(select(AuthUser).where(func.lower(AuthUser.email) == email))
    if existing is not None:
        return AuthResult(success=False, message="An account with this email already exists.")

    user = AuthUser(
        email=email,
        password_hash=hash_password(payload.password),
        name=payload.name.strip(),
        status=AuthUserStatus.PENDING,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    return AuthResult(
        success=True,
        message="Account created! Please wait for admin to verify your account before you can log in.",
        user=user,
    )


@router.post("/login", response_model=AuthResult)
def login(payload: AuthLoginRequest, db: Session = Depends(get_db)) -> AuthResult:
    ensure_admin_user(db)
    email = normalize_email(payload.email)
    user = db.scalar(select(AuthUser).where(func.lower(AuthUser.email) == email))

    if user is None or not verify_password(payload.password, user.password_hash):
        return AuthResult(success=False, message="Invalid email or password.")

    if user.status == AuthUserStatus.PENDING:
        return AuthResult(success=False, message="Your account is pending admin verification. Please wait for approval.")
    if user.status == AuthUserStatus.REJECTED:
        return AuthResult(success=False, message="Your account has been rejected. Please contact admin.")

    return AuthResult(success=True, message="Welcome back!", user=user)


@router.post("/send-reset-code", response_model=AuthResult)
def send_reset_code(payload: AuthSendResetCodeRequest) -> AuthResult:
    to_email = normalize_email(payload.email)
    logger.info("Password reset email request received", extra={"to_email": to_email})
    logger.info("SMTP settings status", extra={"smtp": settings.smtp_debug_summary()})

    try:
        send_reset_code_email(to_email=to_email, code=payload.code.strip(), settings=settings)
    except SmtpConfigurationError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    except SmtpAuthenticationError as exc:
        raise HTTPException(status_code=401, detail=str(exc)) from exc
    except SmtpConnectionError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except SmtpDeliveryError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    except Exception as exc:  # pragma: no cover
        raise HTTPException(status_code=500, detail=f"Failed to send reset email: {exc}") from exc

    logger.info("Password reset email dispatched", extra={"to_email": to_email})

    return AuthResult(success=True, message="Reset code sent to your email.")


@router.get("/users", response_model=list[AuthUserRead])
def list_users(db: Session = Depends(get_db)) -> list[AuthUser]:
    ensure_admin_user(db)
    users = db.scalars(
        select(AuthUser)
        .where(AuthUser.is_admin.is_(False))
        .order_by(AuthUser.created_at.desc())
    ).all()
    return list(users)


def get_user_or_404(user_id: uuid.UUID, db: Session) -> AuthUser:
    user = db.scalar(select(AuthUser).where(AuthUser.id == user_id))
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")
    if user.is_admin:
        raise HTTPException(status_code=400, detail="Admin user cannot be modified")
    return user


@router.post("/users/{user_id}/approve", response_model=AuthUserActionResponse)
def approve_user(user_id: uuid.UUID, db: Session = Depends(get_db)) -> AuthUserActionResponse:
    user = get_user_or_404(user_id, db)
    user.status = AuthUserStatus.APPROVED
    user.approved_at = datetime.utcnow()
    db.commit()
    db.refresh(user)
    return AuthUserActionResponse(ok=True, user=user)


@router.post("/users/{user_id}/reject", response_model=AuthUserActionResponse)
def reject_user(user_id: uuid.UUID, db: Session = Depends(get_db)) -> AuthUserActionResponse:
    user = get_user_or_404(user_id, db)
    user.status = AuthUserStatus.REJECTED
    db.commit()
    db.refresh(user)
    return AuthUserActionResponse(ok=True, user=user)


@router.delete("/users/{user_id}", response_model=AuthResult)
def delete_user(user_id: uuid.UUID, db: Session = Depends(get_db)) -> AuthResult:
    user = get_user_or_404(user_id, db)
    db.delete(user)
    db.commit()
    return AuthResult(success=True, message="User deleted successfully.")