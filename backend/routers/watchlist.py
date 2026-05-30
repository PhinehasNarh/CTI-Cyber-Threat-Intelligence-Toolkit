"""API routes for the IOC watchlist."""

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select, desc
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from models import Watchlist, WatchlistHit

router = APIRouter(prefix="/api/watchlist", tags=["watchlist"])


class WatchlistCreate(BaseModel):
    pattern: str
    label: str


@router.get("")
async def list_watchlist(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Watchlist).order_by(desc(Watchlist.hit_count)))
    entries = result.scalars().all()
    return {
        "count": len(entries),
        "entries": [
            {
                "id": e.id,
                "pattern": e.pattern,
                "label": e.label,
                "hit_count": e.hit_count,
                "created_at": e.created_at.isoformat() if e.created_at else None,
            }
            for e in entries
        ],
    }


@router.post("")
async def add_watchlist_entry(body: WatchlistCreate, db: AsyncSession = Depends(get_db)):
    pattern = body.pattern.strip()
    if not pattern:
        raise HTTPException(status_code=400, detail="pattern cannot be empty")

    existing = (await db.execute(select(Watchlist).where(Watchlist.pattern == pattern))).scalar_one_or_none()
    if existing:
        raise HTTPException(status_code=409, detail="pattern already in watchlist")

    entry = Watchlist(pattern=pattern, label=body.label.strip() or pattern)
    db.add(entry)
    await db.commit()
    await db.refresh(entry)
    return {"id": entry.id, "pattern": entry.pattern, "label": entry.label, "hit_count": 0}


@router.delete("/{entry_id}")
async def delete_watchlist_entry(entry_id: int, db: AsyncSession = Depends(get_db)):
    entry = (await db.execute(select(Watchlist).where(Watchlist.id == entry_id))).scalar_one_or_none()
    if not entry:
        raise HTTPException(status_code=404, detail="entry not found")
    await db.delete(entry)
    await db.commit()
    return {"deleted": entry_id}


@router.get("/hits")
async def list_hits(
    limit: int = 50,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(WatchlistHit).order_by(desc(WatchlistHit.hit_at)).limit(limit)
    )
    hits = result.scalars().all()

    watchlist_ids = {h.watchlist_id for h in hits}
    wl_map = {}
    if watchlist_ids:
        wl_result = await db.execute(select(Watchlist).where(Watchlist.id.in_(watchlist_ids)))
        wl_map = {w.id: w for w in wl_result.scalars().all()}

    return {
        "count": len(hits),
        "hits": [
            {
                "id": h.id,
                "watchlist_id": h.watchlist_id,
                "pattern": wl_map[h.watchlist_id].pattern if h.watchlist_id in wl_map else None,
                "label": wl_map[h.watchlist_id].label if h.watchlist_id in wl_map else None,
                "ioc_id": h.ioc_id,
                "ioc_value": h.ioc_value,
                "ioc_type": h.ioc_type,
                "source": h.source,
                "hit_at": h.hit_at.isoformat() if h.hit_at else None,
            }
            for h in hits
        ],
    }
