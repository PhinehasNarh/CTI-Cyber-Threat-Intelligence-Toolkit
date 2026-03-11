"""CTI Platform — FastAPI backend entry point."""

import logging
import logging.handlers
from pathlib import Path
from contextlib import asynccontextmanager
from datetime import datetime, timezone

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from apscheduler.schedulers.asyncio import AsyncIOScheduler

from config import get_settings
from database import init_db, async_session
from routers import feed, iocs, dashboard, kev, intel
from routers import settings as settings_router
from feeds.rss_poller import poll_all_feeds
from feeds.ioc_feeds import poll_all_ioc_feeds
from feeds.kev_sync import sync_kev_catalog

# ── Logging Setup ─────────────────────────────────────────────────
LOG_DIR = Path(__file__).parent / "logs"
LOG_DIR.mkdir(exist_ok=True)
LOG_FORMAT = "%(asctime)s | %(levelname)-7s | %(name)s | %(message)s"

# Console handler
console_handler = logging.StreamHandler()
console_handler.setFormatter(logging.Formatter(LOG_FORMAT))

# File handler — rotates daily, keeps 30 days of logs
file_handler = logging.handlers.TimedRotatingFileHandler(
    filename=str(LOG_DIR / "cti-platform.log"),
    when="midnight",
    interval=1,
    backupCount=30,
    encoding="utf-8",
)
file_handler.setFormatter(logging.Formatter(LOG_FORMAT))
file_handler.suffix = "%Y-%m-%d"

# API access log — separate file for HTTP request logging
access_handler = logging.handlers.TimedRotatingFileHandler(
    filename=str(LOG_DIR / "access.log"),
    when="midnight",
    interval=1,
    backupCount=30,
    encoding="utf-8",
)
access_handler.setFormatter(logging.Formatter(LOG_FORMAT))
access_handler.suffix = "%Y-%m-%d"
access_logger = logging.getLogger("cti.access")
access_logger.addHandler(access_handler)
access_logger.setLevel(logging.INFO)

# Root logger config
logging.basicConfig(
    level=logging.INFO,
    format=LOG_FORMAT,
    handlers=[console_handler, file_handler],
)
logger = logging.getLogger(__name__)

app_settings = get_settings()
scheduler = AsyncIOScheduler()


async def scheduled_feed_poll():
    """Background job: poll all feeds on a timer."""
    async with async_session() as db:
        logger.info("Scheduled poll starting...")
        rss_results = await poll_all_feeds(db)
        ioc_results = await poll_all_ioc_feeds(db)
        total = sum(rss_results.values()) + sum(ioc_results.values())
        logger.info(f"Scheduled poll complete — {total} new items ingested")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    logger.info("Initializing database...")
    await init_db()
    logger.info("Database ready")

    # Start the scheduler
    scheduler.add_job(
        scheduled_feed_poll,
        "interval",
        minutes=app_settings.feed_poll_interval,
        id="feed_poll",
        replace_existing=True,
    )
    scheduler.start()
    logger.info(f"Scheduler started — polling every {app_settings.feed_poll_interval} min")

    # Run initial poll on startup
    logger.info("Running initial feed poll...")
    async with async_session() as db:
        await poll_all_feeds(db)
        await poll_all_ioc_feeds(db)
        await sync_kev_catalog(db)
    logger.info("Initial poll complete")

    yield

    # Shutdown
    scheduler.shutdown()
    logger.info("Scheduler stopped")


app = FastAPI(
    title="CTI Platform",
    description="Cyber Threat Intelligence aggregation and analysis platform",
    version="0.1.0",
    lifespan=lifespan,
)

# CORS — allow React dev server
app.add_middleware(
    CORSMiddleware,
    allow_origins=app_settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Request logging middleware ────────────────────────────────────
@app.middleware("http")
async def log_requests(request: Request, call_next):
    """Log every API request with method, path, status, and duration."""
    import time
    start = time.perf_counter()
    response = await call_next(request)
    duration = round((time.perf_counter() - start) * 1000, 1)

    # Only log API requests (skip static file requests to reduce noise)
    path = request.url.path
    if path.startswith("/api/"):
        access_logger.info(
            f"{request.method} {path} → {response.status_code} ({duration}ms) "
            f"[{request.client.host if request.client else 'unknown'}]"
        )
    return response


# Register routers
app.include_router(feed.router)
app.include_router(iocs.router)
app.include_router(dashboard.router)
app.include_router(kev.router)
app.include_router(intel.router)
app.include_router(settings_router.router)


STATIC_DIR = Path(__file__).parent / "static"


@app.get("/api/health")
async def health_check():
    return {
        "status": "healthy",
        "version": "0.1.0",
        "scheduler_running": scheduler.running,
    }


@app.get("/")
async def serve_frontend():
    """Serve the single-page frontend at root."""
    return FileResponse(str(STATIC_DIR / "index.html"))


# Mount static files LAST so API routes take priority
app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")
