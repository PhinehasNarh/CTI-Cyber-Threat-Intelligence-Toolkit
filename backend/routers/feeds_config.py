"""Feed schedule management (#15)."""

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from models import FeedSchedule
from services.feed_scheduler import seed_schedules, run_due_feeds
from feeds.sdk import discover_plugins, run_plugin

router = APIRouter(prefix="/api/feeds", tags=["feed-config"])


class ScheduleUpdate(BaseModel):
    interval_minutes: int | None = None
    priority: int | None = None
    enabled: bool | None = None


def _serialize(s: FeedSchedule) -> dict:
    return {
        "id": s.id, "source_name": s.source_name, "feed_type": s.feed_type,
        "interval_minutes": s.interval_minutes, "priority": s.priority,
        "enabled": s.enabled, "last_count": s.last_count,
        "last_polled": s.last_polled.isoformat() if s.last_polled else None,
    }


@router.get("")
async def list_schedules(db: AsyncSession = Depends(get_db)):
    await seed_schedules(db)
    rows = (await db.execute(select(FeedSchedule).order_by(FeedSchedule.priority, FeedSchedule.source_name))).scalars().all()
    return {"count": len(rows), "feeds": [_serialize(s) for s in rows]}


@router.patch("/{schedule_id}")
async def update_schedule(schedule_id: int, body: ScheduleUpdate, db: AsyncSession = Depends(get_db)):
    s = (await db.execute(select(FeedSchedule).where(FeedSchedule.id == schedule_id))).scalar_one_or_none()
    if not s:
        raise HTTPException(status_code=404, detail="Feed schedule not found")
    if body.interval_minutes is not None:
        s.interval_minutes = max(1, body.interval_minutes)
    if body.priority is not None:
        s.priority = body.priority
    if body.enabled is not None:
        s.enabled = body.enabled
    await db.commit()
    return _serialize(s)


@router.post("/run-due")
async def run_due(db: AsyncSession = Depends(get_db)):
    """Manually trigger a due-feed sweep now."""
    results = await run_due_feeds(db)
    return {"polled": results, "total_new": sum(results.values())}


@router.get("/plugins")
async def list_plugins():
    """List auto-discovered community feed plugins (#30)."""
    plugins = discover_plugins()
    return {"count": len(plugins), "plugins": [{"name": p.name, "feed_type": p.feed_type} for p in plugins]}


@router.post("/plugins/{name}/run")
async def run_plugin_by_name(name: str, db: AsyncSession = Depends(get_db)):
    plugin = next((p for p in discover_plugins() if p.name == name), None)
    if not plugin:
        raise HTTPException(status_code=404, detail="Plugin not found")
    new = await run_plugin(plugin, db)
    return {"plugin": name, "new_records": new}
