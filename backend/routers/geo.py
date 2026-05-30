"""Geographic distribution / world threat map (#17)."""

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select, desc
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from models import IOC
from services.geo import geolocate

router = APIRouter(prefix="/api/geo", tags=["geo"])


@router.get("/map")
async def threat_map(limit: int = Query(default=150, le=500), db: AsyncSession = Depends(get_db)):
    rows = (await db.execute(
        select(IOC).where(IOC.ioc_type == "ip").order_by(desc(IOC.threat_score)).limit(limit)
    )).scalars().all()

    if not rows:
        return {"available": True, "point_count": 0, "points": [], "by_country": [], "ips_total": 0}

    score_by_ip = {i.value: round(i.threat_score or 0, 1) for i in rows}
    resolved, reachable = await geolocate(list(score_by_ip.keys()))

    points = []
    country_counts: dict[str, dict] = {}
    for ip, geo in resolved.items():
        points.append({
            "ip": ip,
            "lat": geo.get("lat"),
            "lon": geo.get("lon"),
            "country": geo.get("country"),
            "country_code": geo.get("countryCode"),
            "city": geo.get("city"),
            "isp": geo.get("isp"),
            "score": score_by_ip.get(ip, 0),
        })
        cc = geo.get("countryCode") or "??"
        c = country_counts.setdefault(cc, {"country_code": cc, "country": geo.get("country"), "count": 0})
        c["count"] += 1

    by_country = sorted(country_counts.values(), key=lambda x: -x["count"])
    return {
        "available": reachable,
        "ips_total": len(score_by_ip),
        "point_count": len(points),
        "points": points,
        "by_country": by_country,
    }
