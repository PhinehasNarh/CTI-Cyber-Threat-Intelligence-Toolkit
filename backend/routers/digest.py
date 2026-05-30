"""Auto-generated threat intelligence digest (#24).

Summarises a rolling window: top articles, new IOCs by type, top malware families,
alert activity, and most active sources. Also renders a copy-paste Markdown brief.
"""

from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select, func, desc
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from models import FeedArticle, IOC, AlertHit

router = APIRouter(prefix="/api/digest", tags=["digest"])


async def _build(db: AsyncSession, days: int) -> dict:
    since = datetime.now(timezone.utc) - timedelta(days=days)

    # Articles in window (use fetched_at, always populated)
    art_total = (await db.execute(
        select(func.count(FeedArticle.id)).where(FeedArticle.fetched_at >= since)
    )).scalar() or 0
    top_articles = (await db.execute(
        select(FeedArticle)
        .where(FeedArticle.fetched_at >= since)
        .order_by(desc(FeedArticle.relevance_score), desc(FeedArticle.published))
        .limit(5)
    )).scalars().all()
    top_sources = (await db.execute(
        select(FeedArticle.source, func.count(FeedArticle.id))
        .where(FeedArticle.fetched_at >= since)
        .group_by(FeedArticle.source)
        .order_by(desc(func.count(FeedArticle.id)))
        .limit(5)
    )).all()

    # IOCs in window
    ioc_total = (await db.execute(
        select(func.count(IOC.id)).where(IOC.first_seen >= since)
    )).scalar() or 0
    ioc_by_type = (await db.execute(
        select(IOC.ioc_type, func.count(IOC.id))
        .where(IOC.first_seen >= since)
        .group_by(IOC.ioc_type)
    )).all()
    top_families = (await db.execute(
        select(IOC.malware_family, func.count(IOC.id))
        .where(IOC.first_seen >= since, IOC.malware_family.is_not(None))
        .group_by(IOC.malware_family)
        .order_by(desc(func.count(IOC.id)))
        .limit(5)
    )).all()
    top_iocs = (await db.execute(
        select(IOC)
        .where(IOC.first_seen >= since)
        .order_by(desc(IOC.threat_score))
        .limit(5)
    )).scalars().all()

    # Alerts in window
    alerts_by_sev = (await db.execute(
        select(AlertHit.severity, func.count(AlertHit.id))
        .where(AlertHit.hit_at >= since)
        .group_by(AlertHit.severity)
    )).all()

    return {
        "window_days": days,
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "articles": {
            "total": art_total,
            "top": [
                {"id": a.id, "title": a.title, "source": a.source, "url": a.url,
                 "published": a.published.isoformat() if a.published else None}
                for a in top_articles
            ],
            "top_sources": [{"source": s, "count": c} for s, c in top_sources],
        },
        "iocs": {
            "total": ioc_total,
            "by_type": {t: c for t, c in ioc_by_type},
            "top_families": [{"family": f, "count": c} for f, c in top_families],
            "top": [
                {"id": i.id, "value": i.value, "ioc_type": i.ioc_type,
                 "threat_score": round(i.threat_score or 0, 1), "malware_family": i.malware_family}
                for i in top_iocs
            ],
        },
        "alerts": {
            "total": sum(c for _, c in alerts_by_sev),
            "by_severity": {s: c for s, c in alerts_by_sev},
        },
    }


def _to_markdown(d: dict) -> str:
    lines = [
        f"# Threat Intelligence Digest: last {d['window_days']} days",
        f"_Generated {d['generated_at'][:16].replace('T', ' ')} UTC_",
        "",
        f"**{d['articles']['total']}** new articles · **{d['iocs']['total']}** new IOCs · **{d['alerts']['total']}** alert hits",
        "",
        "## Top Articles",
    ]
    for a in d["articles"]["top"]:
        lines.append(f"- [{a['title']}]({a['url']}), {a['source']}")
    if not d["articles"]["top"]:
        lines.append("- (none)")

    lines += ["", "## New IOCs by Type"]
    for t, c in d["iocs"]["by_type"].items():
        lines.append(f"- {t}: {c}")
    if not d["iocs"]["by_type"]:
        lines.append("- (none)")

    if d["iocs"]["top_families"]:
        lines += ["", "## Most Active Malware Families"]
        for f in d["iocs"]["top_families"]:
            lines.append(f"- {f['family']}: {f['count']}")

    if d["iocs"]["top"]:
        lines += ["", "## Highest-Risk New IOCs"]
        for i in d["iocs"]["top"]:
            lines.append(f"- `{i['value']}` ({i['ioc_type']}), score {i['threat_score']}")

    lines += ["", "## Alert Activity"]
    if d["alerts"]["by_severity"]:
        for s, c in d["alerts"]["by_severity"].items():
            lines.append(f"- {s}: {c}")
    else:
        lines.append("- No alerts fired")

    return "\n".join(lines)


@router.get("")
async def get_digest(days: int = Query(default=7, ge=1, le=90), db: AsyncSession = Depends(get_db)):
    data = await _build(db, days)
    data["markdown"] = _to_markdown(data)
    return data
