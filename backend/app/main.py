import os
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, FileResponse
from fastapi.staticfiles import StaticFiles

from app.api.v1 import auth, users, attendance, expenses, reports, ai, billing
from app.core.config import settings
from app.core.database import engine, async_session_factory, Base
from app.core.middleware import SubscriptionMiddleware
from app.core.security import hash_password
from app.models.user import User, UserRole, SubscriptionPlan, SubscriptionStatus

app = FastAPI(
    title="Worksync API",
    description="Employee attendance, expense, and daily report management system",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_url, "http://localhost:5173", "http://localhost:3000", "https://*.up.railway.app"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.add_middleware(SubscriptionMiddleware)

app.include_router(auth.router, prefix="/api/v1")
app.include_router(users.router, prefix="/api/v1")
app.include_router(attendance.router, prefix="/api/v1")
app.include_router(expenses.router, prefix="/api/v1")
app.include_router(reports.router, prefix="/api/v1")
app.include_router(ai.router, prefix="/api/v1")
app.include_router(billing.router, prefix="/api/v1")

STATIC_DIR = Path(__file__).parent.parent.parent / "frontend" / "dist"
if STATIC_DIR.exists():
    app.mount("/assets", StaticFiles(directory=str(STATIC_DIR / "assets")), name="assets")


@app.exception_handler(401)
async def unauthorized_handler(request: Request, exc: Exception):
    return JSONResponse(
        status_code=401,
        content={"detail": "Unauthorized"},
    )


@app.exception_handler(403)
async def forbidden_handler(request: Request, exc: Exception):
    detail = getattr(exc, "detail", "Forbidden")
    return JSONResponse(
        status_code=403,
        content={"detail": detail},
    )


@app.exception_handler(404)
async def not_found_handler(request: Request, exc: Exception):
    if STATIC_DIR.exists() and not request.url.path.startswith("/api/") and not request.url.path.startswith("/docs") and not request.url.path.startswith("/redoc"):
        return FileResponse(str(STATIC_DIR / "index.html"))
    detail = getattr(exc, "detail", "Not found")
    return JSONResponse(
        status_code=404,
        content={"detail": detail},
    )


@app.exception_handler(500)
async def internal_error_handler(request: Request, exc: Exception):
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error"},
    )


@app.on_event("startup")
async def startup():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with async_session_factory() as db:
        from sqlalchemy import select
        result = await db.execute(select(User).where(User.email == "admin@worksync.app"))
        if not result.scalar_one_or_none():
            import uuid
            from datetime import datetime, timezone
            admin = User(
                id=uuid.uuid4(), name="Admin Worksync", email="admin@worksync.app",
                hashed_password=hash_password("password123"),
                role=UserRole.admin, jabatan="System Administrator",
                is_active=True, subscription_plan=SubscriptionPlan.enterprise,
                subscription_status=SubscriptionStatus.active, max_employees=999999,
                created_at=datetime.now(timezone.utc),
            )
            employee = User(
                id=uuid.uuid4(), name="Karyawan Demo", email="karyawan@worksync.app",
                hashed_password=hash_password("password123"),
                role=UserRole.employee, jabatan="Staff",
                is_active=True, subscription_plan=SubscriptionPlan.free,
                subscription_status=SubscriptionStatus.active, max_employees=5,
                created_at=datetime.now(timezone.utc),
            )
            db.add_all([admin, employee])
            await db.commit()


@app.get("/health")
async def health_check():
    return {"status": "healthy", "version": "1.0.0"}
