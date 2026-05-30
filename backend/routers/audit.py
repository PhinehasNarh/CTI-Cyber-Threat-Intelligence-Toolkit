"""API routes for the analyst audit log (#25)."""

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select, func, desc
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from models import AuditLog

router = APIRouter(prefix="/api/audit", tags=["audit"])


def _serialize(a: AuditLog) -> dict:
    return {
        "id": a.id,
        "action": a.action,
        "entity_type": a.entity_type,
        "entity_id": a.entity_id,
        "summary": a.summary,
        "actor": a.actor,
        "created_at": a.created_at.isoformat() if a.created_at else None,
    }


@router.get("")
async def list_audit(
    action: str | None = None,
    entity_type: str | None = None,
    limit: int = Query(default=100, le=500),
    offset: int = Query(default=0, ge=0),
    db: AsyncSession = Depends(get_db),
):
    query = select(AuditLog).order_by(desc(AuditLog.created_at))
    if action:
        query = query.where(AuditLog.action == action)
    if entity_type:
        query = query.where(AuditLog.entity_type == entity_type)

    result = await db.execute(query.offset(offset).limit(limit))
    rows = result.scalars().all()

    total = (await db.execute(select(func.count(AuditLog.id)))).scalar() or 0
    types_result = await db.execute(
        select(AuditLog.entity_type, func.count(AuditLog.id)).group_by(AuditLog.entity_type)
    )

    return {
        "count": len(rows),
        "total": total,
        "offset": offset,
        "by_entity": {row[0]: row[1] for row in types_result.all()},
        "entries": [_serialize(a) for a in rows],
    }
