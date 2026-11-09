"""Centralized API v1 router registry."""

from fastapi import APIRouter

from app.api import audit, auth, cvs, dashboard, jobs, matching, system, users

API_V1_PREFIX = "/api/v1"

api_router = APIRouter(prefix=API_V1_PREFIX)
api_router.include_router(auth.router)
api_router.include_router(jobs.router)
api_router.include_router(cvs.router)
api_router.include_router(matching.router)
api_router.include_router(dashboard.router)
api_router.include_router(audit.router)
api_router.include_router(system.router)
api_router.include_router(users.router)

__all__ = ["API_V1_PREFIX", "api_router"]

