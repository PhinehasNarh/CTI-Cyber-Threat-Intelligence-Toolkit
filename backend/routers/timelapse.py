"""Time-lapse replay data (#40).

Returns per-day buckets of new IOCs and articles over a window so the frontend
can animate the accumulation of collected intelligence over time.
"""

from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from models import IOC, FeedArticle

router = APIRouter(prefix="/api/timelapse", tags=["timelapse"])


@router.get("")
async def timelapse(days: int = Query(default=90, ge=7, le=365), db: AsyncSession = Depends(get_db)):
    now = datetime.now(timezone.utc)
    start = (now - timedelta(days=days)).replace(hour=0, minute=0, second=0, microsecond=0)

    # Per-day IOC counts and per-type breakdown
    ioc_rows = (await db.execute(
        select(
            func.date(IOC.first_seen).label("d"),
            IOC.ioc_type,
            func.count(IOC.id),
        )
        .where(IOC.first_seen >= start)
        .group_by("d", IOC.ioc_type)
    )).all()

    art_rows = (await db.execute(
        select(func.date(FeedArticle.fetched_at).label("d"), func.count(FeedArticle.id))
        .where(FeedArticle.fetched_at >= start)
        .group_by("d")
    )).all()

    ioc_by_day: dict[str, dict] = {}
    for d, t, c in ioc_rows:
        bucket = ioc_by_day.setdefault(str(d), {"total": 0, "by_type": {}})
        bucket["total"] += c
        bucket["by_type"][t] = bucket["by_type"].get(t, 0) + c
    art_by_day = {str(d): c for d, c in art_rows}

    frames = []
    for i in range(days + 1):
        day = (start + timedelta(days=i)).strftime("%Y-%m-%d")
        ib = ioc_by_day.get(day, {"total": 0, "by_type": {}})
        frames.append({
            "date": day,
            "iocs": ib["total"],
            "by_type": ib["by_type"],
            "articles": art_by_day.get(day, 0),
        })

    return {
        "days": days,
        "frame_count": len(frames),
        "total_iocs": sum(f["iocs"] for f in frames),
        "total_articles": sum(f["articles"] for f in frames),
        "frames": frames,
    }
