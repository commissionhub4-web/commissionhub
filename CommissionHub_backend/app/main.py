import logging
from collections import defaultdict

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from .api import api_router
from .config import settings
from .database import Base, engine

app = FastAPI(title=settings.app_name)
logger = logging.getLogger(__name__)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def _resolve_duplicate_employee_emails(connection) -> None:
    rows = connection.execute(
        text(
            """
            SELECT id, email
            FROM employees
            WHERE email IS NOT NULL
            ORDER BY created_at ASC NULLS LAST, id ASC
            """
        )
    ).mappings().all()

    grouped: dict[str, list[dict]] = defaultdict(list)
    for row in rows:
        grouped[str(row["email"]).strip().lower()].append(row)

    for normalized_email, entries in grouped.items():
        if len(entries) <= 1:
            continue

        for duplicate_index, row in enumerate(entries[1:], start=1):
            original_email = str(row["email"]).strip()
            local, at, domain = original_email.partition("@")
            if not at:
                local, domain = original_email, "example.com"

            suffix = f"dup{duplicate_index}-{str(row['id'])[:8]}"
            new_email = f"{local}+{suffix}@{domain}".lower()

            connection.execute(
                text("UPDATE employees SET email = :new_email WHERE id = :employee_id"),
                {"new_email": new_email, "employee_id": row["id"]},
            )

            logger.warning(
                "Duplicate employee email resolved during startup",
                extra={"old_email": original_email, "new_email": new_email, "employee_id": str(row["id"])},
            )


@app.on_event("startup")
def on_startup() -> None:
    logger.info("App startup environment", extra={"app_env": settings.app_env})
    logger.info("SMTP configuration status", extra={"smtp": settings.smtp_debug_summary()})
    app.state.db_ready = False
    app.state.db_startup_error = None

    try:
        Base.metadata.create_all(bind=engine)
        with engine.begin() as connection:
            connection.execute(text("ALTER TABLE projects ADD COLUMN IF NOT EXISTS client_name VARCHAR(200)"))
            connection.execute(text("ALTER TABLE projects ADD COLUMN IF NOT EXISTS audit_notes TEXT"))
            connection.execute(text("ALTER TABLE employees ADD COLUMN IF NOT EXISTS bank_account_number VARCHAR(16)"))
            connection.execute(text("ALTER TABLE employees ADD COLUMN IF NOT EXISTS email VARCHAR(255)"))
            connection.execute(text("ALTER TABLE employees ADD COLUMN IF NOT EXISTS phone_number VARCHAR(11)"))
            connection.execute(text("ALTER TABLE employees ADD COLUMN IF NOT EXISTS audit_notes TEXT"))
            connection.execute(text("ALTER TABLE commissions ADD COLUMN IF NOT EXISTS project_role VARCHAR(120)"))
            connection.execute(text("UPDATE commissions SET project_role = COALESCE(NULLIF(project_role, ''), department, 'Night Shift')"))
            connection.execute(text("ALTER TABLE commissions ALTER COLUMN project_role SET NOT NULL"))
            connection.execute(text("ALTER TABLE employees ALTER COLUMN bank_account_number TYPE VARCHAR(16)"))
            connection.execute(text("ALTER TABLE employees ALTER COLUMN phone_number TYPE VARCHAR(11)"))
            _resolve_duplicate_employee_emails(connection)
            connection.execute(text("CREATE UNIQUE INDEX IF NOT EXISTS uq_employees_email_lower ON employees (LOWER(email)) WHERE email IS NOT NULL"))
        app.state.db_ready = True
    except Exception as exc:
        app.state.db_startup_error = str(exc)
        logger.exception("Database startup initialization failed")


app.include_router(api_router)
