"""API routes for feed articles."""

from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select, func, desc, or_
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from models import FeedArticle
from feeds.rss_poller import poll_all_feeds

router = APIRouter(prefix="/api/feed", tags=["feed"])


@router.get("")
async def list_articles(
    source: str | None = None,
    search: str | None = None,
    starred: bool | None = None,
    unread: bool | None = None,
    limit: int = Query(default=50, le=200),
    offset: int = Query(default=0, ge=0),
    db: AsyncSession = Depends(get_db),
):
    """List feed articles with optional filtering."""
    query = select(FeedArticle).order_by(desc(FeedArticle.published))

    if source:
        query = query.where(FeedArticle.source == source)
    if search:
        pattern = f"%{search}%"
        query = query.where(
            or_(
                FeedArticle.title.ilike(pattern),
                FeedArticle.summary.ilike(pattern),
                FeedArticle.categories.ilike(pattern),
            )
        )
    if starred is not None:
        query = query.where(FeedArticle.is_starred == starred)
    if unread is not None:
        query = query.where(FeedArticle.is_read == (not unread))

    query = query.offset(offset).limit(limit)
    result = await db.execute(query)
    articles = result.scalars().all()

    return {
        "count": len(articles),
        "offset": offset,
        "articles": [
            {
                "id": a.id,
                "title": a.title,
                "url": a.url,
                "source": a.source,
                "summary": a.summary,
                "published": a.published.isoformat() if a.published else None,
                "categories": a.categories.split(", ") if a.categories else [],
                "is_read": a.is_read,
                "is_starred": a.is_starred,
                "relevance_score": a.relevance_score,
            }
            for a in articles
        ],
    }


@router.get("/sources")
async def list_sources(db: AsyncSession = Depends(get_db)):
    """List all feed sources with article counts."""
    result = await db.execute(
        select(FeedArticle.source, func.count(FeedArticle.id))
        .group_by(FeedArticle.source)
        .order_by(func.count(FeedArticle.id).desc())
    )
    return {"sources": [{"name": row[0], "count": row[1]} for row in result.all()]}


@router.patch("/{article_id}")
async def update_article(
    article_id: int,
    is_read: bool | None = None,
    is_starred: bool | None = None,
    db: AsyncSession = Depends(get_db),
):
    """Mark an article as read/starred."""
    result = await db.execute(
        select(FeedArticle).where(FeedArticle.id == article_id)
    )
    article = result.scalar_one_or_none()
    if not article:
        return {"error": "Article not found"}, 404

    if is_read is not None:
        article.is_read = is_read
    if is_starred is not None:
        article.is_starred = is_starred

    await db.commit()
    return {"status": "updated", "id": article_id}


@router.post("/poll")
async def trigger_poll(db: AsyncSession = Depends(get_db)):
    """Manually trigger a poll of all RSS feeds."""
    results = await poll_all_feeds(db)
    total = sum(results.values())
    return {"status": "completed", "total_new": total, "per_source": results}
