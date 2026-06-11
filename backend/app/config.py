"""Application configuration — everything comes from environment variables.

No credentials are hardcoded anywhere. Locally, values are supplied by
docker-compose (which reads .env); in production, by the hosting platform.
"""
from functools import lru_cache

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # Full SQLAlchemy database URL, e.g.
    #   postgresql+psycopg2://user:password@host:5432/dbname
    database_url: str = "postgresql+psycopg2://postgres:postgres@db:5432/inventory"

    # Comma-separated list of origins allowed to call this API
    cors_origins: str = "http://localhost:5173,http://localhost:3000"

    app_name: str = "Inventory & Order Management API"

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    class Config:
        env_file = ".env"
        extra = "ignore"


@lru_cache
def get_settings() -> Settings:
    return Settings()
