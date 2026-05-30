"""API route for behavioural article clustering (#7)."""

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select, desc
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from models import FeedArticle
from services.clustering import cluster_articles

router = APIRouter(prefix="/api/clusters", tags=["clusters"])


@router.get("")
async def list_clusters(
    limit: int = Query(default=300, le=1000, description="Articles to cluster (most recent)"),
    threshold: float = Query(default=0.16, ge=0.05, le=0.6),
    db: AsyncSession = Depends(get_db),
):
    rows = (await db.execute(
        select(FeedArticle).order_by(desc(FeedArticle.fetched_at)).limit(limit)
    )).scalars().all()

    docs = [
        {"id": a.id, "title": a.title, "source": a.source, "text": f"{a.title}. {a.summary or ''}"}
        for a in rows
    ]
    clusters = cluster_articles(docs, threshold=threshold)
    return {
        "article_count": len(docs),
        "cluster_count": len(clusters),
        "clusters": clusters,
    }
