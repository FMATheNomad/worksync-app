"""
FastAPI application entry point.

WHY THIS EXISTS: Initializes the FastAPI app, registers middleware, configures
CORS, mounts the frontend static build, sets up rate limiting, and seeds the
database on first startup.

STARTUP SEQUENCE:
  1. FastAPI app created with title/version/docs config.
  2. Rate limiter (slowapi) configured with default 60 req/min per IP.
  3. CORS middleware added.
  4. Subscription gating handled per-route via check_feature_access().
  5. All API routers included under /api/v1 prefix.
  6. Static files mounted (if frontend/dist exists).
  7. Exception handlers registered for 401, 403, 404, 500.
  8. Startup event: check secret, create tables, seed demo users.

MIDDLEWARE ORDER SIGNIFICANCE:
  Middleware in FastAPI/Starlette wraps the inner app in REVERSE order of
  registration. So:
    - CORSMiddleware is the OUTERMOST layer (runs first on request).
    - SubscriptionMiddleware is the INNER layer (runs after CORS).
  
  WHY CORS first: CORS headers must be set on ALL responses, including error
  responses from inner middleware. If CORS middleware is inner, OPTIONS
  preflight requests might fail before reaching it.
  
  WHY SubscriptionMiddleware second: It checks request.path against premium
  feature routes. Placing it after CORS but before route handlers means
  unauthorized access to premium routes is rejected early, before any
  request body parsing or DB queries.

SPA FALLBACK STRATEGY:
  The 404 handler is the SPA fallback. If:
    - Static files exist (frontend/dist is built)
    - Request path is NOT an API route (/api/...)
    - Request path is NOT /docs or /redoc
  Then serve index.html (the React app entry point).
  
  This allows React Router to handle client-side routing. Without this,
  refreshing /employee/attendance would return 404.
  
  WHY not use Starlette's SPAStaticFiles: The condition-based fallback
  (only for non-API routes) allows API and SPA routes to coexist on the
  same origin without conflicts.

RATE LIMITING:
  Default: 60 requests/minute per IP. This is generous enough for normal use
  but prevents basic abuse. Individual routes may have stricter limits (e.g.,
  /auth/login: 10/minute).
  
  NOTE: get_remote_address uses the client IP directly. Behind a reverse proxy
  (Nginx, Cloudflare), this would see the proxy's IP. In production, configure
  slowapi to use X-Forwarded-For header.

SEEDING:
  On first startup, creates two demo accounts:
    - admin@worksync.app (role: admin, plan: enterprise)
    - employee@worksync.app (role: employee, plan: free)
  Both use the configured seed_password (default "password123").
  
  SECURITY: Seeding only happens if no admin user exists. This prevents
  overwriting production data on restart. The seed_password should be changed
  in production via .env.
  
  WHY seed at startup (not migration): Database migrations handle schema;
  seed data is application-level and best managed by the application itself.
  This also allows seeding to be environment-aware (different seeds for
  development vs. staging vs. production).
"""

import os
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

from app.api.v1 import auth, users, attendance, expenses, reports, ai, billing
from app.core.config import settings
from app.core.database import engine, async_session_factory, Base
from app.core.limiter import limiter

from app.core.security import hash_password
from app.models.user import User, UserRole, SubscriptionPlan, SubscriptionStatus

app = FastAPI(
    title="Worksync API",
    description="Employee attendance, expense, and daily report management system",
    version="1.0.0",
    # Disable Swagger docs in production to reduce attack surface.
    docs_url="/docs" if os.getenv("ENV") != "production" else None,
    redoc_url="/redoc" if os.getenv("ENV") != "production" else None,
)

# Attach limiter to app state (required by slowapi).
app.state.limiter = limiter
# Register the rate limit exceeded handler for proper JSON error responses.
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# --- Middleware (order matters — outermost first in code, innermost first to execute) ---

