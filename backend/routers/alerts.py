"""API routes for alert rules and hits."""

import json
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select, desc
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from models import AlertRule, AlertHit
from services.audit import log_action

router = APIRouter(prefix="/api/alerts", tags=["alerts"])


class RuleCreate(BaseModel):
    name: str
    severity: str = "medium"
    ioc_types: list[str] = []
    sources: list[str] = []
    keywords: list[str] = []
    min_confidence: int = 0
    min_score: float = 0.0
    webhook_url: str = ""


def _serialize_rule(r: AlertRule) -> dict:
    try:
        cond = json.loads(r.conditions)
    except Exception:
        cond = {}
    try:
        action = json.loads(r.action) if r.action else {}
    except Exception:
        action = {}
    return {
        "id": r.id,
        "name": r.name,
        "severity": r.severity,
        "is_active": r.is_active,
        "hit_count": r.hit_count,
        "conditions": cond,
        "webhook_url": action.get("webhook_url", ""),
        "created_at": r.created_at.isoformat() if r.created_at else None,
    }


@router.get("/rules")
async def list_rules(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(AlertRule).order_by(desc(AlertRule.hit_count)))
    rules = result.scalars().all()
    return {"count": len(rules), "rules": [_serialize_rule(r) for r in rules]}


@router.post("/rules")
async def create_rule(body: RuleCreate, db: AsyncSession = Depends(get_db)):
    conditions = json.dumps({
        "ioc_types": body.ioc_types,
        "sources": body.sources,
        "keywords": body.keywords,
        "min_confidence": body.min_confidence,
        "min_score": body.min_score,
    })
    action = json.dumps({"webhook_url": body.webhook_url}) if body.webhook_url else None
    rule = AlertRule(
        name=body.name,
        severity=body.severity,
        conditions=conditions,
        action=action,
    )
    db.add(rule)
    await db.flush()
    await log_action(db, "create", "alert_rule", rule.id, f"Created alert rule '{rule.name}'")
    await db.commit()
    await db.refresh(rule)
    return _serialize_rule(rule)


@router.patch("/rules/{rule_id}")
async def update_rule(
    rule_id: int,
    is_active: bool | None = None,
    db: AsyncSession = Depends(get_db),
):
    rule = (await db.execute(select(AlertRule).where(AlertRule.id == rule_id))).scalar_one_or_none()
    if not rule:
        raise HTTPException(status_code=404, detail="Rule not found")
    if is_active is not None:
        rule.is_active = is_active
    await db.commit()
    return _serialize_rule(rule)


@router.delete("/rules/{rule_id}")
async def delete_rule(rule_id: int, db: AsyncSession = Depends(get_db)):
    rule = (await db.execute(select(AlertRule).where(AlertRule.id == rule_id))).scalar_one_or_none()
    if not rule:
        raise HTTPException(status_code=404, detail="Rule not found")
    await log_action(db, "delete", "alert_rule", rule_id, f"Deleted alert rule '{rule.name}'")
    await db.delete(rule)
    await db.commit()
    return {"deleted": rule_id}


@router.get("/hits")
async def list_hits(limit: int = 50, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(AlertHit).order_by(desc(AlertHit.hit_at)).limit(limit)
    )
    hits = result.scalars().all()

    rule_ids = {h.rule_id for h in hits}
    rule_map = {}
    if rule_ids:
        rr = await db.execute(select(AlertRule).where(AlertRule.id.in_(rule_ids)))
        rule_map = {r.id: r for r in rr.scalars().all()}

    return {
        "count": len(hits),
        "hits": [
            {
                "id": h.id,
                "rule_id": h.rule_id,
                "rule_name": rule_map[h.rule_id].name if h.rule_id in rule_map else None,
                "ioc_id": h.ioc_id,
                "ioc_value": h.ioc_value,
                "ioc_type": h.ioc_type,
                "severity": h.severity,
                "hit_at": h.hit_at.isoformat() if h.hit_at else None,
            }
            for h in hits
        ],
    }
