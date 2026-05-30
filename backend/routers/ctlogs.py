"""Certificate Transparency log watcher (#11).

Queries crt.sh (free, no API key) for certificates issued under a monitored
domain. New certs often appear days before phishing infrastructure goes live.
Degrades gracefully if crt.sh is unreachable or slow.
"""

from datetime import datetime

import httpx
from fastapi import APIRouter, Query

router = APIRouter(prefix="/api/ctlogs", tags=["ctlogs"])

CRTSH_URL = "https://crt.sh/"


def _parse_dt(s: str | None):
    if not s:
        return None
    try:
        return datetime.fromisoformat(s)
    except Exception:
        return None


@router.get("")
async def ct_search(
    domain: str = Query(..., min_length=3, description="Domain to monitor, e.g. example.com"),
    limit: int = Query(default=50, le=200),
):
    domain = domain.strip().lower().lstrip("*.")
    params = {"q": f"%.{domain}", "output": "json", "exclude": "expired"}

    try:
        async with httpx.AsyncClient(timeout=20.0, follow_redirects=True) as client:
            resp = await client.get(CRTSH_URL, params=params)
        resp.raise_for_status()
        raw = resp.json()
    except (httpx.HTTPError, ValueError) as e:
        return {
            "domain": domain,
            "available": False,
            "error": f"crt.sh lookup failed: {type(e).__name__}. It may be rate-limiting or slow; try again.",
            "certs": [],
        }

    # De-duplicate by (name_value, not_before); newest first
    seen = set()
    certs = []
    for row in raw:
        key = (row.get("name_value"), row.get("not_before"))
        if key in seen:
            continue
        seen.add(key)
        certs.append({
            "common_name": row.get("common_name"),
            "name_value": row.get("name_value"),
            "issuer": row.get("issuer_name"),
            "not_before": row.get("not_before"),
            "not_after": row.get("not_after"),
            "serial": row.get("serial_number"),
        })

    certs.sort(key=lambda c: c.get("not_before") or "", reverse=True)
    return {
        "domain": domain,
        "available": True,
        "total": len(certs),
        "certs": certs[:limit],
    }
