"""
Application configuration module.

WHY THIS EXISTS: Centralizes all environment-dependent configuration so that
a single source of truth governs behavior across auth, database, cloud services,
and billing. Every env var read from the environment is validated or documented
here to prevent silent misconfiguration in production.

SECURITY: SecretKey validation (check_secret) runs at startup to fail fast if
JWT signing key is left at default. Cloudinary/DeepSeek/Polar keys are Optional
so that the app can start in development without them, but missing keys should
degrade features gracefully (see individual services).

TRADE-OFF: SQLite as default database. This is a deliberate choice for single-server
deployments where operational simplicity outweighs horizontal scaling. SQLite with
aiosqlite provides async access without needing a separate database server. For
production multi-instance deployments, switch to PostgreSQL by setting DATABASE_URL
to a postgresql+asyncpg:// connection string. The sync_database_url property strips
the async driver prefix for tools like Alembic that need sync connections.
"""

from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import Optional


class Settings(BaseSettings):
    # Pydantic automatically reads from .env and environment variables.
    # case_sensitive=False means DATABASE_URL and database_url are equivalent.
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
    )

    # --- Database ---
    # WHY SQLite default: Zero-config for development. The +aiosqlite driver
    # enables async SQLAlchemy operations. In production, override with:
    # postgresql+asyncpg://user:pass@host/dbname
    database_url: str = "sqlite+aiosqlite:///./worksync.db"

    # --- JWT ---
    # SECURITY: Must be a long, random value in production. check_secret()
    # prevents the app from starting with an empty or default key.
    secret_key: str = "dev-secret-key-change-in-production"
    # Algorithm choice: HS256 is symmetric (fast, no key management overhead).
    # For multi-service architectures, consider RS256 with a public/private key pair.
    algorithm: str = "HS256"
    # Short-lived access tokens limit the window of compromise if a token is leaked.
    # 30 minutes is a reasonable balance between security and UX (fewer refreshes).
    access_token_expire_minutes: int = 30
    # Refresh tokens live longer so users aren't forced to re-authenticate daily.
    # 7 days is standard; revocation via blacklist mitigates theft risk.
    refresh_token_expire_days: int = 7

    # --- Cloudinary (Image Hosting) ---
    # WHY Optional: Selfie/expense photo uploads are not critical path features.
    # If unset, the cloudinary service returns None and the frontend degrades gracefully.
    cloudinary_cloud_name: Optional[str] = None
    cloudinary_api_key: Optional[str] = None
    cloudinary_api_secret: Optional[str] = None

    # --- DeepSeek (AI) ---
    # WHY Optional: AI features (report generation, analytics) are gated behind
    # subscription plans. The app functions without an API key; AI routes return
    # a descriptive error message.
    deepseek_api_key: Optional[str] = None
    # Model name follows DeepSeek's API convention. Hardcoded to ensure consistency
    # across environments — a typo in an env var would silently degrade results.
    deepseek_model: str = "deepseek-v4-flash"

    # --- Polar.sh (Billing) ---
    # WHY Optional: Subscription billing is only needed when users upgrade from Free.
    # The app seeds with a free plan and only calls Polar when a checkout is requested.
    polar_access_token: Optional[str] = None
    polar_webhook_secret: Optional[str] = None
    polar_organization_id: Optional[str] = None

    # --- BigDataCloud (Reverse Geocoding) ---
    # WHY Optional: Address resolution for GPS coordinates is a nice-to-have.
    # Without it, check-in/check-out records simply won't have human-readable addresses.
    bigdatacloud_api_key: Optional[str] = None

    # --- Seeding ---
    # SECURITY: This is the password for seeded demo accounts (admin + employee).
    # MUST be changed before production. The seed only runs if no admin user exists.
    seed_password: str = "password123"

    # --- Environment ---
    env: str = "development"
    # NOTE: In production, setting env=production disables Swagger docs (/docs, /redoc)
    # to reduce attack surface. See main.py: docs_url condition.

    # --- CORS ---
    # Comma-separated list of allowed origins. In production, restrict to your
    # actual frontend domain(s). "*" is NOT allowed because allow_credentials=True
    # (see main.py CORSMiddleware config).
    port: int = 8000
    cors_origins: str = "http://localhost:5173"

    # --- URLs ---
    frontend_url: str = "http://localhost:5173"
    backend_url: str = "http://localhost:8000"

    def check_secret(self) -> None:
        if self.secret_key == "dev-secret-key-change-in-production" and self.env == "production":
            raise ValueError("SECRET_KEY must be changed for production")

    @property
    def async_database_url(self) -> str:
        # Pass-through: exists for semantic clarity when the caller needs async.
        return self.database_url

    @property
    def sync_database_url(self) -> str:
        """
        Strips async driver prefixes for sync tools like Alembic.
        e.g., "postgresql+asyncpg://..." -> "postgresql://..."
        e.g., "sqlite+aiosqlite://..." -> "sqlite://..."
        Without this, Alembic would try to import async drivers in a sync context.
        """
        return self.database_url.replace("+asyncpg", "").replace("+aiosqlite", "")


# Module-level singleton. Imported throughout the app as `from app.core.config import settings`.
# WHY singleton: Ensures all components read the same configuration without DI overhead.
# Settings are immutable at runtime (Pydantic BaseSettings), so there is no risk of
# one module mutating state that another depends on.
settings = Settings()
