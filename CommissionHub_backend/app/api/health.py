from fastapi import APIRouter, Request, status
from fastapi.responses import JSONResponse
from sqlalchemy import text
from sqlalchemy.engine import make_url
from sqlalchemy.exc import SQLAlchemyError

from ..config import settings
from ..database import engine


router = APIRouter()


@router.get("/health")
def health() -> dict[str, bool]:
    return {"ok": True}


@router.get("/db-health")
def db_health(request: Request) -> JSONResponse:
    configured_url = settings.sqlalchemy_database_url

    try:
        database_url = make_url(configured_url).render_as_string(hide_password=True)
    except Exception:
        database_url = "<invalid>"

    try:
        with engine.connect() as connection:
            connection.execute(text("SELECT 1"))
        request.app.state.db_ready = True
        request.app.state.db_startup_error = None
        return JSONResponse(
            {
                "ok": True,
                "database": "reachable",
                "database_url": database_url,
            }
        )
    except SQLAlchemyError as exc:
        request.app.state.db_ready = False
        request.app.state.db_startup_error = str(exc)
        return JSONResponse(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            content={
                "ok": False,
                "database": "unreachable",
                "database_url": database_url,
                "error": str(exc),
            },
        )
