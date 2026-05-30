"""Timeline API — temporal breakdown of IOC and article ingestion."""

from collections import defaultdict
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from models import IOC, FeedArticle

router = APIRouter(prefix="/api/timeline", tags=["timeline"])


def _tz(dt: datetime) -> datetime:
    return dt.replace(tzinfo=timezone.utc) if dt.tzinfo is None else dt


@router.get("")
async def get_timeline(
    days: int = Query(default=30, ge=7, le=365),
    db: AsyncSession = Depends(get_db),
):
    """Return daily counts for IOCs and articles over the requested range."""
    now = datetime.now(timezone.utc)
    cutoff = now - timedelta(days=days)

    dates = [
        (now - timedelta(days=i)).strftime("%Y-%m-%d")
        for i in range(days - 1, -1, -1)
    ]

    # ── IOCs ──────────────────────────────────────────────────────────────────
    ioc_rows = (
        await db.execute(
            select(IOC.first_seen, IOC.source, IOC.ioc_type)
            .where(IOC.first_seen >= cutoff)
        )
    ).all()

    ioc_by_day: dict[str, int] = defaultdict(int)
    ioc_by_source: dict[str, dict[str, int]] = defaultdict(lambda: defaultdict(int))
    ioc_by_type: dict[str, dict[str, int]] = defaultdict(lambda: defaultdict(int))

    for first_seen, source, ioc_type in ioc_rows:
        day = _tz(first_seen).strftime("%Y-%m-%d")
        ioc_by_day[day] += 1
        ioc_by_source[source][day] += 1
        ioc_by_type[ioc_type][day] += 1

    # ── Articles ──────────────────────────────────────────────────────────────
    art_rows = (
        await db.execute(
            select(FeedArticle.fetched_at, FeedArticle.source)
            .where(FeedArticle.fetched_at >= cutoff)
        )
    ).all()

    art_by_day: dict[str, int] = defaultdict(int)
    art_by_source: dict[str, dict[str, int]] = defaultdict(lambda: defaultdict(int))

    for fetched_at, source in art_rows:
        day = _tz(fetched_at).strftime("%Y-%m-%d")
        art_by_day[day] += 1
        art_by_source[source][day] += 1

    def series(day_map: dict[str, int]) -> list[int]:
        return [day_map.get(d, 0) for d in dates]

    # Top sources by total volume
    top_ioc_sources = sorted(
        ioc_by_source, key=lambda s: sum(ioc_by_source[s].values()), reverse=True
    )[:5]
    top_art_sources = sorted(
        art_by_source, key=lambda s: sum(art_by_source[s].values()), reverse=True
    )[:5]

    return {
        "range_days": days,
        "dates": dates,
        "ioc_total": series(ioc_by_day),
        "article_total": series(art_by_day),
        "ioc_by_source": {src: series(ioc_by_source[src]) for src in top_ioc_sources},
        "ioc_by_type": {t: series(ioc_by_type[t]) for t in ioc_by_type},
        "article_by_source": {src: series(art_by_source[src]) for src in top_art_sources},
    }
