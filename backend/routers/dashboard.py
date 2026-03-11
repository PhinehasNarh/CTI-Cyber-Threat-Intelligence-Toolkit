"""API routes for the dashboard overview."""

from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends
from sqlalchemy import select, func, desc
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from models import FeedArticle, IOC, CVE

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])


@router.get("")
async def dashboard_overview(db: AsyncSession = Depends(get_db)):
    """Main dashboard stats — article counts, IOC counts, recent activity."""
    now = datetime.now(timezone.utc)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)

    # Article stats
    total_articles = await db.execute(select(func.count(FeedArticle.id)))
    articles_today = await db.execute(
        select(func.count(FeedArticle.id)).where(FeedArticle.fetched_at >= today_start)
    )
    unread_articles = await db.execute(
        select(func.count(FeedArticle.id)).where(FeedArticle.is_read == False)
    )

    # IOC stats
    total_iocs = await db.execute(select(func.count(IOC.id)))
    iocs_today = await db.execute(
        select(func.count(IOC.id)).where(IOC.first_seen >= today_start)
    )

    # Recent articles
    recent = await db.execute(
        select(FeedArticle)
        .order_by(desc(FeedArticle.published))
        .limit(10)
    )
    recent_articles = recent.scalars().all()

    # IOC type breakdown
    ioc_types = await db.execute(
        select(IOC.ioc_type, func.count(IOC.id)).group_by(IOC.ioc_type)
    )

    # Articles per source
    source_counts = await db.execute(
        select(FeedArticle.source, func.count(FeedArticle.id))
        .group_by(FeedArticle.source)
        .order_by(func.count(FeedArticle.id).desc())
    )

    # IOCs per day for the last 7 days
    ioc_trend = []
    for i in range(6, -1, -1):
        day_start = (now - timedelta(days=i)).replace(hour=0, minute=0, second=0, microsecond=0)
        day_end = day_start + timedelta(days=1)
        count_result = await db.execute(
            select(func.count(IOC.id)).where(
                IOC.first_seen >= day_start, IOC.first_seen < day_end
            )
        )
        ioc_trend.append({
            "date": day_start.strftime("%Y-%m-%d"),
            "count": count_result.scalar() or 0,
        })

    return {
        "stats": {
            "total_articles": total_articles.scalar() or 0,
            "articles_today": articles_today.scalar() or 0,
            "unread_articles": unread_articles.scalar() or 0,
            "total_iocs": total_iocs.scalar() or 0,
            "iocs_today": iocs_today.scalar() or 0,
        },
        "recent_articles": [
            {
                "id": a.id,
                "title": a.title,
                "url": a.url,
                "source": a.source,
                "published": a.published.isoformat() if a.published else None,
                "categories": a.categories.split(", ") if a.categories else [],
            }
            for a in recent_articles
        ],
        "ioc_by_type": {row[0]: row[1] for row in ioc_types.all()},
        "articles_by_source": {row[0]: row[1] for row in source_counts.all()},
        "ioc_trend": ioc_trend,
    }
