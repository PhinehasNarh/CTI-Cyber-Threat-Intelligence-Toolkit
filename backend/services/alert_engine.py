"""Alert engine — evaluates active rules against newly ingested IOCs."""

import asyncio
import json
import logging

import httpx
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from models import IOC, AlertRule, AlertHit

logger = logging.getLogger(__name__)
_TIMEOUT = httpx.Timeout(10.0, connect=5.0)


def _matches(ioc: IOC, conditions: dict) -> bool:
    ioc_types = conditions.get("ioc_types", [])
    if ioc_types and ioc.ioc_type not in ioc_types:
        return False

    sources = conditions.get("sources", [])
    if sources and ioc.source not in sources:
        return False

    min_conf = conditions.get("min_confidence", 0)
    if ioc.confidence < min_conf:
        return False

    min_score = conditions.get("min_score", 0)
    if (ioc.threat_score or 0) < min_score:
        return False

    keywords = conditions.get("keywords", [])
    if keywords:
        haystack = " ".join(
            filter(None, [ioc.value, ioc.threat_type, ioc.malware_family, ioc.tags])
        ).lower()
        if not any(kw.lower() in haystack for kw in keywords):
            return False

    return True


async def _fire_webhook(url: str, rule: AlertRule, ioc: IOC) -> None:
    payload = {
        "rule": rule.name,
        "severity": rule.severity,
        "ioc_type": ioc.ioc_type,
        "ioc_value": ioc.value,
        "source": ioc.source,
        "threat_type": ioc.threat_type,
        "malware_family": ioc.malware_family,
        "confidence": ioc.confidence,
        "threat_score": round(ioc.threat_score or 0, 1),
    }
    try:
        async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
            await client.post(url, json=payload)
        logger.info(f"[AlertEngine] Webhook delivered for rule '{rule.name}'")
    except Exception as e:
        logger.warning(f"[AlertEngine] Webhook failed for rule '{rule.name}': {e}")


async def evaluate_rules(ioc: IOC, db: AsyncSession) -> int:
    """Evaluate all active rules against *ioc*. Returns number of rules fired."""
    result = await db.execute(
        select(AlertRule).where(AlertRule.is_active == True)
    )
    rules = result.scalars().all()
    fired = 0

    for rule in rules:
        try:
            conditions = json.loads(rule.conditions)
        except Exception:
            continue

        if not _matches(ioc, conditions):
            continue

        hit = AlertHit(
            rule_id=rule.id,
            ioc_id=ioc.id,
            ioc_value=ioc.value,
            ioc_type=ioc.ioc_type,
            severity=rule.severity,
        )
        db.add(hit)
        await db.execute(
            update(AlertRule)
            .where(AlertRule.id == rule.id)
            .values(hit_count=rule.hit_count + 1)
        )
        fired += 1

        logger.warning(
            f"[AlertEngine] RULE FIRED '{rule.name}' ({rule.severity}) "
            f"— {ioc.ioc_type} {ioc.value} from {ioc.source}"
        )

        action = {}
        if rule.action:
            try:
                action = json.loads(rule.action)
            except Exception:
                pass

        webhook_url = action.get("webhook_url")
        if webhook_url:
            asyncio.create_task(_fire_webhook(webhook_url, rule, ioc))

    return fired
