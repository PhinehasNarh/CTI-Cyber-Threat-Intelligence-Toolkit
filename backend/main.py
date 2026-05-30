"""CTI Platform — FastAPI backend entry point."""

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from apscheduler.schedulers.asyncio import AsyncIOScheduler

from config import get_settings
from database import init_db, async_session
from routers import feed, iocs, dashboard, watchlist, attack, export, timeline, alerts, actors, campaigns, audit, triage, digest, leaderboard, timelapse, retention, clusters, chat, ctlogs, geo, honeypot, workspaces, assets, integrations, api_keys, public_api, feeds_config
from services.retention import run_all_active
from services.feed_scheduler import seed_schedules, run_due_feeds
from feeds.rss_poller import poll_all_feeds
from feeds.ioc_feeds import poll_all_ioc_feeds

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-7s | %(name)s | %(message)s",
)
logger = logging.getLogger(__name__)

settings = get_settings()
scheduler = AsyncIOScheduler()


async def scheduled_due_sweep():
    """Background job: poll only feeds whose per-feed interval has elapsed (#15)."""
    async with async_session() as db:
        results = await run_due_feeds(db)
        total = sum(results.values())
        if results:
            logger.info(f"Due-feed sweep polled {len(results)} feeds, {total} new items")


async def scheduled_retention_sweep():
    """Background job: apply active data retention policies once a day (#33)."""
    async with async_session() as db:
        results = await run_all_active(db)
        purged = sum(results.values())
        if purged:
            logger.info(f"Retention sweep purged {purged} rows across {len(results)} policies")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    logger.info("Initializing database...")
    await init_db()
    logger.info("Database ready")

    # Seed per-feed schedules, then run a due-based sweep every 5 minutes (#15)
    async with async_session() as db:
        await seed_schedules(db)
    scheduler.add_job(
        scheduled_due_sweep,
        "interval",
        minutes=5,
        id="due_sweep",
        replace_existing=True,
    )
    scheduler.add_job(
        scheduled_retention_sweep,
        "interval",
        hours=24,
        id="retention_sweep",
        replace_existing=True,
    )
    scheduler.start()
    logger.info("Scheduler started: per-feed due sweep every 5 min, retention daily")

    # Run initial poll on startup
    logger.info("Running initial feed poll...")
    async with async_session() as db:
        await poll_all_feeds(db)
        await poll_all_ioc_feeds(db)
    logger.info("Initial poll complete")

    yield

    # Shutdown
    scheduler.shutdown()
    logger.info("Scheduler stopped")


app = FastAPI(
    title="CTI Platform",
    description="Cyber Threat Intelligence aggregation and analysis platform",
    version="0.3.0",
    lifespan=lifespan,
)

# CORS — allow React dev server
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routers
app.include_router(feed.router)
app.include_router(iocs.router)
app.include_router(dashboard.router)
app.include_router(watchlist.router)
app.include_router(attack.router)
app.include_router(export.router)
app.include_router(timeline.router)
app.include_router(alerts.router)
app.include_router(actors.router)
app.include_router(campaigns.router)
app.include_router(audit.router)
app.include_router(triage.router)
app.include_router(digest.router)
app.include_router(leaderboard.router)
app.include_router(timelapse.router)
app.include_router(retention.router)
app.include_router(clusters.router)
app.include_router(chat.router)
app.include_router(ctlogs.router)
app.include_router(geo.router)
app.include_router(honeypot.router)
app.include_router(workspaces.router)
app.include_router(assets.router)
app.include_router(integrations.router)
app.include_router(api_keys.router)
app.include_router(public_api.router)
app.include_router(feeds_config.router)


@app.get("/api/health")
async def health_check():
    return {
        "status": "healthy",
        "version": "0.3.0",
        "scheduler_running": scheduler.running,
    }
