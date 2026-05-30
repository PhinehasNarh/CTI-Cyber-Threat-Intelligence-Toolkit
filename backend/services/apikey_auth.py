"""API key authentication + simple in-memory rate limiting (#26).

Public endpoints depend on `require_key` (read) or `require_ingest` (write).
Keys are passed as `Authorization: Bearer <key>` or `X-API-Key: <key>`.
"""

import time
from collections import defaultdict, deque

from fastapi import Depends, Header, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from models import ApiKey

RATE_LIMIT = 60          # requests
RATE_WINDOW = 60         # seconds
_hits: dict[str, deque] = defaultdict(deque)


def _extract(authorization: str | None, x_api_key: str | None) -> str | None:
    if x_api_key:
        return x_api_key.strip()
    if authorization and authorization.lower().startswith("bearer "):
        return authorization[7:].strip()
    return None


def _rate_check(key: str) -> None:
    now = time.time()
    q = _hits[key]
    while q and q[0] < now - RATE_WINDOW:
        q.popleft()
    if len(q) >= RATE_LIMIT:
        raise HTTPException(status_code=429, detail=f"Rate limit exceeded ({RATE_LIMIT}/min)")
    q.append(now)


async def _resolve(authorization, x_api_key, db: AsyncSession) -> ApiKey:
    raw = _extract(authorization, x_api_key)
    if not raw:
        raise HTTPException(status_code=401, detail="API key required (Authorization: Bearer <key> or X-API-Key)")
    key = (await db.execute(select(ApiKey).where(ApiKey.key == raw, ApiKey.is_active == True))).scalar_one_or_none()
    if not key:
        raise HTTPException(status_code=401, detail="Invalid or inactive API key")
    _rate_check(raw)
    key.request_count = (key.request_count or 0) + 1
    from datetime import datetime, timezone
    key.last_used = datetime.now(timezone.utc)
    await db.commit()
    return key


async def require_key(
    authorization: str | None = Header(default=None),
    x_api_key: str | None = Header(default=None),
    db: AsyncSession = Depends(get_db),
) -> ApiKey:
    return await _resolve(authorization, x_api_key, db)


async def require_ingest(key: ApiKey = Depends(require_key)) -> ApiKey:
    if "ingest" not in (key.scopes or "").split(","):
        raise HTTPException(status_code=403, detail="This key lacks the 'ingest' scope")
    return key
