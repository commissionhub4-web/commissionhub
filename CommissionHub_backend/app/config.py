from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


BACKEND_DIR = Path(__file__).resolve().parents[1]
WORKSPACE_DIR = BACKEND_DIR.parent


class Settings(BaseSettings):
    app_name: str = "CommissionHub API"
    app_env: str = "development"
    database_public_url: str = "postgresql+psycopg://postgres:postgres@localhost:5432/commissionhub"
    cors_origins: str = "http://localhost:5173,http://localhost:8080"
    smtp_host: str = "smtp.gmail.com"
    smtp_port: int = 587
    smtp_username: str = ""
    smtp_password: str = ""
    smtp_from_email: str = ""
    database_startup_max_attempts: int = 6
    database_startup_retry_delay_seconds: float = 2.0

    model_config = SettingsConfigDict(
        env_file=(str(BACKEND_DIR / ".env"), str(WORKSPACE_DIR / ".env")),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]

    @property
    def sqlalchemy_database_url(self) -> str:
        database_url = self.database_public_url.strip()
        if not database_url:
            return "postgresql+psycopg://postgres:postgres@localhost:5432/commissionhub"
        if database_url.startswith("postgres://"):
            return database_url.replace("postgres://", "postgresql+psycopg://", 1)
        if database_url.startswith("postgresql://"):
            return database_url.replace("postgresql://", "postgresql+psycopg://", 1)
        return database_url

    @property
    def smtp_sender(self) -> str:
        return self.smtp_from_email.strip() or self.smtp_username.strip()

    @property
    def smtp_ready(self) -> bool:
        return bool(self.smtp_host and self.smtp_port and self.smtp_username and self.smtp_password and self.smtp_sender)

    def smtp_debug_summary(self) -> dict[str, str | int | bool]:
        return {
            "smtp_host": self.smtp_host,
            "smtp_port": self.smtp_port,
            "smtp_sender": self.smtp_sender or "<empty>",
            "smtp_username_set": bool(self.smtp_username),
            "smtp_password_set": bool(self.smtp_password),
            "smtp_ready": self.smtp_ready,
        }


settings = Settings()
