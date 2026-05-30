"""Data retention service (#33).

Computes and applies retention policies. Deletion is destructive, so the router
always offers a non-destructive preview (count) before a purge, and policies are
inactive by default. Archive-to-cold-storage (S3/MinIO) is left as future work.
"""

from datetime import datetime, timedelta, timezone

from sqlalchemy import select, func, delete
from sqlalchemy.ext.asyncio import AsyncSession

from models import RetentionPolicy, FeedArticle, IOC
from services.audit import log_action

_MODELS = {"article": FeedArticle, "ioc": IOC}
_AGE_COLUMN = {"article": "fetched_at", "ioc": "first_seen"}


def _cutoff(days: int) -> datetime:
    return datetime.now(timezone.utc) - timedelta(days=days)


def _match_query(policy: RetentionPolicy):
    model = _MODELS[policy.entity_type]
    age_col = getattr(model, _AGE_COLUMN[policy.entity_type])
    conditions = [age_col < _cutoff(policy.max_age_days)]
    if policy.source:
        conditions.append(model.source == policy.source)
    return model, conditions


async def preview_policy(db: AsyncSession, policy: RetentionPolicy) -> int:
    """How many rows the policy would purge right now (non-destructive)."""
    model, conditions = _match_query(policy)
    q = select(func.count(model.id))
    for c in conditions:
        q = q.where(c)
    return (await db.execute(q)).scalar() or 0


async def run_policy(db: AsyncSession, policy: RetentionPolicy) -> int:
    """Purge matching rows and update the policy's run metadata."""
    model, conditions = _match_query(policy)
    count = await preview_policy(db, policy)
    if count > 0:
        stmt = delete(model)
        for c in conditions:
            stmt = stmt.where(c)
        await db.execute(stmt)
        await log_action(
            db, "delete", "retention", policy.id,
            f"Retention purged {count} {policy.entity_type}(s) older than {policy.max_age_days}d"
            + (f" from {policy.source}" if policy.source else ""),
        )
    policy.last_run = datetime.now(timezone.utc)
    policy.last_purged = count
    await db.commit()
    return count


async def run_all_active(db: AsyncSession) -> dict:
    """Scheduled sweep: run every active policy. Returns per-policy purge counts."""
    policies = (await db.execute(
        select(RetentionPolicy).where(RetentionPolicy.is_active == True)
    )).scalars().all()
    results = {}
    for p in policies:
        results[p.id] = await run_policy(db, p)
    return results
