"""IOC enrichment — lookup an IOC against VirusTotal, AbuseIPDB, Shodan."""

import json
import logging

import httpx

from config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()

TIMEOUT = httpx.Timeout(15.0, connect=10.0)


async def lookup_virustotal(ioc_value: str, ioc_type: str) -> dict | None:
    """Query VirusTotal v3 for a hash, domain, IP, or URL."""
    if not settings.virustotal_api_key:
        return None

    type_map = {
        "hash": f"https://www.virustotal.com/api/v3/files/{ioc_value}",
        "domain": f"https://www.virustotal.com/api/v3/domains/{ioc_value}",
        "ip": f"https://www.virustotal.com/api/v3/ip_addresses/{ioc_value}",
    }
    url = type_map.get(ioc_type)
    if not url:
        return None

    try:
        async with httpx.AsyncClient(timeout=TIMEOUT) as client:
            resp = await client.get(
                url, headers={"x-apikey": settings.virustotal_api_key}
            )
            if resp.status_code == 200:
                data = resp.json().get("data", {}).get("attributes", {})
                return {
                    "source": "virustotal",
                    "malicious": data.get("last_analysis_stats", {}).get("malicious", 0),
                    "harmless": data.get("last_analysis_stats", {}).get("harmless", 0),
                    "reputation": data.get("reputation"),
                    "tags": data.get("tags", []),
                }
            elif resp.status_code == 404:
                return {"source": "virustotal", "found": False}
    except Exception as e:
        logger.error(f"VirusTotal lookup failed: {e}")
    return None


async def lookup_abuseipdb(ip: str) -> dict | None:
    """Check an IP address against AbuseIPDB."""
    if not settings.abuseipdb_api_key:
        return None

    try:
        async with httpx.AsyncClient(timeout=TIMEOUT) as client:
            resp = await client.get(
                "https://api.abuseipdb.com/api/v2/check",
                params={"ipAddress": ip, "maxAgeInDays": 90, "verbose": ""},
                headers={
                    "Key": settings.abuseipdb_api_key,
                    "Accept": "application/json",
                },
            )
            if resp.status_code == 200:
                data = resp.json().get("data", {})
                return {
                    "source": "abuseipdb",
                    "abuse_confidence_score": data.get("abuseConfidenceScore"),
                    "total_reports": data.get("totalReports"),
                    "country": data.get("countryCode"),
                    "isp": data.get("isp"),
                    "domain": data.get("domain"),
                    "is_tor": data.get("isTor"),
                }
    except Exception as e:
        logger.error(f"AbuseIPDB lookup failed: {e}")
    return None


async def lookup_shodan_internetdb(ip: str) -> dict | None:
    """Free Shodan InternetDB lookup — no API key needed."""
    try:
        async with httpx.AsyncClient(timeout=TIMEOUT) as client:
            resp = await client.get(f"https://internetdb.shodan.io/{ip}")
            if resp.status_code == 200:
                data = resp.json()
                return {
                    "source": "shodan_internetdb",
                    "ports": data.get("ports", []),
                    "hostnames": data.get("hostnames", []),
                    "vulns": data.get("vulns", []),
                    "tags": data.get("tags", []),
                    "cpes": data.get("cpes", []),
                }
    except Exception as e:
        logger.error(f"Shodan InternetDB lookup failed: {e}")
    return None


async def enrich_ioc(ioc_value: str, ioc_type: str) -> list[dict]:
    """Run all applicable enrichment lookups for an IOC.
    Returns a list of enrichment results from different sources."""
    results = []

    # VirusTotal — works for hashes, domains, IPs
    if ioc_type in ("hash", "domain", "ip"):
        vt = await lookup_virustotal(ioc_value, ioc_type)
        if vt:
            results.append(vt)

    # AbuseIPDB — IPs only
    if ioc_type == "ip":
        abuse = await lookup_abuseipdb(ioc_value)
        if abuse:
            results.append(abuse)

    # Shodan InternetDB — IPs only, free
    if ioc_type == "ip":
        shodan = await lookup_shodan_internetdb(ioc_value)
        if shodan:
            results.append(shodan)

    return results
