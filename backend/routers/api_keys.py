"""API key management (#26)."""

import secrets

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select, desc
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from models import ApiKey

router = APIRouter(prefix="/api/keys", tags=["api-keys"])

VALID_SCOPES = {"read", "ingest"}


class KeyCreate(BaseModel):
    name: str
    scopes: list[str] = ["read"]


def _mask(key: str) -> str:
    return key[:8] + "…" + key[-4:] if len(key) > 12 else "…"


def _serialize(k: ApiKey, reveal: bool = False) -> dict:
    return {
        "id": k.id,
        "name": k.name,
        "key": k.key if reveal else _mask(k.key),
        "scopes": (k.scopes or "").split(","),
        "is_active": k.is_active,
        "request_count": k.request_count,
        "last_used": k.last_used.isoformat() if k.last_used else None,
        "created_at": k.created_at.isoformat() if k.created_at else None,
    }


@router.get("")
async def list_keys(db: AsyncSession = Depends(get_db)):
    rows = (await db.execute(select(ApiKey).order_by(desc(ApiKey.created_at)))).scalars().all()
    return {"count": len(rows), "keys": [_serialize(k) for k in rows]}


@router.post("")
async def create_key(body: KeyCreate, db: AsyncSession = Depends(get_db)):
    scopes = [s for s in body.scopes if s in VALID_SCOPES] or ["read"]
    raw = "cti_" + secrets.token_urlsafe(24)
    k = ApiKey(key=raw, name=body.name.strip() or "unnamed", scopes=",".join(scopes))
    db.add(k)
    await db.commit()
    await db.refresh(k)
    # Reveal the full key exactly once, on creation
    return {**_serialize(k, reveal=True), "warning": "Store this key now; it will not be shown again."}


@router.patch("/{key_id}")
async def toggle_key(key_id: int, is_active: bool, db: AsyncSession = Depends(get_db)):
    k = (await db.execute(select(ApiKey).where(ApiKey.id == key_id))).scalar_one_or_none()
    if not k:
        raise HTTPException(status_code=404, detail="Key not found")
    k.is_active = is_active
    await db.commit()
    return _serialize(k)


@router.delete("/{key_id}")
async def delete_key(key_id: int, db: AsyncSession = Depends(get_db)):
    k = (await db.execute(select(ApiKey).where(ApiKey.id == key_id))).scalar_one_or_none()
    if not k:
        raise HTTPException(status_code=404, detail="Key not found")
    await db.delete(k)
    await db.commit()
    return {"deleted": key_id}
