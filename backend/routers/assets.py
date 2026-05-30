"""Shodan asset watch (#12).

Pin IP assets and monitor them via Shodan InternetDB (https://internetdb.shodan.io),
which is free and needs no API key. Flags newly opened ports against the last
snapshot. Degrades gracefully when InternetDB is unreachable.
"""

import json
from datetime import datetime, timezone

import httpx
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from models import WatchedAsset

router = APIRouter(prefix="/api/assets", tags=["assets"])

INTERNETDB = "https://internetdb.shodan.io/{ip}"


class AssetCreate(BaseModel):
    ip: str
    label: str = ""


async def _lookup(ip: str) -> dict | None:
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(INTERNETDB.format(ip=ip))
        if resp.status_code == 404:
            return {"ports": [], "hostnames": [], "tags": [], "vulns": [], "cpes": []}
        resp.raise_for_status()
        return resp.json()
    except (httpx.HTTPError, ValueError):
        return None


@router.get("")
async def list_assets(db: AsyncSession = Depends(get_db)):
    assets = (await db.execute(select(WatchedAsset).order_by(WatchedAsset.created_at))).scalars().all()
    out = []
    reachable = True
    for a in assets:
        data = await _lookup(a.ip)
        prev = set(json.loads(a.last_ports)) if a.last_ports else set()
        if data is None:
            reachable = False
            out.append({"id": a.id, "ip": a.ip, "label": a.label, "available": False,
                        "ports": sorted(prev), "new_ports": [], "vulns": [], "tags": [], "hostnames": []})
            continue
        ports = set(data.get("ports", []))
        new_ports = sorted(ports - prev) if prev else []
        a.last_ports = json.dumps(sorted(ports))
        a.last_checked = datetime.now(timezone.utc)
        out.append({
            "id": a.id, "ip": a.ip, "label": a.label, "available": True,
            "ports": sorted(ports), "new_ports": new_ports,
            "vulns": data.get("vulns", []), "tags": data.get("tags", []),
            "hostnames": data.get("hostnames", []),
            "last_checked": a.last_checked.isoformat(),
        })
    await db.commit()
    return {"count": len(out), "reachable": reachable, "assets": out}


@router.post("")
async def add_asset(body: AssetCreate, db: AsyncSession = Depends(get_db)):
    ip = body.ip.strip()
    if not ip:
        raise HTTPException(status_code=400, detail="IP required")
    existing = (await db.execute(select(WatchedAsset).where(WatchedAsset.ip == ip))).scalar_one_or_none()
    if existing:
        raise HTTPException(status_code=409, detail="Asset already pinned")
    a = WatchedAsset(ip=ip, label=body.label or None)
    db.add(a)
    await db.commit()
    await db.refresh(a)
    return {"id": a.id, "ip": a.ip, "label": a.label}


@router.delete("/{asset_id}")
async def remove_asset(asset_id: int, db: AsyncSession = Depends(get_db)):
    a = (await db.execute(select(WatchedAsset).where(WatchedAsset.id == asset_id))).scalar_one_or_none()
    if not a:
        raise HTTPException(status_code=404, detail="Asset not found")
    await db.delete(a)
    await db.commit()
    return {"deleted": asset_id}
