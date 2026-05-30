"""API routes for threat campaign tracking."""

from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select, desc, func
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from models import Campaign, CampaignIOC, CampaignArticle, IOC, FeedArticle
from services.audit import log_action

router = APIRouter(prefix="/api/campaigns", tags=["campaigns"])


class CampaignCreate(BaseModel):
    name: str
    description: str = ""
    status: str = "active"
    confidence: int = 50
    threat_actor: str = ""
    start_date: str | None = None  # ISO date string


class CampaignUpdate(BaseModel):
    description: str | None = None
    status: str | None = None
    confidence: int | None = None
    threat_actor: str | None = None
    end_date: str | None = None


def _parse_date(s: str | None) -> datetime | None:
    if not s:
        return None
    try:
        return datetime.fromisoformat(s)
    except Exception:
        return None


def _serialize(c: Campaign, ioc_count: int = 0, article_count: int = 0) -> dict:
    return {
        "id": c.id,
        "name": c.name,
        "description": c.description,
        "status": c.status,
        "confidence": c.confidence,
        "threat_actor": c.threat_actor,
        "start_date": c.start_date.isoformat() if c.start_date else None,
        "end_date": c.end_date.isoformat() if c.end_date else None,
        "created_at": c.created_at.isoformat() if c.created_at else None,
        "ioc_count": ioc_count,
        "article_count": article_count,
    }


@router.get("")
async def list_campaigns(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Campaign).order_by(desc(Campaign.created_at)))
    campaigns = result.scalars().all()

    out = []
    for c in campaigns:
        ic = (await db.execute(
            select(func.count()).where(CampaignIOC.campaign_id == c.id)
        )).scalar() or 0
        ac = (await db.execute(
            select(func.count()).where(CampaignArticle.campaign_id == c.id)
        )).scalar() or 0
        out.append(_serialize(c, ic, ac))

    return {"count": len(out), "campaigns": out}


@router.post("")
async def create_campaign(body: CampaignCreate, db: AsyncSession = Depends(get_db)):
    existing = (await db.execute(
        select(Campaign).where(Campaign.name == body.name)
    )).scalar_one_or_none()
    if existing:
        raise HTTPException(status_code=409, detail="Campaign name already exists")

    c = Campaign(
        name=body.name,
        description=body.description or None,
        status=body.status,
        confidence=body.confidence,
        threat_actor=body.threat_actor or None,
        start_date=_parse_date(body.start_date),
    )
    db.add(c)
    await db.flush()
    await log_action(db, "create", "campaign", c.id, f"Created campaign '{c.name}'")
    await db.commit()
    await db.refresh(c)
    return _serialize(c)


@router.get("/{campaign_id}")
async def get_campaign(campaign_id: int, db: AsyncSession = Depends(get_db)):
    c = (await db.execute(
        select(Campaign).where(Campaign.id == campaign_id)
    )).scalar_one_or_none()
    if not c:
        raise HTTPException(status_code=404, detail="Campaign not found")

    ioc_ids_result = await db.execute(
        select(CampaignIOC.ioc_id).where(CampaignIOC.campaign_id == campaign_id)
    )
    ioc_ids = [row[0] for row in ioc_ids_result.all()]

    iocs = []
    if ioc_ids:
        ioc_result = await db.execute(
            select(IOC).where(IOC.id.in_(ioc_ids)).order_by(desc(IOC.threat_score))
        )
        iocs = [
            {"id": i.id, "ioc_type": i.ioc_type, "value": i.value,
             "threat_score": round(i.threat_score or 0, 1),
             "source": i.source, "malware_family": i.malware_family}
            for i in ioc_result.scalars().all()
        ]

    art_ids_result = await db.execute(
        select(CampaignArticle.article_id).where(CampaignArticle.campaign_id == campaign_id)
    )
    art_ids = [row[0] for row in art_ids_result.all()]

    articles = []
    if art_ids:
        art_result = await db.execute(
            select(FeedArticle).where(FeedArticle.id.in_(art_ids)).order_by(desc(FeedArticle.published))
        )
        articles = [
            {"id": a.id, "title": a.title, "source": a.source,
             "published": a.published.isoformat() if a.published else None, "url": a.url}
            for a in art_result.scalars().all()
        ]

    return {**_serialize(c, len(iocs), len(articles)), "iocs": iocs, "articles": articles}


