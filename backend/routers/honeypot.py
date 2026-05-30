"""Honeypot / canary integration (#37).

An inbound sink: when a honeypot or canary token fires, POST the attacker IP here
and it becomes a maximum-confidence IOC (source 'honeypot'). Live attacker data
feeds straight into the platform. No external dependency.
"""

import json
from datetime import datetime, timezone

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import select, desc
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from models import IOC
from services.audit import log_action

router = APIRouter(prefix="/api/honeypot", tags=["honeypot"])

HONEYPOT_SOURCE = "honeypot"
HONEYPOT_SCORE = 92.0


class HoneypotHit(BaseModel):
    source_ip: str
    token: str = ""        # which canary/honeypot fired
    detail: str = ""       # free-text context


@router.post("/hit")
async def record_hit(body: HoneypotHit, db: AsyncSession = Depends(get_db)):
    """Record a honeypot trigger. Upserts the IP as a high-confidence IOC."""
    ip = body.source_ip.strip()
    now = datetime.now(timezone.utc)
    raw = json.dumps({"token": body.token or None, "detail": body.detail or None, "fired_at": now.isoformat()})

    ioc = (await db.execute(select(IOC).where(IOC.value == ip))).scalar_one_or_none()
    if ioc:
        ioc.last_seen = now
        ioc.seen_count = (ioc.seen_count or 1) + 1
        ioc.confidence = 100
        ioc.threat_score = max(ioc.threat_score or 0, HONEYPOT_SCORE)
        ioc.threat_type = "honeypot"
        srcs = set(json.loads(ioc.sources) if ioc.sources else [ioc.source])
        srcs.add(HONEYPOT_SOURCE)
        ioc.sources = json.dumps(sorted(srcs))
        ioc.raw_data = raw
        created = False
    else:
        ioc = IOC(
            ioc_type="ip", value=ip, source=HONEYPOT_SOURCE, threat_type="honeypot",
            confidence=100, threat_score=HONEYPOT_SCORE, seen_count=1,
            sources=json.dumps([HONEYPOT_SOURCE]), tags="honeypot",
            first_seen=now, last_seen=now, raw_data=raw,
        )
        db.add(ioc)
        created = True

    await log_action(db, "create" if created else "update", "honeypot", ip,
                     f"Honeypot hit from {ip}" + (f" ({body.token})" if body.token else ""))
    await db.commit()
    await db.refresh(ioc)
    return {"status": "recorded", "created": created, "ioc_id": ioc.id, "value": ip, "threat_score": ioc.threat_score}


@router.get("/hits")
async def list_hits(limit: int = 50, db: AsyncSession = Depends(get_db)):
    rows = (await db.execute(
        select(IOC).where(IOC.source == HONEYPOT_SOURCE).order_by(desc(IOC.last_seen)).limit(limit)
    )).scalars().all()
    return {
        "count": len(rows),
        "hits": [
            {
                "id": i.id, "ip": i.value, "seen_count": i.seen_count,
                "first_seen": i.first_seen.isoformat() if i.first_seen else None,
                "last_seen": i.last_seen.isoformat() if i.last_seen else None,
                "detail": json.loads(i.raw_data) if i.raw_data else None,
            }
            for i in rows
        ],
    }
