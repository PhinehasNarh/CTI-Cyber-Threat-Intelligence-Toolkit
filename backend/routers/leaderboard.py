"""Analyst participation leaderboard (#38).

Derives points from the audit log: every recorded analyst action is worth points
by type. Gamifies the upkeep work (triaging, tagging, curating actors/campaigns).
"""

from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select, func, desc
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from models import AuditLog

router = APIRouter(prefix="/api/leaderboard", tags=["leaderboard"])

POINTS = {"create": 5, "update": 3, "delete": 2}
DEFAULT_POINTS = 1


@router.get("")
async def leaderboard(
    days: int | None = Query(default=None, description="Limit to last N days; omit for all-time"),
    db: AsyncSession = Depends(get_db),
):
    query = select(AuditLog)
    if days:
        since = datetime.now(timezone.utc) - timedelta(days=days)
        query = query.where(AuditLog.created_at >= since)

    rows = (await db.execute(query)).scalars().all()

    board: dict[str, dict] = {}
    for r in rows:
        b = board.setdefault(r.actor, {
            "actor": r.actor, "points": 0, "total_actions": 0,
            "by_action": {}, "last_active": None,
        })
        b["points"] += POINTS.get(r.action, DEFAULT_POINTS)
        b["total_actions"] += 1
        b["by_action"][r.action] = b["by_action"].get(r.action, 0) + 1
        iso = r.created_at.isoformat() if r.created_at else None
        if iso and (b["last_active"] is None or iso > b["last_active"]):
            b["last_active"] = iso

    ranked = sorted(board.values(), key=lambda x: (-x["points"], -x["total_actions"], x["actor"]))
    for idx, entry in enumerate(ranked):
        entry["rank"] = idx + 1

    return {
        "window_days": days,
        "scoring": POINTS,
        "count": len(ranked),
        "leaderboard": ranked,
    }
