"""Public REST API v1 (#26) + inbound webhook sink (#27).

Key-authenticated, rate-limited endpoints for external tools (SIEM integration,
webhook submissions). Read endpoints need scope 'read'; ingest needs 'ingest'.
"""

from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy import select, desc
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from models import IOC, ApiKey
from services.apikey_auth import require_key, require_ingest
from feeds.ioc_feeds import _upsert_ioc, _apply_score
from services.watchlist_checker import check_watchlist
from services.alert_engine import evaluate_rules

router = APIRouter(prefix="/api/v1", tags=["public-api"])

_DETECT = {
    "hash": lambda v: len(v) in (32, 40, 64) and all(c in "0123456789abcdefABCDEF" for c in v),
    "url": lambda v: v.startswith("http://") or v.startswith("https://"),
    "ip": lambda v: v.count(".") == 3 and all(p.isdigit() for p in v.split(".")),
}


def _detect_type(v: str) -> str:
    for t, fn in _DETECT.items():
        if fn(v):
            return t
    return "domain" if "." in v else "unknown"


def _serialize(i: IOC) -> dict:
    return {
        "id": i.id, "type": i.ioc_type, "value": i.value, "source": i.source,
        "malware_family": i.malware_family, "threat_type": i.threat_type,
        "confidence": i.confidence, "threat_score": round(i.threat_score or 0, 1),
        "first_seen": i.first_seen.isoformat() if i.first_seen else None,
        "last_seen": i.last_seen.isoformat() if i.last_seen else None,
    }


@router.get("/iocs")
async def public_list_iocs(
    type: str | None = None,
    since: str | None = Query(default=None, description="e.g. 24h, 7d"),
    min_score: float = 0.0,
    limit: int = Query(default=100, le=1000),
    db: AsyncSession = Depends(get_db),
    key: ApiKey = Depends(require_key),
):
    q = select(IOC).order_by(desc(IOC.threat_score))
    if type:
        q = q.where(IOC.ioc_type == type)
    if min_score:
        q = q.where(IOC.threat_score >= min_score)
    if since:
        try:
            n, unit = int(since[:-1]), since[-1]
            delta = {"h": timedelta(hours=n), "d": timedelta(days=n)}[unit]
            q = q.where(IOC.first_seen >= datetime.now(timezone.utc) - delta)
        except (ValueError, KeyError):
            pass
    rows = (await db.execute(q.limit(limit))).scalars().all()
    return {"count": len(rows), "iocs": [_serialize(i) for i in rows]}


@router.get("/iocs/{value}")
async def public_get_ioc(value: str, db: AsyncSession = Depends(get_db), key: ApiKey = Depends(require_key)):
    from fastapi import HTTPException
    i = (await db.execute(select(IOC).where(IOC.value == value))).scalar_one_or_none()
    if not i:
        raise HTTPException(status_code=404, detail="IOC not found")
    return _serialize(i)


class IngestItem(BaseModel):
    value: str
    ioc_type: str = ""
    threat_type: str = ""
    malware_family: str = ""
    confidence: int = 60
    tags: str = ""


class IngestBatch(BaseModel):
    iocs: list[IngestItem]


@router.post("/iocs")
async def public_ingest(
    batch: IngestBatch,
    db: AsyncSession = Depends(get_db),
    key: ApiKey = Depends(require_ingest),
):
    """Inbound webhook sink: external tools POST IOCs which are upserted, scored,
    and run through watchlist + alert rules (#27)."""
    created, updated = 0, 0
    for item in batch.iocs:
        value = item.value.strip()
        if not value:
            continue
        ioc, is_new = await _upsert_ioc(
            db,
            ioc_type=item.ioc_type or _detect_type(value),
            value=value[:1000],
            source=f"webhook:{key.name}",
            threat_type=item.threat_type or None,
            malware_family=item.malware_family or None,
            confidence=item.confidence,
            tags=item.tags or "",
        )
        if is_new:
            await check_watchlist(ioc, db)
            await evaluate_rules(ioc, db)
            created += 1
        else:
            updated += 1
    await db.commit()
    return {"ingested": created + updated, "created": created, "updated": updated}
