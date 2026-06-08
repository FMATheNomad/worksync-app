"""
Database engine, session factory, and base model.

WHY THIS EXISTS: Configures SQLAlchemy's async engine and session lifecycle so that
every route handler can depend on a clean, properly-closed database session without
leaking connections. This module is the single point of configuration for all database
interactions.

ENGINE CONFIGURATION:
  - Async engine (AsyncSession, async_sessionmaker): All I/O-bound database operations
    run in asyncio's event loop without blocking the server. This is critical for
    FastAPI's async performance. Switching to sync would require thread pool management
    and negate many of FastAPI's concurrency benefits.
  - Connection pooling (PostgreSQL): pool_size=20, max_overflow=10 allows up to 30
    concurrent database connections. This is tuned for a typical web server handling
    100-200 requests/second. Tune based on your database server's max_connections.
  - SQLite special case: check_same_thread=False is REQUIRED because SQLAlchemy's
    async engine uses multiple threads internally for SQLite file access. Without this,
    you get "SQLite objects created in a thread can only be used in that same thread" errors.
  - expire_on_commit=False: Prevents SQLAlchemy from expiring all attributes after commit.
    This allows accessing model attributes after the session is committed (useful for
    serialization in response models). The trade-off is slightly higher memory usage
    because objects remain in the identity map.

SESSION LIFECYCLE (get_db): See docstring below.
"""

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase
from typing import AsyncGenerator

from app.core.config import settings

# Build engine configuration based on database backend.
# SQLite and PostgreSQL have fundamentally different pooling requirements:
#   - SQLite: No connection pool needed (single-file, single-writer). Only need
#     check_same_thread=False for async compatibility.
#   - PostgreSQL: Connection pool is essential to avoid the overhead of establishing
#     a TCP connection for every request.
_engine_kwargs = {
    "echo": False,  # Set to True for SQL query debugging (development only).
}
if "sqlite" in settings.async_database_url:
    # SECURITY NOTE: check_same_thread=False relaxes SQLite's thread-safety guard.
    # This is safe for a single-process async server but NOT for multi-process
    # deployments where file locking could cause corruption.
    _engine_kwargs["connect_args"] = {"check_same_thread": False}
else:
    # PostgreSQL pool settings. pool_size=20 is reasonable for most workloads.
    # max_overflow=10 provides burst capacity without exceeding typical PG
    # max_connections (default 100). Monitor PG connections and adjust accordingly.
    _engine_kwargs["pool_size"] = 20
    _engine_kwargs["max_overflow"] = 10

engine = create_async_engine(settings.async_database_url, **_engine_kwargs)

async_session_factory = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


class Base(DeclarativeBase):
    """
    Declarative base for all ORM models.
    WHY separate class: Allows adding shared model behavior (e.g., mixins for
    timestamp columns, soft delete) in one place. All models in app.models inherit
    from this.
    """
    pass


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """
    FastAPI dependency that provides a database session with automatic lifecycle
    management:

    1. Yields a session for the request handler to use.
    2. On success (no exception), commits the transaction.
    3. On exception, rolls back the transaction to prevent partial writes.
    4. ALWAYS closes the session in `finally` to return the connection to the pool.

    WHY yield (generator-based): FastAPI's dependency injection system recognizes
    async generators and wraps them in a try/finally context, ensuring cleanup
    runs even if the handler raises an unhandled exception.

    WHY commit in dependency (not in handler): Keeps handlers clean — they don't
    need to remember to commit. The commit only happens if the handler succeeds,
    so partial failures never persist.

    EDGE CASE: If you need to read data after the commit (e.g., in a background
    task), use `session.refresh(obj)` before the dependency returns, or access
    attributes that were loaded before commit (expire_on_commit=False helps here).
    """
    async with async_session_factory() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()
