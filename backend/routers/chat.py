"""Natural-language query endpoint (#36). Rule-based, offline."""

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import select, func, desc, or_
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from models import IOC, FeedArticle
from services.chat import parse_query, describe

router = APIRouter(prefix="/api/chat", tags=["chat"])


class ChatQuery(BaseModel):
    query: str


@router.post("")
async def chat(body: ChatQuery, db: AsyncSession = Depends(get_db)):
    p = parse_query(body.query)

    if p["target"] == "article":
        model = FeedArticle
        base = select(model)
        if p["since"]:
            base = base.where(model.fetched_at >= p["since"])
        for kw in p["keywords"]:
            pat = f"%{kw}%"
            base = base.where(or_(model.title.ilike(pat), model.summary.ilike(pat)))
        order = desc(model.published)
    else:
        model = IOC
        base = select(model)
        if p["ioc_type"]:
            base = base.where(model.ioc_type == p["ioc_type"])
        if p["since"]:
            base = base.where(model.first_seen >= p["since"])
        if p["min_score"]:
            base = base.where(model.threat_score >= p["min_score"])
        for kw in p["keywords"]:
            pat = f"%{kw}%"
            base = base.where(or_(model.value.ilike(pat), model.malware_family.ilike(pat),
                                  model.threat_type.ilike(pat), model.tags.ilike(pat)))
        order = desc(model.threat_score)

    total = (await db.execute(select(func.count()).select_from(base.subquery()))).scalar() or 0

    interpreted = describe(p)
    if p["intent"] == "count":
        return {
            "interpreted": interpreted,
            "result_type": "count",
            "count": total,
            "answer": f"Found {total} {p.get('ioc_type') or ''} {p['target']}{'s' if total != 1 else ''}".replace("  ", " ").strip()
                      + (f" matching '{interpreted}'." if interpreted else "."),
            "results": [],
        }

    rows = (await db.execute(base.order_by(order).limit(25))).scalars().all()
    if model is IOC:
        results = [
            {"kind": "ioc", "id": i.id, "primary": i.value, "secondary": i.malware_family or i.ioc_type,
             "score": round(i.threat_score or 0, 1)}
            for i in rows
        ]
    else:
        results = [
            {"kind": "article", "id": a.id, "primary": a.title, "secondary": a.source,
             "url": a.url, "published": a.published.isoformat() if a.published else None}
            for a in rows
        ]

    return {
        "interpreted": interpreted,
        "result_type": p["target"],
        "count": total,
        "answer": f"Found {total} match{'es' if total != 1 else ''}; showing {len(results)}.",
        "results": results,
    }
