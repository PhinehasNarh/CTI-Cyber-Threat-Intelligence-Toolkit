from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    # Database
    database_url: str = "sqlite+aiosqlite:///./cti.db"

    # API Keys (all optional)
    virustotal_api_key: str = ""
    abuseipdb_api_key: str = ""
    shodan_api_key: str = ""
    greynoise_api_key: str = ""
    otx_api_key: str = ""

    # Feed polling
    feed_poll_interval: int = 30  # minutes

    # CORS origins (for React dev server)
    cors_origins: list[str] = ["http://localhost:5173", "http://127.0.0.1:5173"]

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


@lru_cache
def get_settings() -> Settings:
    return Settings()
