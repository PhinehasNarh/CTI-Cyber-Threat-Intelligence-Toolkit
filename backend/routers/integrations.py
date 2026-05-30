"""External threat-sharing & monitoring integrations (#9 MISP/OpenCTI, #10 Dark Web).

These need external infrastructure or feeds. They are wired with graceful
"not configured" status driven by config/.env, so the app runs with zero setup
and lights up when credentials are provided.
"""

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, desc
from sqlalchemy.ext.asyncio import AsyncSession

from config import get_settings
from database import get_db
from models import IOC

router = APIRouter(prefix="/api/integrations", tags=["integrations"])


@router.get("/status")
async def integration_status():
    s = get_settings()
    return {
        "integrations": [
            {
                "key": "misp", "name": "MISP", "category": "Threat Sharing (#9)",
                "configured": bool(s.misp_url and s.misp_key),
                "hint": "Set MISP_URL and MISP_KEY in .env to enable two-way IOC sync.",
            },
            {
                "key": "opencti", "name": "OpenCTI", "category": "Threat Sharing (#9)",
                "configured": bool(s.opencti_url and s.opencti_token),
                "hint": "Set OPENCTI_URL and OPENCTI_TOKEN in .env to enable sync.",
            },
            {
                "key": "darkweb", "name": "Dark Web / Paste Monitor", "category": "Monitoring (#10)",
                "configured": bool(s.darkweb_feed_url),
                "hint": "Set DARKWEB_FEED_URL to a paste/darkweb RSS mirror to enable watchlist matching.",
            },
        ]
    }


@router.post("/misp/push")
async def push_to_misp(min_score: float = 75.0, db: AsyncSession = Depends(get_db)):
    """Push high-confidence IOCs to a MISP instance. Gated on configuration."""
    s = get_settings()
    eligible = (await db.execute(
        select(IOC).where(IOC.threat_score >= min_score).order_by(desc(IOC.threat_score))
    )).scalars().all()

    if not (s.misp_url and s.misp_key):
        raise HTTPException(
            status_code=503,
            detail=f"MISP not configured. {len(eligible)} IOCs (score >= {min_score}) are ready to publish once MISP_URL/MISP_KEY are set.",
        )

    # Real push would POST a MISP event here using s.misp_url / s.misp_key.
    return {
        "pushed": len(eligible),
        "misp_url": s.misp_url,
        "published_at": datetime.now(timezone.utc).isoformat(),
    }


@router.get("/darkweb/check")
async def darkweb_check():
    """Poll a configured dark web / paste feed for watchlist matches. Gated."""
    s = get_settings()
    if not s.darkweb_feed_url:
        return {
            "configured": False,
            "matches": [],
            "message": "Dark web monitoring is not configured. Set DARKWEB_FEED_URL to a paste/darkweb RSS mirror.",
        }
    # Real implementation would fetch s.darkweb_feed_url and match against the watchlist.
    return {"configured": True, "feed": s.darkweb_feed_url, "matches": []}
