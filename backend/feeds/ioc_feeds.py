"""IOC feed pollers — MalwareBazaar, URLhaus, ThreatFox (all from abuse.ch)."""

import logging
from datetime import datetime, timezone

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from models import IOC

logger = logging.getLogger(__name__)

TIMEOUT = httpx.Timeout(30.0, connect=10.0)


async def poll_malwarebazaar(db: AsyncSession, limit: int = 50) -> int:
    """Fetch recent malware samples from MalwareBazaar."""
    url = "https://mb-api.abuse.ch/api/v1/"
    new_count = 0

    try:
        async with httpx.AsyncClient(timeout=TIMEOUT) as client:
            resp = await client.post(url, data={"query": "get_recent", "selector": str(limit)})
            resp.raise_for_status()
            data = resp.json()

        if data.get("query_status") != "ok":
            logger.warning(f"MalwareBazaar query_status: {data.get('query_status')}")
            return 0

        for sample in data.get("data", []):
            sha256 = sample.get("sha256_hash")
            if not sha256:
                continue

            existing = await db.execute(select(IOC).where(IOC.value == sha256))
            if existing.scalar_one_or_none():
                continue

            ioc = IOC(
                ioc_type="hash",
                value=sha256,
                source="malwarebazaar",
                threat_type=sample.get("threat_type"),
                malware_family=sample.get("signature"),
                confidence=80,
                tags=", ".join(sample.get("tags", []) or []),
            )
            db.add(ioc)
            new_count += 1

        await db.commit()
        logger.info(f"[MalwareBazaar] Fetched {new_count} new IOCs")

    except Exception as e:
        logger.error(f"[MalwareBazaar] Poll failed: {e}")
        await db.rollback()

    return new_count


async def poll_urlhaus(db: AsyncSession, limit: int = 50) -> int:
    """Fetch recent malicious URLs from URLhaus."""
    url = "https://urlhaus-api.abuse.ch/v1/urls/recent/limit/" + str(limit) + "/"
    new_count = 0

    try:
        async with httpx.AsyncClient(timeout=TIMEOUT) as client:
            resp = await client.get(url)
            resp.raise_for_status()
            data = resp.json()

        for entry in data.get("urls", []):
            mal_url = entry.get("url")
            if not mal_url:
                continue

            existing = await db.execute(select(IOC).where(IOC.value == mal_url))
            if existing.scalar_one_or_none():
                continue

            ioc = IOC(
                ioc_type="url",
                value=mal_url[:1000],
                source="urlhaus",
                threat_type=entry.get("threat"),
                tags=", ".join(entry.get("tags", []) or []),
                confidence=70,
            )
            db.add(ioc)
            new_count += 1

        await db.commit()
        logger.info(f"[URLhaus] Fetched {new_count} new IOCs")

    except Exception as e:
        logger.error(f"[URLhaus] Poll failed: {e}")
        await db.rollback()

    return new_count


async def poll_threatfox(db: AsyncSession, days: int = 1) -> int:
    """Fetch recent IOCs from ThreatFox."""
    url = "https://threatfox-api.abuse.ch/api/v1/"
    new_count = 0

    try:
        async with httpx.AsyncClient(timeout=TIMEOUT) as client:
            resp = await client.post(url, json={"query": "get_iocs", "days": days})
            resp.raise_for_status()
            data = resp.json()

        if data.get("query_status") != "ok":
            return 0

        for entry in data.get("data", []):
            ioc_value = entry.get("ioc")
            if not ioc_value:
                continue

            existing = await db.execute(select(IOC).where(IOC.value == ioc_value))
            if existing.scalar_one_or_none():
                continue

            ioc = IOC(
                ioc_type=entry.get("ioc_type", "unknown"),
                value=ioc_value[:1000],
                source="threatfox",
                threat_type=entry.get("threat_type"),
                malware_family=entry.get("malware_printable"),
                confidence=int(entry.get("confidence_level", 50)),
                tags=", ".join(entry.get("tags", []) or []),
            )
            db.add(ioc)
            new_count += 1

        await db.commit()
        logger.info(f"[ThreatFox] Fetched {new_count} new IOCs")

    except Exception as e:
        logger.error(f"[ThreatFox] Poll failed: {e}")
        await db.rollback()

    return new_count


async def poll_all_ioc_feeds(db: AsyncSession) -> dict[str, int]:
    """Poll all IOC feeds. Returns {source: new_count}."""
    results = {}
    results["malwarebazaar"] = await poll_malwarebazaar(db)
    results["urlhaus"] = await poll_urlhaus(db)
    results["threatfox"] = await poll_threatfox(db)
    return results
