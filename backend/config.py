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
    urlscan_api_key: str = ""

    # Threat-sharing & monitoring integrations (all optional; empty = not configured)
    misp_url: str = ""
    misp_key: str = ""
    opencti_url: str = ""
    opencti_token: str = ""
    darkweb_feed_url: str = ""

    # Feed polling
    feed_poll_interval: int = 30  # minutes

    # CORS origins (for React dev server)
    cors_origins: list[str] = ["http://localhost:5173", "http://127.0.0.1:5173"]
    # Deployed frontend origin (e.g. https://cti.vercel.app); appended to cors_origins.
    frontend_url: str = ""

    @property
    def allowed_origins(self) -> list[str]:
        origins = list(self.cors_origins)
        if self.frontend_url and self.frontend_url not in origins:
            origins.append(self.frontend_url.rstrip("/"))
        return origins

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


@lru_cache
def get_settings() -> Settings:
    return Settings()
