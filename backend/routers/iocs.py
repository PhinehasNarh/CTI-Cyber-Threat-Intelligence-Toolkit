"""API routes for IOCs (Indicators of Compromise)."""

import json
import re
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select, func, desc, or_
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from models import IOC
from feeds.ioc_feeds import poll_all_ioc_feeds
from services.enrichment import enrich_ioc

router = APIRouter(prefix="/api/iocs", tags=["iocs"])

# Simple regex patterns for IOC type detection
IOC_PATTERNS = {
    "hash": re.compile(r"^[a-fA-F0-9]{32,64}$"),
    "ip": re.compile(r"^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$"),
    "domain": re.compile(r"^[a-zA-Z0-9]([a-zA-Z0-9\-]*\.)+[a-zA-Z]{2,}$"),
    "url": re.compile(r"^https?://"),
}


def detect_ioc_type(value: str) -> str:
    """Auto-detect the type of an IOC value."""
    for ioc_type, pattern in IOC_PATTERNS.items():
        if pattern.match(value):
            return ioc_type
    return "unknown"


@router.get("")
async def list_iocs(
    ioc_type: str | None = None,
    source: str | None = None,
    search: str | None = None,
    limit: int = Query(default=50, le=200),
    offset: int = Query(default=0, ge=0),
    db: AsyncSession = Depends(get_db),
):
    """List IOCs with optional filtering."""
    query = select(IOC).order_by(desc(IOC.first_seen))

    if ioc_type:
        query = query.where(IOC.ioc_type == ioc_type)
    if source:
        query = query.where(IOC.source == source)
    if search:
        pattern = f"%{search}%"
        query = query.where(
            or_(
                IOC.value.ilike(pattern),
                IOC.malware_family.ilike(pattern),
                IOC.tags.ilike(pattern),
            )
        )

    query = query.offset(offset).limit(limit)
    result = await db.execute(query)
    iocs = result.scalars().all()

    return {
        "count": len(iocs),
        "offset": offset,
        "iocs": [
            {
                "id": i.id,
                "ioc_type": i.ioc_type,
                "value": i.value,
                "source": i.source,
                "threat_type": i.threat_type,
                "malware_family": i.malware_family,
                "confidence": i.confidence,
                "first_seen": i.first_seen.isoformat() if i.first_seen else None,
                "tags": i.tags.split(", ") if i.tags else [],
            }
            for i in iocs
        ],
    }


@router.get("/stats")
async def ioc_stats(db: AsyncSession = Depends(get_db)):
    """Get IOC statistics — counts by type and source."""
    type_result = await db.execute(
        select(IOC.ioc_type, func.count(IOC.id))
        .group_by(IOC.ioc_type)
    )
    source_result = await db.execute(
        select(IOC.source, func.count(IOC.id))
        .group_by(IOC.source)
    )
    total = await db.execute(select(func.count(IOC.id)))

    return {
        "total": total.scalar() or 0,
        "by_type": {row[0]: row[1] for row in type_result.all()},
        "by_source": {row[0]: row[1] for row in source_result.all()},
    }


@router.post("/lookup")
async def lookup_ioc(value: str, ioc_type: str | None = None):
    """Lookup a single IOC against enrichment sources (VT, AbuseIPDB, Shodan).
    Auto-detects IOC type if not provided."""
    value = value.strip()
    if not ioc_type:
        ioc_type = detect_ioc_type(value)

    enrichments = await enrich_ioc(value, ioc_type)

    return {
        "value": value,
        "detected_type": ioc_type,
        "enrichments": enrichments,
    }


@router.post("/poll")
async def trigger_ioc_poll(db: AsyncSession = Depends(get_db)):
    """Manually trigger a poll of all IOC feeds."""
    results = await poll_all_ioc_feeds(db)
    total = sum(results.values())
    return {"status": "completed", "total_new": total, "per_source": results}
