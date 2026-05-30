"""IOC feed pollers — MalwareBazaar, URLhaus, ThreatFox (all from abuse.ch)."""

import json
import logging
from datetime import datetime, timezone

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from models import IOC
from services.alert_engine import evaluate_rules
from services.attack_mapper import map_to_attack
from services.scoring import compute_ioc_score, score_label
from services.watchlist_checker import check_watchlist

logger = logging.getLogger(__name__)

TIMEOUT = httpx.Timeout(30.0, connect=10.0)


def _apply_score(ioc: IOC) -> None:
    score, breakdown = compute_ioc_score(
        confidence=ioc.confidence,
        source=ioc.source,
        first_seen=ioc.first_seen,
        seen_count=ioc.seen_count,
        raw_data=ioc.raw_data,
    )
    ioc.threat_score = score
    ioc.score_breakdown = json.dumps(breakdown)


def _merge_sources(existing_sources: str | None, new_source: str) -> str:
    sources: list[str] = json.loads(existing_sources) if existing_sources else []
    if new_source not in sources:
        sources.append(new_source)
    return json.dumps(sources)


async def _upsert_ioc(
    db: AsyncSession,
    *,
    ioc_type: str,
    value: str,
    source: str,
    threat_type: str | None = None,
    malware_family: str | None = None,
    confidence: int = 50,
    tags: str = "",
) -> tuple[IOC, bool]:
    """Return (ioc, is_new). Merges fields if the IOC already exists."""
    existing = (await db.execute(select(IOC).where(IOC.value == value))).scalar_one_or_none()

    if existing:
        existing.seen_count = (existing.seen_count or 1) + 1
        existing.sources = _merge_sources(existing.sources, source)
        existing.last_seen = datetime.now(timezone.utc)
        existing.confidence = max(existing.confidence, confidence)
        if threat_type and not existing.threat_type:
            existing.threat_type = threat_type
        if malware_family and not existing.malware_family:
            existing.malware_family = malware_family
        _apply_score(existing)
        return existing, False

    sources_json = json.dumps([source])
    attack_ids = map_to_attack(f"{threat_type or ''} {malware_family or ''} {tags or ''}")
    ioc = IOC(
        ioc_type=ioc_type,
        value=value,
        source=source,
        threat_type=threat_type,
        malware_family=malware_family,
        confidence=confidence,
        tags=tags,
        seen_count=1,
        sources=sources_json,
        attack_tags=", ".join(attack_ids) if attack_ids else None,
    )
    db.add(ioc)
    await db.flush()  # get ioc.id before watchlist check
    _apply_score(ioc)
    return ioc, True


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

            ioc, is_new = await _upsert_ioc(
                db,
                ioc_type="hash",
                value=sha256,
                source="malwarebazaar",
                threat_type=sample.get("threat_type"),
                malware_family=sample.get("signature"),
                confidence=80,
                tags=", ".join(sample.get("tags", []) or []),
            )
            if is_new:
                await check_watchlist(ioc, db)
                await evaluate_rules(ioc, db)
                new_count += 1

        await db.commit()
        logger.info(f"[MalwareBazaar] {new_count} new IOCs")

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

            ioc, is_new = await _upsert_ioc(
                db,
                ioc_type="url",
                value=mal_url[:1000],
                source="urlhaus",
                threat_type=entry.get("threat"),
                tags=", ".join(entry.get("tags", []) or []),
                confidence=70,
            )
            if is_new:
                await check_watchlist(ioc, db)
                await evaluate_rules(ioc, db)
                new_count += 1

        await db.commit()
        logger.info(f"[URLhaus] {new_count} new IOCs")

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

            ioc, is_new = await _upsert_ioc(
                db,
                ioc_type=entry.get("ioc_type", "unknown"),
                value=ioc_value[:1000],
                source="threatfox",
                threat_type=entry.get("threat_type"),
                malware_family=entry.get("malware_printable"),
                confidence=int(entry.get("confidence_level", 50)),
                tags=", ".join(entry.get("tags", []) or []),
            )
            if is_new:
                await check_watchlist(ioc, db)
                await evaluate_rules(ioc, db)
                new_count += 1

        await db.commit()
        logger.info(f"[ThreatFox] {new_count} new IOCs")

    except Exception as e:
        logger.error(f"[ThreatFox] Poll failed: {e}")
        await db.rollback()

    return new_count


async def poll_all_ioc_feeds(db: AsyncSession) -> dict[str, int]:
    """Poll all IOC feeds. Returns {source: new_count}."""
    return {
        "malwarebazaar": await poll_malwarebazaar(db),
        "urlhaus": await poll_urlhaus(db),
        "threatfox": await poll_threatfox(db),
    }