@router.patch("/{campaign_id}")
async def update_campaign(campaign_id: int, body: CampaignUpdate, db: AsyncSession = Depends(get_db)):
    c = (await db.execute(
        select(Campaign).where(Campaign.id == campaign_id)
    )).scalar_one_or_none()
    if not c:
        raise HTTPException(status_code=404, detail="Campaign not found")

    if body.description is not None:
        c.description = body.description
    if body.status is not None:
        c.status = body.status
    if body.confidence is not None:
        c.confidence = body.confidence
    if body.threat_actor is not None:
        c.threat_actor = body.threat_actor
    if body.end_date is not None:
        c.end_date = _parse_date(body.end_date)

    await db.commit()
    return _serialize(c)


@router.delete("/{campaign_id}")
async def delete_campaign(campaign_id: int, db: AsyncSession = Depends(get_db)):
    c = (await db.execute(
        select(Campaign).where(Campaign.id == campaign_id)
    )).scalar_one_or_none()
    if not c:
        raise HTTPException(status_code=404, detail="Campaign not found")
    await log_action(db, "delete", "campaign", campaign_id, f"Deleted campaign '{c.name}'")
    await db.delete(c)
    await db.commit()
    return {"deleted": campaign_id}


@router.post("/{campaign_id}/iocs")
async def add_ioc(campaign_id: int, ioc_value: str, db: AsyncSession = Depends(get_db)):
    c = (await db.execute(select(Campaign).where(Campaign.id == campaign_id))).scalar_one_or_none()
    if not c:
        raise HTTPException(status_code=404, detail="Campaign not found")

    ioc = (await db.execute(select(IOC).where(IOC.value == ioc_value))).scalar_one_or_none()
    if not ioc:
        raise HTTPException(status_code=404, detail="IOC not found — lookup the value in IOC Explorer first")

    existing = (await db.execute(
        select(CampaignIOC).where(
            CampaignIOC.campaign_id == campaign_id, CampaignIOC.ioc_id == ioc.id
        )
    )).scalar_one_or_none()
    if existing:
        raise HTTPException(status_code=409, detail="IOC already in campaign")

    db.add(CampaignIOC(campaign_id=campaign_id, ioc_id=ioc.id))
    await db.commit()
    return {"added": ioc_value, "ioc_id": ioc.id}


@router.delete("/{campaign_id}/iocs/{ioc_id}")
async def remove_ioc(campaign_id: int, ioc_id: int, db: AsyncSession = Depends(get_db)):
    link = (await db.execute(
        select(CampaignIOC).where(
            CampaignIOC.campaign_id == campaign_id, CampaignIOC.ioc_id == ioc_id
        )
    )).scalar_one_or_none()
    if not link:
        raise HTTPException(status_code=404, detail="Link not found")
    await db.delete(link)
    await db.commit()
    return {"removed": ioc_id}


@router.post("/{campaign_id}/articles")
async def add_article(campaign_id: int, article_id: int, db: AsyncSession = Depends(get_db)):
    c = (await db.execute(select(Campaign).where(Campaign.id == campaign_id))).scalar_one_or_none()
    if not c:
        raise HTTPException(status_code=404, detail="Campaign not found")

    existing_link = (await db.execute(
        select(CampaignArticle).where(
            CampaignArticle.campaign_id == campaign_id, CampaignArticle.article_id == article_id
        )
    )).scalar_one_or_none()
    if existing_link:
        raise HTTPException(status_code=409, detail="Article already in campaign")

    db.add(CampaignArticle(campaign_id=campaign_id, article_id=article_id))
    await db.commit()
    return {"added_article": article_id}
