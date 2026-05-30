"""Checks a newly ingested IOC against all active watchlist patterns."""

import logging
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from models import IOC, Watchlist, WatchlistHit

logger = logging.getLogger(__name__)


def _matches(ioc_value: str, pattern: str) -> bool:
    """True if the IOC value matches the watchlist pattern.

    Rules:
      - Exact match always works.
      - Pattern starting with '.' is a domain suffix: matches if ioc_value
        ends with it or equals the bare domain (e.g. '.evil.com' hits 'sub.evil.com').
      - Otherwise substring match (catches URLs containing a watched domain/IP).
    """
    ioc_lower = ioc_value.lower()
    pat_lower = pattern.lower()

    if ioc_lower == pat_lower:
        return True
    if pat_lower.startswith("."):
        return ioc_lower.endswith(pat_lower) or ioc_lower == pat_lower.lstrip(".")
    return pat_lower in ioc_lower


async def check_watchlist(ioc: IOC, db: AsyncSession) -> int:
    """Create WatchlistHit rows for any patterns that match *ioc*.
    Returns the number of hits recorded."""
    result = await db.execute(select(Watchlist))
    entries = result.scalars().all()
    hits = 0

    for entry in entries:
        if not _matches(ioc.value, entry.pattern):
            continue

        hit = WatchlistHit(
            watchlist_id=entry.id,
            ioc_id=ioc.id,
            ioc_value=ioc.value,
            ioc_type=ioc.ioc_type,
            source=ioc.source,
        )
        db.add(hit)
        await db.execute(
            update(Watchlist)
            .where(Watchlist.id == entry.id)
            .values(hit_count=entry.hit_count + 1)
        )
        hits += 1
        logger.warning(
            f"[Watchlist] HIT — pattern '{entry.pattern}' ({entry.label}) "
            f"matched {ioc.ioc_type} IOC: {ioc.value}"
        )

    return hits
