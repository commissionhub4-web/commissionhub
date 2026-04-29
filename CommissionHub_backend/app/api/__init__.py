from fastapi import APIRouter

from . import audit, auth, billing, commissions, employees, health, projects, reports


api_router = APIRouter(prefix="/api")
api_router.include_router(health.router, tags=["health"])
api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(employees.router, prefix="/employees", tags=["employees"])
api_router.include_router(projects.router, prefix="/projects", tags=["projects"])
api_router.include_router(billing.router, prefix="/billing", tags=["billing"])
api_router.include_router(commissions.router, prefix="/commissions", tags=["commissions"])
api_router.include_router(reports.router, prefix="/reports", tags=["reports"])
api_router.include_router(audit.router, prefix="/audit-logs", tags=["audit"])
