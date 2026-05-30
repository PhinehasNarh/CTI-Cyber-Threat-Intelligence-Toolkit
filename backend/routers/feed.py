"""API routes for feed articles."""

import re
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy import select, func, desc, or_
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from models import FeedArticle, IOC, ThreatActor
from routers.workspaces import active_workspace
from feeds.rss_poller import poll_all_feeds
from services.summarizer import build_brief

router = APIRouter(prefix="/api/feed", tags=["feed"])

# Loose extraction patterns for scanning article text (Reading Mode, #20).
_EXTRACTORS = [
    ("url", re.compile(r"https?://[^\s<>\"')]+")),
    ("hash", re.compile(r"\b[a-fA-F0-9]{64}\b|\b[a-fA-F0-9]{40}\b|\b[a-fA-F0-9]{32}\b")),
    ("ip", re.compile(r"\b(?:\d{1,3}\.){3}\d{1,3}\b")),
    ("domain", re.compile(r"\b(?:[a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}\b")),
]
# Domains to ignore so every article URL host doesn't become an "IOC".
_DOMAIN_STOPLIST = {
    "bleepingcomputer.com", "krebsonsecurity.com", "thehackernews.com",
    "darkreading.com", "schneier.com", "sans.edu", "cisa.gov", "threatpost.com",
    "github.com", "twitter.com", "x.com", "microsoft.com", "google.com",
}


def _extract_iocs(text: str) -> list[dict]:
    """Scan text for IOC-shaped tokens, de-duplicated, most specific type wins."""
    found: dict[str, str] = {}
    for ioc_type, pattern in _EXTRACTORS:
        for match in pattern.findall(text or ""):
            val = match.rstrip(".,);]")
            if val in found:
                continue
            if ioc_type == "domain":
                low = val.lower()
                if low in _DOMAIN_STOPLIST or "." not in low:
                    continue
                # skip if this domain is just the tail of an already-found URL
                if any(val in u for u, t in found.items() if t == "url"):
                    continue
            found[val] = ioc_type
    return [{"value": v, "ioc_type": t} for v, t in found.items()]


@router.get("")
async def list_articles(
    source: str | None = None,
    search: str | None = None,
    starred: bool | None = None,
    unread: bool | None = None,
    limit: int = Query(default=50, le=200),
    offset: int = Query(default=0, ge=0),
    db: AsyncSession = Depends(get_db),
    ws: int = Depends(active_workspace),
):
    """List feed articles with optional filtering."""
    query = select(FeedArticle).where(FeedArticle.workspace_id == ws).order_by(desc(FeedArticle.published))

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
                "analyst_notes": a.analyst_notes,
                "analyst_tags": a.analyst_tags.split(", ") if a.analyst_tags else [],
                "assignee": a.assignee,
                "triage_status": a.triage_status or "new",
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


@router.get("/{article_id}/read")
async def read_article(article_id: int, db: AsyncSession = Depends(get_db)):
    """Reading-mode payload: the article plus IOCs detected in its text,
    each flagged with whether it is already a known indicator (#20)."""
    article = (await db.execute(
        select(FeedArticle).where(FeedArticle.id == article_id)
    )).scalar_one_or_none()
    if not article:
        raise HTTPException(status_code=404, detail="Article not found")

    detected = _extract_iocs(f"{article.title}\n{article.summary or ''}")
    values = [d["value"] for d in detected]
    known: dict[str, IOC] = {}
    if values:
        rows = (await db.execute(select(IOC).where(IOC.value.in_(values)))).scalars().all()
        known = {i.value: i for i in rows}

    return {
        "id": article.id,
        "title": article.title,
        "url": article.url,
        "source": article.source,
        "summary": article.summary,
        "published": article.published.isoformat() if article.published else None,
        "categories": article.categories.split(", ") if article.categories else [],
        "analyst_notes": article.analyst_notes,
        "analyst_tags": article.analyst_tags.split(", ") if article.analyst_tags else [],
        "is_read": article.is_read,
        "is_starred": article.is_starred,
        "detected_iocs": [
            {
                **d,
                "known": d["value"] in known,
                "threat_score": round(known[d["value"]].threat_score or 0, 1) if d["value"] in known else None,
                "ioc_id": known[d["value"]].id if d["value"] in known else None,
            }
            for d in detected
        ],
    }


@router.get("/{article_id}/brief")
async def article_brief(article_id: int, db: AsyncSession = Depends(get_db)):
    """Quick Brief (#2): extractive summary + detected actors, industries, and
    ATT&CK techniques. Heuristic, runs offline, no API keys required."""
    article = (await db.execute(
        select(FeedArticle).where(FeedArticle.id == article_id)
    )).scalar_one_or_none()
    if not article:
        raise HTTPException(status_code=404, detail="Article not found")

    # Fold curated actor names so DB-tracked actors are recognised in text
    actor_names = [n for (n,) in (await db.execute(select(ThreatActor.name))).all()]

    brief = build_brief(article.title, article.summary, extra_actor_terms=actor_names)
    return {"id": article.id, "title": article.title, **brief}


@router.patch("/{article_id}")
async def update_article(
    article_id: int,
    is_read: bool | None = None,
    is_starred: bool | None = None,
    analyst_notes: str | None = None,
    analyst_tags: str | None = None,
    assignee: str | None = None,
    triage_status: str | None = None,
    db: AsyncSession = Depends(get_db),
):
    """Update article state, analyst notes, tags, assignment, or triage status."""
    from services.audit import log_action
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
    if analyst_notes is not None:
        article.analyst_notes = analyst_notes or None
    if analyst_tags is not None:
        article.analyst_tags = analyst_tags or None
    if assignee is not None:
        article.assignee = assignee or None
        await log_action(db, "update", "article", article_id, f"Assigned article to {assignee or 'unassigned'}")
    if triage_status is not None:
        article.triage_status = triage_status
        await log_action(db, "update", "article", article_id, f"Set article triage status to {triage_status}")

    await db.commit()
    return {"status": "updated", "id": article_id}


@router.post("/poll")
async def trigger_poll(db: AsyncSession = Depends(get_db)):
    """Manually trigger a poll of all RSS feeds."""
    results = await poll_all_feeds(db)
    total = sum(results.values())
    return {"status": "completed", "total_new": total, "per_source": results}
