"""API routes for IP intelligence and domain reputation."""

import re
from fastapi import APIRouter, HTTPException
from services.ip_intel import lookup_ip_full, lookup_domain_full

router = APIRouter(prefix="/api/intel", tags=["intel"])

IP_RE = re.compile(r"^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$")
DOMAIN_RE = re.compile(r"^[a-zA-Z0-9]([a-zA-Z0-9\-]*\.)+[a-zA-Z]{2,}$")


@router.post("/ip")
async def ip_intelligence(ip: str):
    """Full IP intelligence report."""
    ip = ip.strip()
    if not IP_RE.match(ip):
        raise HTTPException(status_code=400, detail="Invalid IP address")
    return await lookup_ip_full(ip)


@router.post("/domain")
async def domain_reputation(domain: str):
    """Domain reputation report."""
    domain = domain.strip().lower()
    if not DOMAIN_RE.match(domain):
        raise HTTPException(status_code=400, detail="Invalid domain")
    return await lookup_domain_full(domain)
