"""API routes for MITRE ATT&CK mapping and heatmap."""

from collections import defaultdict

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from models import FeedArticle, IOC
from services.attack_mapper import ATTACK_MAP, TACTIC_ORDER

router = APIRouter(prefix="/api/attack", tags=["attack"])


def _parse_tags(tags_str: str | None) -> list[str]:
    if not tags_str:
        return []
    return [t.strip() for t in tags_str.split(",") if t.strip()]


@router.get("/heatmap")
async def attack_heatmap(db: AsyncSession = Depends(get_db)):
    """Count ATT&CK technique hits across articles and IOCs."""
    counts: dict[str, int] = defaultdict(int)

    # Count from articles
    art_result = await db.execute(
        select(FeedArticle.attack_tags).where(FeedArticle.attack_tags != None)
    )
    for (tags_str,) in art_result.all():
        for t in _parse_tags(tags_str):
            if t in ATTACK_MAP:
                counts[t] += 1

    # Count from IOCs
    ioc_result = await db.execute(
        select(IOC.attack_tags).where(IOC.attack_tags != None)
    )
    for (tags_str,) in ioc_result.all():
        for t in _parse_tags(tags_str):
            if t in ATTACK_MAP:
                counts[t] += 1

    # Build response organized by tactic
    tactics = []
    for tactic_id, tactic_name in TACTIC_ORDER:
        techniques = [
            {
                "id": tid,
                "name": data["name"],
                "count": counts.get(tid, 0),
            }
            for tid, data in ATTACK_MAP.items()
            if data["tactic_id"] == tactic_id
        ]
        tactic_total = sum(t["count"] for t in techniques)
        tactics.append({
            "tactic_id": tactic_id,
            "tactic_name": tactic_name,
            "total": tactic_total,
            "techniques": sorted(techniques, key=lambda x: x["count"], reverse=True),
        })

    total_hits = sum(counts.values())
    hot_techniques = sorted(counts.items(), key=lambda x: x[1], reverse=True)[:10]

    return {
        "total_hits": total_hits,
        "unique_techniques": len(counts),
        "top_techniques": [
            {"id": tid, "name": ATTACK_MAP[tid]["name"], "tactic": ATTACK_MAP[tid]["tactic"], "count": c}
            for tid, c in hot_techniques
            if tid in ATTACK_MAP
        ],
        "tactics": tactics,
    }


@router.get("/techniques")
async def list_techniques():
    """Return the full ATT&CK technique catalogue used by the mapper."""
    by_tactic = []
    for tactic_id, tactic_name in TACTIC_ORDER:
        techniques = [
            {"id": tid, "name": data["name"], "keywords": data["keywords"]}
            for tid, data in ATTACK_MAP.items()
            if data["tactic_id"] == tactic_id
        ]
        by_tactic.append({"tactic_id": tactic_id, "tactic_name": tactic_name, "techniques": techniques})
    return {"tactics": by_tactic, "total": len(ATTACK_MAP)}
