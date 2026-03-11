"""IP Intelligence — consolidated lookup across multiple sources."""

import logging
import httpx
from config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()
TIMEOUT = httpx.Timeout(15.0, connect=10.0)


async def lookup_ip_full(ip: str) -> dict:
    """Full IP intelligence report from all available sources."""
    result = {
        "ip": ip,
        "abuseipdb": None,
        "shodan": None,
        "greynoise": None,
        "threat_score": 0,
        "summary": "",
    }

    # AbuseIPDB
    if settings.abuseipdb_api_key:
        try:
            async with httpx.AsyncClient(timeout=TIMEOUT) as c:
                resp = await c.get(
                    "https://api.abuseipdb.com/api/v2/check",
                    params={"ipAddress": ip, "maxAgeInDays": 90, "verbose": ""},
                    headers={"Key": settings.abuseipdb_api_key, "Accept": "application/json"},
                )
                if resp.status_code == 200:
                    d = resp.json().get("data", {})
                    result["abuseipdb"] = {
                        "abuse_score": d.get("abuseConfidenceScore", 0),
                        "total_reports": d.get("totalReports", 0),
                        "country": d.get("countryCode"),
                        "isp": d.get("isp"),
                        "domain": d.get("domain"),
                        "is_tor": d.get("isTor", False),
                        "is_whitelisted": d.get("isWhitelisted", False),
                        "usage_type": d.get("usageType"),
                        "last_reported": d.get("lastReportedAt"),
                    }
        except Exception as e:
            logger.error(f"AbuseIPDB lookup failed: {e}")

    # Shodan InternetDB (free, no key needed)
    try:
        async with httpx.AsyncClient(timeout=TIMEOUT) as c:
            resp = await c.get(f"https://internetdb.shodan.io/{ip}")
            if resp.status_code == 200:
                d = resp.json()
                result["shodan"] = {
                    "ports": d.get("ports", []),
                    "hostnames": d.get("hostnames", []),
                    "vulns": d.get("vulns", []),
                    "tags": d.get("tags", []),
                    "cpes": d.get("cpes", []),
                }
    except Exception as e:
        logger.error(f"Shodan lookup failed: {e}")

    # GreyNoise
    if settings.greynoise_api_key:
        try:
            async with httpx.AsyncClient(timeout=TIMEOUT) as c:
                resp = await c.get(
                    f"https://api.greynoise.io/v3/community/{ip}",
                    headers={"key": settings.greynoise_api_key},
                )
                if resp.status_code == 200:
                    d = resp.json()
                    result["greynoise"] = {
                        "noise": d.get("noise", False),
                        "riot": d.get("riot", False),
                        "classification": d.get("classification", "unknown"),
                        "name": d.get("name", ""),
                        "message": d.get("message", ""),
                    }
        except Exception as e:
            logger.error(f"GreyNoise lookup failed: {e}")

    # Calculate composite threat score
    score = 0
    if result["abuseipdb"]:
        score += result["abuseipdb"]["abuse_score"] * 0.4
    if result["shodan"] and result["shodan"]["vulns"]:
        score += min(len(result["shodan"]["vulns"]) * 10, 30)
    if result["shodan"] and result["shodan"]["ports"]:
        score += min(len(result["shodan"]["ports"]) * 2, 15)
    if result["greynoise"] and result["greynoise"]["noise"]:
        score += 15
    result["threat_score"] = min(round(score), 100)

    # Summary
    parts = []
    if result["abuseipdb"]:
        a = result["abuseipdb"]
        parts.append(f"AbuseIPDB: {a['abuse_score']}% confidence, {a['total_reports']} reports")
    if result["shodan"]:
        s = result["shodan"]
        parts.append(f"Shodan: {len(s['ports'])} ports, {len(s['vulns'])} vulns")
    if result["greynoise"]:
        g = result["greynoise"]
        parts.append(f"GreyNoise: {g['classification']}")
    result["summary"] = " | ".join(parts) if parts else "No data available"

    return result


async def lookup_domain_full(domain: str) -> dict:
    """Domain reputation report."""
    result = {
        "domain": domain,
        "virustotal": None,
        "shodan": None,
        "threat_score": 0,
    }

    # VirusTotal
    if settings.virustotal_api_key:
        try:
            async with httpx.AsyncClient(timeout=TIMEOUT) as c:
                resp = await c.get(
                    f"https://www.virustotal.com/api/v3/domains/{domain}",
                    headers={"x-apikey": settings.virustotal_api_key},
                )
                if resp.status_code == 200:
                    attrs = resp.json().get("data", {}).get("attributes", {})
                    stats = attrs.get("last_analysis_stats", {})
                    result["virustotal"] = {
                        "malicious": stats.get("malicious", 0),
                        "suspicious": stats.get("suspicious", 0),
                        "harmless": stats.get("harmless", 0),
                        "undetected": stats.get("undetected", 0),
                        "reputation": attrs.get("reputation", 0),
                        "categories": attrs.get("categories", {}),
                        "registrar": attrs.get("registrar"),
                        "creation_date": attrs.get("creation_date"),
                    }
        except Exception as e:
            logger.error(f"VirusTotal domain lookup failed: {e}")

    # Calculate threat score
    if result["virustotal"]:
        vt = result["virustotal"]
        total = vt["malicious"] + vt["suspicious"] + vt["harmless"] + vt["undetected"]
        if total > 0:
            result["threat_score"] = min(round((vt["malicious"] * 100 + vt["suspicious"] * 50) / total), 100)

    return result
