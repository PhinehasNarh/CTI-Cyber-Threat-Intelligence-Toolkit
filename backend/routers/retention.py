"""API routes for data retention policies (#33)."""

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from models import RetentionPolicy, FeedArticle, IOC
from services.retention import preview_policy, run_policy

router = APIRouter(prefix="/api/retention", tags=["retention"])


class PolicyCreate(BaseModel):
    entity_type: str            # article | ioc
    source: str = ""
    max_age_days: int = 90
    is_active: bool = False


def _serialize(p: RetentionPolicy) -> dict:
    return {
        "id": p.id,
        "entity_type": p.entity_type,
        "source": p.source,
        "max_age_days": p.max_age_days,
        "is_active": p.is_active,
        "last_run": p.last_run.isoformat() if p.last_run else None,
        "last_purged": p.last_purged,
        "created_at": p.created_at.isoformat() if p.created_at else None,
    }


@router.get("")
async def list_policies(db: AsyncSession = Depends(get_db)):
    policies = (await db.execute(select(RetentionPolicy).order_by(RetentionPolicy.entity_type))).scalars().all()
    out = []
    for p in policies:
        d = _serialize(p)
        d["would_purge"] = await preview_policy(db, p)
        out.append(d)

    # Storage overview
    art_total = (await db.execute(select(func.count(FeedArticle.id)))).scalar() or 0
    ioc_total = (await db.execute(select(func.count(IOC.id)))).scalar() or 0
    oldest_art = (await db.execute(select(func.min(FeedArticle.fetched_at)))).scalar()
    oldest_ioc = (await db.execute(select(func.min(IOC.first_seen)))).scalar()
    return {
        "count": len(out),
        "policies": out,
        "storage": {
            "articles": art_total,
            "iocs": ioc_total,
            "oldest_article": oldest_art.isoformat() if oldest_art else None,
            "oldest_ioc": oldest_ioc.isoformat() if oldest_ioc else None,
        },
    }


@router.post("")
async def create_policy(body: PolicyCreate, db: AsyncSession = Depends(get_db)):
    if body.entity_type not in ("article", "ioc"):
        raise HTTPException(status_code=400, detail="entity_type must be 'article' or 'ioc'")
    if body.max_age_days < 1:
        raise HTTPException(status_code=400, detail="max_age_days must be >= 1")
    p = RetentionPolicy(
        entity_type=body.entity_type,
        source=body.source or None,
        max_age_days=body.max_age_days,
        is_active=body.is_active,
    )
    db.add(p)
    await db.commit()
    await db.refresh(p)
    return _serialize(p)


@router.patch("/{policy_id}")
async def toggle_policy(policy_id: int, is_active: bool, db: AsyncSession = Depends(get_db)):
    p = (await db.execute(select(RetentionPolicy).where(RetentionPolicy.id == policy_id))).scalar_one_or_none()
    if not p:
        raise HTTPException(status_code=404, detail="Policy not found")
    p.is_active = is_active
    await db.commit()
    return _serialize(p)


@router.delete("/{policy_id}")
async def delete_policy(policy_id: int, db: AsyncSession = Depends(get_db)):
    p = (await db.execute(select(RetentionPolicy).where(RetentionPolicy.id == policy_id))).scalar_one_or_none()
    if not p:
        raise HTTPException(status_code=404, detail="Policy not found")
    await db.delete(p)
    await db.commit()
    return {"deleted": policy_id}


@router.post("/{policy_id}/run")
async def run_now(policy_id: int, db: AsyncSession = Depends(get_db)):
    """Apply the policy immediately. Destructive: purges matching rows."""
    p = (await db.execute(select(RetentionPolicy).where(RetentionPolicy.id == policy_id))).scalar_one_or_none()
    if not p:
        raise HTTPException(status_code=404, detail="Policy not found")
    purged = await run_policy(db, p)
    return {"policy_id": policy_id, "purged": purged}
