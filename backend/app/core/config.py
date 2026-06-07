from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import Optional


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
    )

    database_url: str = "sqlite+aiosqlite:///./worksync.db"
    secret_key: str = ""
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 30
    refresh_token_expire_days: int = 7

    cloudinary_cloud_name: Optional[str] = None
    cloudinary_api_key: Optional[str] = None
    cloudinary_api_secret: Optional[str] = None

    deepseek_api_key: Optional[str] = None
    deepseek_model: str = "deepseek-v4-flash"

    polar_access_token: Optional[str] = None
    polar_webhook_secret: Optional[str] = None
    polar_organization_id: Optional[str] = None

    bigdatacloud_api_key: Optional[str] = None

    seed_password: str = "password123"
    env: str = "development"

    cors_origins: str = "http://localhost:5173"

    frontend_url: str = "http://localhost:5173"
    backend_url: str = "http://localhost:8000"

    def check_secret(self) -> None:
        if not self.secret_key or self.secret_key == "change-me-in-production":
            raise ValueError("SECRET_KEY must be set and not the default value")

    @property
    def async_database_url(self) -> str:
        return self.database_url

    @property
    def sync_database_url(self) -> str:
        return self.database_url.replace("+asyncpg", "").replace("+aiosqlite", "")


settings = Settings()
