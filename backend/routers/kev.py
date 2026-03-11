"""API routes for CISA KEV catalog."""

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select, func, desc
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from models import CVE
from feeds.kev_sync import sync_kev_catalog

router = APIRouter(prefix="/api/kev", tags=["kev"])


@router.get("")
async def list_kevs(
    search: str | None = None,
    severity: str | None = None,
    limit: int = Query(default=50, le=200),
    offset: int = Query(default=0, ge=0),
    db: AsyncSession = Depends(get_db),
):
    """List CVEs in the CISA KEV catalog."""
    query = select(CVE).where(CVE.in_cisa_kev == True).order_by(desc(CVE.published_date))

    if search:
        pattern = f"%{search}%"
        query = query.where(
            CVE.cve_id.ilike(pattern) |
            CVE.description.ilike(pattern) |
            CVE.affected_products.ilike(pattern)
        )
    if severity:
        query = query.where(CVE.severity == severity)

    query = query.offset(offset).limit(limit)
    result = await db.execute(query)
    cves = result.scalars().all()

    total_result = await db.execute(
        select(func.count(CVE.id)).where(CVE.in_cisa_kev == True)
    )

    return {
        "total": total_result.scalar() or 0,
        "count": len(cves),
        "offset": offset,
        "cves": [
            {
                "id": c.id,
                "cve_id": c.cve_id,
                "description": c.description,
                "cvss_score": c.cvss_score,
                "severity": c.severity,
                "affected_products": c.affected_products,
                "published_date": c.published_date.isoformat() if c.published_date else None,
                "has_exploit": c.has_exploit,
                "references": c.references,
            }
            for c in cves
        ],
    }


@router.get("/stats")
async def kev_stats(db: AsyncSession = Depends(get_db)):
    """KEV catalog statistics."""
    total = await db.execute(
        select(func.count(CVE.id)).where(CVE.in_cisa_kev == True)
    )
    by_severity = await db.execute(
        select(CVE.severity, func.count(CVE.id))
        .where(CVE.in_cisa_kev == True)
        .group_by(CVE.severity)
    )
    return {
        "total": total.scalar() or 0,
        "by_severity": {row[0]: row[1] for row in by_severity.all()},
    }


@router.post("/sync")
async def trigger_kev_sync(db: AsyncSession = Depends(get_db)):
    """Manually sync the CISA KEV catalog."""
    count = await sync_kev_catalog(db)
    return {"status": "completed", "new_cves": count}
