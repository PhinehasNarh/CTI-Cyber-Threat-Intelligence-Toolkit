"""Unified triage queue across IOCs and articles (#23).

Surfaces the highest-signal items (top-scoring IOCs, most recent articles) with
their triage status, assignee, notes and tags so analysts can work a single queue.
Status changes are made through the existing PATCH endpoints on /api/iocs and /api/feed.
"""

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select, func, desc
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from models import IOC, FeedArticle

router = APIRouter(prefix="/api/triage", tags=["triage"])

OPEN_STATUSES = ("new", "in_review")


def _ioc_item(i: IOC) -> dict:
    return {
        "kind": "ioc",
        "id": i.id,
        "title": i.value,
        "subtitle": i.malware_family or i.threat_type or i.ioc_type,
        "score": round(i.threat_score or 0, 1),
        "triage_status": i.triage_status or "new",
        "assignee": i.assignee,
        "analyst_tags": i.analyst_tags.split(", ") if i.analyst_tags else [],
        "analyst_notes": i.analyst_notes,
    }


def _article_item(a: FeedArticle) -> dict:
    return {
        "kind": "article",
        "id": a.id,
        "title": a.title,
        "subtitle": a.source,
        "score": round(a.relevance_score or 0, 1),
        "url": a.url,
        "triage_status": a.triage_status or "new",
        "assignee": a.assignee,
        "analyst_tags": a.analyst_tags.split(", ") if a.analyst_tags else [],
        "analyst_notes": a.analyst_notes,
    }


@router.get("")
async def triage_queue(
    status: str | None = Query(default=None, description="Filter to a single triage status"),
    assignee: str | None = None,
    kind: str = Query(default="all", pattern="^(all|ioc|article)$"),
    limit: int = Query(default=50, le=200),
    db: AsyncSession = Depends(get_db),
):
    items: list[dict] = []

    if kind in ("all", "ioc"):
        q = select(IOC).order_by(desc(IOC.threat_score))
        if status:
            q = q.where(IOC.triage_status == status)
        if assignee:
            q = q.where(IOC.assignee == assignee)
        rows = (await db.execute(q.limit(limit))).scalars().all()
        items.extend(_ioc_item(i) for i in rows)

    if kind in ("all", "article"):
        q = select(FeedArticle).order_by(desc(FeedArticle.published))
        if status:
            q = q.where(FeedArticle.triage_status == status)
        if assignee:
            q = q.where(FeedArticle.assignee == assignee)
        rows = (await db.execute(q.limit(limit))).scalars().all()
        items.extend(_article_item(a) for a in rows)

    # Open items first, then by score
    status_rank = {"new": 0, "in_review": 1, "resolved": 2, "false_positive": 3}
    items.sort(key=lambda it: (status_rank.get(it["triage_status"], 9), -it["score"]))

    return {"count": len(items), "items": items[:limit]}


@router.get("/summary")
async def triage_summary(db: AsyncSession = Depends(get_db)):
    """Counts by triage status and by assignee across both entity types."""
    out: dict[str, int] = {}
    for model in (IOC, FeedArticle):
        res = await db.execute(
            select(model.triage_status, func.count(model.id)).group_by(model.triage_status)
        )
        for st, c in res.all():
            key = st or "new"
            out[key] = out.get(key, 0) + c

    assignees: dict[str, int] = {}
    for model in (IOC, FeedArticle):
        res = await db.execute(
            select(model.assignee, func.count(model.id))
            .where(model.assignee.is_not(None))
            .group_by(model.assignee)
        )
        for who, c in res.all():
            assignees[who] = assignees.get(who, 0) + c

    open_count = sum(out.get(s, 0) for s in OPEN_STATUSES)
    return {"by_status": out, "by_assignee": assignees, "open": open_count}
