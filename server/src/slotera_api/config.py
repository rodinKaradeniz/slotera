from functools import lru_cache
from typing import Literal, Self

from pydantic import SecretStr, field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

LOCAL_APPLICATION_DATABASE_URL = (
    "postgresql+asyncpg://slotera_app:slotera_app_local@localhost:55432/slotera"
)
LOCAL_MIGRATION_DATABASE_URL = (
    "postgresql+asyncpg://slotera_owner:slotera_owner_local@localhost:55432/slotera"
)


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_prefix="SLOTERA_",
        extra="ignore",
    )

    environment: Literal["local", "test", "production"] = "local"
    log_level: Literal["DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"] = "INFO"
    database_url: str = LOCAL_APPLICATION_DATABASE_URL
    cors_origins: list[str] = ["http://localhost:3344"]
    session_cookie_name: str = "slotera_session"
    csrf_cookie_name: str = "slotera_csrf"
    csrf_cookie_domain: str | None = None
    session_ttl_hours: int = 12
    remembered_session_ttl_days: int = 30

    @field_validator("cors_origins")
    @classmethod
    def validate_cors_origins(cls, origins: list[str]) -> list[str]:
        if not origins:
            raise ValueError("at least one CORS origin is required")
        for origin in origins:
            if origin == "*" or not origin.startswith(("http://", "https://")):
                raise ValueError("CORS origins must be explicit HTTP(S) origins")
        return [origin.rstrip("/") for origin in origins]

    @model_validator(mode="after")
    def reject_local_credentials_in_production(self) -> Self:
        if self.environment == "production" and "_local" in self.database_url:
            raise ValueError("local database credentials cannot be used in production")
        if self.environment == "production" and not self.csrf_cookie_domain:
            raise ValueError("production requires a shared CSRF cookie domain")
        if self.session_ttl_hours < 1 or self.remembered_session_ttl_days < 1:
            raise ValueError("session lifetimes must be positive")
        return self

    @property
    def secure_cookies(self) -> bool:
        return self.environment == "production"


class MigrationSettings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_prefix="SLOTERA_",
        extra="ignore",
    )

    environment: Literal["local", "test", "production"] = "local"
    migration_database_url: str = LOCAL_MIGRATION_DATABASE_URL
    demo_seed_password: SecretStr | None = None

    @model_validator(mode="after")
    def reject_local_credentials_in_production(self) -> Self:
        if self.environment == "production" and "_local" in self.migration_database_url:
            raise ValueError("local migration credentials cannot be used in production")
        return self


@lru_cache
def get_settings() -> Settings:
    return Settings()


@lru_cache
def get_migration_settings() -> MigrationSettings:
    return MigrationSettings()
