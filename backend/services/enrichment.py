"""IOC enrichment — VirusTotal, AbuseIPDB, Shodan, URLScan, WHOIS."""

import asyncio
import logging
from urllib.parse import urlparse

import httpx

from config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()

TIMEOUT = httpx.Timeout(15.0, connect=10.0)


async def lookup_virustotal(ioc_value: str, ioc_type: str) -> dict | None:
    """Query VirusTotal v3 for a hash, domain, or IP."""
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
            resp = await client.get(url, headers={"x-apikey": settings.virustotal_api_key})
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
                headers={"Key": settings.abuseipdb_api_key, "Accept": "application/json"},
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


async def lookup_urlscan(ioc_value: str, ioc_type: str) -> dict | None:
    """Search URLScan.io for recent scans of a domain or URL."""
    if ioc_type == "url":
        try:
            domain = urlparse(ioc_value).hostname
        except Exception:
            domain = None
        if not domain:
            return None
    elif ioc_type == "domain":
        domain = ioc_value
    else:
        return None

    headers = {"Content-Type": "application/json"}
    if settings.urlscan_api_key:
        headers["API-Key"] = settings.urlscan_api_key

    try:
        async with httpx.AsyncClient(timeout=TIMEOUT) as client:
            resp = await client.get(
                "https://urlscan.io/api/v1/search/",
                params={"q": f"domain:{domain}", "size": 1},
                headers=headers,
            )
            if resp.status_code == 200:
                results = resp.json().get("results", [])
                if not results:
                    return {"source": "urlscan", "found": False}
                r = results[0]
                page = r.get("page", {})
                verdicts = r.get("verdicts", {}).get("overall", {})
                task_uuid = r.get("task", {}).get("uuid", "")
                return {
                    "source": "urlscan",
                    "ip": page.get("ip"),
                    "country": page.get("country"),
                    "server": page.get("server"),
                    "score": verdicts.get("score"),
                    "malicious": verdicts.get("malicious"),
                    "categories": verdicts.get("categories", []),
                    "scan_url": f"https://urlscan.io/result/{task_uuid}/" if task_uuid else None,
                }
    except Exception as e:
        logger.error(f"URLScan lookup failed: {e}")
    return None


async def lookup_whois(ioc_value: str, ioc_type: str) -> dict | None:
    """WHOIS registration lookup for domain and URL IOCs."""
    if ioc_type == "url":
        try:
            domain = urlparse(ioc_value).hostname
        except Exception:
            domain = None
        if not domain:
            return None
    elif ioc_type == "domain":
        domain = ioc_value
    else:
        return None

    try:
        import whois as whois_lib

        def _normalize_date(d):
            if isinstance(d, list):
                d = d[0] if d else None
            return d.isoformat() if hasattr(d, "isoformat") else (str(d) if d else None)

        w = await asyncio.to_thread(whois_lib.whois, domain)
        if not w or not w.domain_name:
            return None

        name_servers = w.name_servers
        if isinstance(name_servers, list):
            name_servers = [str(ns).lower() for ns in name_servers[:4]]
        elif name_servers:
            name_servers = [str(name_servers).lower()]
        else:
            name_servers = []

        return {
            "source": "whois",
            "registrar": w.registrar,
            "creation_date": _normalize_date(w.creation_date),
            "expiration_date": _normalize_date(w.expiration_date),
            "name_servers": name_servers,
            "org": w.org,
            "country": w.country,
        }
    except Exception as e:
        logger.error(f"WHOIS lookup failed for {domain}: {e}")
    return None


async def enrich_ioc(ioc_value: str, ioc_type: str) -> list[dict]:
    """Run all applicable enrichment lookups for an IOC."""
    results = []

    if ioc_type in ("hash", "domain", "ip"):
        vt = await lookup_virustotal(ioc_value, ioc_type)
        if vt:
            results.append(vt)

    if ioc_type == "ip":
        abuse = await lookup_abuseipdb(ioc_value)
        if abuse:
            results.append(abuse)

        shodan = await lookup_shodan_internetdb(ioc_value)
        if shodan:
            results.append(shodan)

    if ioc_type in ("domain", "url"):
        urlscan = await lookup_urlscan(ioc_value, ioc_type)
        if urlscan:
            results.append(urlscan)

        whois_data = await lookup_whois(ioc_value, ioc_type)
        if whois_data:
            results.append(whois_data)

    return results
