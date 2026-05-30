"""Custom per-feed scheduler (#15).

Seeds a FeedSchedule row per known feed, then a periodic sweep polls only the
feeds that are due (now - last_polled >= interval), in priority order. Lets each
source have its own cadence instead of one global interval.
"""

import logging
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from models import FeedSchedule
from feeds.rss_poller import RSS_FEEDS, poll_single_feed
from feeds.ioc_feeds import poll_malwarebazaar, poll_urlhaus, poll_threatfox

logger = logging.getLogger(__name__)

_IOC_POLLERS = {
    "malwarebazaar": poll_malwarebazaar,
    "urlhaus": poll_urlhaus,
    "threatfox": poll_threatfox,
}


async def seed_schedules(db: AsyncSession) -> None:
    """Create a FeedSchedule row for each known feed if missing."""
    existing = {s for (s,) in (await db.execute(select(FeedSchedule.source_name))).all()}
    added = False
    for name, url in RSS_FEEDS.items():
        if name not in existing:
            db.add(FeedSchedule(source_name=name, feed_type="rss", feed_url=url, interval_minutes=30, priority=5))
            added = True
    for name in _IOC_POLLERS:
        if name not in existing:
            db.add(FeedSchedule(source_name=name, feed_type="ioc", interval_minutes=30, priority=3))
            added = True
    if added:
        await db.commit()


async def run_due_feeds(db: AsyncSession) -> dict[str, int]:
    """Poll every enabled feed whose interval has elapsed, in priority order."""
    now = datetime.now(timezone.utc)
    feeds = (await db.execute(
        select(FeedSchedule).where(FeedSchedule.enabled == True).order_by(FeedSchedule.priority)
    )).scalars().all()

    results: dict[str, int] = {}
    for f in feeds:
        due = f.last_polled is None or (now - f.last_polled).total_seconds() >= f.interval_minutes * 60
        if not due:
            continue
        try:
            if f.feed_type == "rss" and f.feed_url:
                count = await poll_single_feed(f.source_name, f.feed_url, db)
            elif f.feed_type == "ioc" and f.source_name in _IOC_POLLERS:
                count = await _IOC_POLLERS[f.source_name](db)
            else:
                continue
        except Exception as e:
            logger.error(f"[scheduler] {f.source_name} failed: {e}")
            continue
        f.last_polled = now
        f.last_count = count
        results[f.source_name] = count
    await db.commit()
    return results