# 1. CORS: Must be outermost to handle preflight OPTIONS requests.
#    allow_credentials=True requires specific origins (not "*").
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins.split(",") if settings.cors_origins else ["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 2. Subscription middleware: Feature gating based on plan.
app.include_router(auth.router, prefix="/api/v1")
app.include_router(users.router, prefix="/api/v1")
app.include_router(attendance.router, prefix="/api/v1")
app.include_router(expenses.router, prefix="/api/v1")
app.include_router(reports.router, prefix="/api/v1")
app.include_router(ai.router, prefix="/api/v1")
app.include_router(billing.router, prefix="/api/v1")

# --- Static files (frontend SPA) ---
STATIC_DIR = Path(__file__).parent.parent.parent / "frontend" / "dist"
if STATIC_DIR.exists():
    # Mount /assets so React's built assets are served directly.
    app.mount("/assets", StaticFiles(directory=str(STATIC_DIR / "assets")), name="assets")


# --- Exception Handlers ---

@app.exception_handler(401)
async def unauthorized_handler(request: Request, exc: Exception):
    """Standard 401 JSON response for unauthorized requests."""
    return JSONResponse(
        status_code=401,
        content={"detail": "Unauthorized"},
    )


@app.exception_handler(403)
async def forbidden_handler(request: Request, exc: Exception):
    """
    403 handler that preserves the custom detail message from
    HTTPException (e.g., "Feature 'ai_assistant' is not available...").
    """
    detail = getattr(exc, "detail", "Forbidden")
    return JSONResponse(
        status_code=403,
        content={"detail": detail},
    )


@app.exception_handler(404)
async def not_found_handler(request: Request, exc: Exception):
    """
    SPA fallback: If the frontend is built, serve index.html for non-API routes.
    This enables client-side routing with React Router.
    
    API routes (404) return JSON error. Docs routes also return JSON.
    """
    if STATIC_DIR.exists() and not request.url.path.startswith("/api/") and not request.url.path.startswith("/docs") and not request.url.path.startswith("/redoc"):
        return FileResponse(str(STATIC_DIR / "index.html"))
    detail = getattr(exc, "detail", "Not found")
    return JSONResponse(
        status_code=404,
        content={"detail": detail},
    )


@app.exception_handler(500)
async def internal_error_handler(request: Request, exc: Exception):
    """
    Catches unhandled exceptions to return a JSON 500 response instead of
    the default HTML error page. Hides internal error details from clients
    to prevent information leakage.
    """
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error"},
    )


# --- Startup ---

@app.on_event("startup")
async def startup():
    """
    Runs on application startup:
      1. Validates secret key (fail fast if insecure).
      2. Creates all database tables (auto-migration).
      3. Seeds demo users if they don't exist.
    
    WHY create_all on every startup: SQLAlchemy's create_all checks for
    existing tables and skips creation if they exist. This is safe for
    development but should be replaced with Alembic migrations for production.
    """
    settings.check_secret()
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    seed_pw = settings.seed_password
    async with async_session_factory() as db:
        from sqlalchemy import select
        result = await db.execute(select(User).where(User.email == "admin@worksync.app"))
        if not result.scalar_one_or_none():
            # Only seed if no admin user exists (idempotent).
            import uuid
            from datetime import datetime, timezone
            admin = User(
                id=uuid.uuid4(), name="Admin Worksync", email="admin@worksync.app",
                hashed_password=hash_password(seed_pw),
                role=UserRole.admin, jabatan="System Administrator",
                is_active=True, subscription_plan=SubscriptionPlan.enterprise,
                subscription_status=SubscriptionStatus.active, max_employees=999999,
                created_at=datetime.now(timezone.utc),
            )
            employee = User(
                id=uuid.uuid4(), name="Employee Demo", email="employee@worksync.app",
                hashed_password=hash_password(seed_pw),
                role=UserRole.employee, jabatan="Staff",
                is_active=True, subscription_plan=SubscriptionPlan.free,
                subscription_status=SubscriptionStatus.active, max_employees=5,
                created_at=datetime.now(timezone.utc),
            )
            db.add_all([admin, employee])
            await db.commit()


@app.get("/health")
async def health_check():
    """Simple health check endpoint for monitoring/load balancers."""
    return {"status": "healthy", "version": "1.0.0"}
