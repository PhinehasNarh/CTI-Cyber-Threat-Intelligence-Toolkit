"""Audit logging service (#25).

A tiny helper so any router can record an analyst action in one line:

    from services.audit import log_action
    await log_action(db, "create", "campaign", campaign.id, f"Created campaign '{campaign.name}'")

The caller owns the transaction — log_action adds the row to the session but does
not commit, so it rides along with the surrounding operation's commit.
"""

from sqlalchemy.ext.asyncio import AsyncSession

from models import AuditLog


async def log_action(
    db: AsyncSession,
    action: str,
    entity_type: str,
    entity_id=None,
    summary: str = "",
    actor: str = "analyst",
) -> None:
    db.add(
        AuditLog(
            action=action,
            entity_type=entity_type,
            entity_id=str(entity_id) if entity_id is not None else None,
            summary=summary or f"{action} {entity_type}",
            actor=actor,
        )
    )
