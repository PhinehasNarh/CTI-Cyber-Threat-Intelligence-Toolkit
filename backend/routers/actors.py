"""API routes for threat actor profiles."""

import json
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select, desc, or_
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from models import ThreatActor, IOC, FeedArticle
from services.audit import log_action

router = APIRouter(prefix="/api/actors", tags=["actors"])


class ActorCreate(BaseModel):
    name: str
    aliases: list[str] = []
    description: str = ""
    origin_country: str = ""
    motivation: str = ""
    confidence: int = 50
    attack_tags: str = ""


class ActorUpdate(BaseModel):
    aliases: list[str] | None = None
    description: str | None = None
    origin_country: str | None = None
    motivation: str | None = None
    confidence: int | None = None
    attack_tags: str | None = None


def _serialize(a: ThreatActor) -> dict:
    aliases = []
    if a.aliases:
        try:
            aliases = json.loads(a.aliases)
        except Exception:
            aliases = [a.aliases]
    return {
        "id": a.id,
        "name": a.name,
        "aliases": aliases,
        "description": a.description,
        "origin_country": a.origin_country,
        "motivation": a.motivation,
        "confidence": a.confidence,
        "attack_tags": a.attack_tags.split(", ") if a.attack_tags else [],
        "first_seen": a.first_seen.isoformat() if a.first_seen else None,
        "last_seen": a.last_seen.isoformat() if a.last_seen else None,
        "created_at": a.created_at.isoformat() if a.created_at else None,
    }


def _search_terms(actor: ThreatActor) -> list[str]:
    terms = [actor.name]
    if actor.aliases:
        try:
            terms += json.loads(actor.aliases)
        except Exception:
            pass
    return [t for t in terms if t]


@router.get("")
async def list_actors(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(ThreatActor).order_by(ThreatActor.name))
    actors = result.scalars().all()
    return {"count": len(actors), "actors": [_serialize(a) for a in actors]}


@router.post("")
async def create_actor(body: ActorCreate, db: AsyncSession = Depends(get_db)):
    existing = (
        await db.execute(select(ThreatActor).where(ThreatActor.name == body.name))
    ).scalar_one_or_none()
    if existing:
        raise HTTPException(status_code=409, detail="Actor already exists")

    actor = ThreatActor(
        name=body.name,
        aliases=json.dumps(body.aliases) if body.aliases else None,
        description=body.description or None,
        origin_country=body.origin_country or None,
        motivation=body.motivation or None,
        confidence=body.confidence,
        attack_tags=body.attack_tags or None,
    )
    db.add(actor)
    await db.flush()
    await log_action(db, "create", "actor", actor.id, f"Created threat actor '{actor.name}'")
    await db.commit()
    await db.refresh(actor)
    return _serialize(actor)


@router.get("/{actor_id}")
async def get_actor(actor_id: int, db: AsyncSession = Depends(get_db)):
    actor = (
        await db.execute(select(ThreatActor).where(ThreatActor.id == actor_id))
    ).scalar_one_or_none()
    if not actor:
        raise HTTPException(status_code=404, detail="Actor not found")

    terms = _search_terms(actor)

    # Related IOCs: match malware_family or tags
    ioc_clauses = [
        or_(IOC.malware_family.ilike(f"%{t}%"), IOC.tags.ilike(f"%{t}%"))
        for t in terms
    ]
    ioc_result = await db.execute(
        select(IOC)
        .where(or_(*ioc_clauses))
        .order_by(desc(IOC.threat_score))
        .limit(20)
    )
    iocs = ioc_result.scalars().all()

    # Related articles: match title or summary
    art_clauses = [
        or_(FeedArticle.title.ilike(f"%{t}%"), FeedArticle.summary.ilike(f"%{t}%"))
        for t in terms
    ]
    art_result = await db.execute(
        select(FeedArticle)
        .where(or_(*art_clauses))
        .order_by(desc(FeedArticle.published))
        .limit(10)
    )
    articles = art_result.scalars().all()

    return {
        **_serialize(actor),
        "related_iocs": [
            {"id": i.id, "ioc_type": i.ioc_type, "value": i.value,
             "threat_score": round(i.threat_score or 0, 1), "source": i.source}
            for i in iocs
        ],
        "related_articles": [
            {"id": a.id, "title": a.title, "source": a.source,
             "published": a.published.isoformat() if a.published else None}
            for a in articles
        ],
    }


@router.patch("/{actor_id}")
async def update_actor(actor_id: int, body: ActorUpdate, db: AsyncSession = Depends(get_db)):
    actor = (
        await db.execute(select(ThreatActor).where(ThreatActor.id == actor_id))
    ).scalar_one_or_none()
    if not actor:
        raise HTTPException(status_code=404, detail="Actor not found")

    if body.aliases is not None:
        actor.aliases = json.dumps(body.aliases)
    if body.description is not None:
        actor.description = body.description
    if body.origin_country is not None:
        actor.origin_country = body.origin_country
    if body.motivation is not None:
        actor.motivation = body.motivation
    if body.confidence is not None:
        actor.confidence = body.confidence
    if body.attack_tags is not None:
        actor.attack_tags = body.attack_tags

    await db.commit()
    return _serialize(actor)


@router.delete("/{actor_id}")
async def delete_actor(actor_id: int, db: AsyncSession = Depends(get_db)):
    actor = (
        await db.execute(select(ThreatActor).where(ThreatActor.id == actor_id))
    ).scalar_one_or_none()
    if not actor:
        raise HTTPException(status_code=404, detail="Actor not found")
    await log_action(db, "delete", "actor", actor_id, f"Deleted threat actor '{actor.name}'")
    await db.delete(actor)
    await db.commit()
    return {"deleted": actor_id}
