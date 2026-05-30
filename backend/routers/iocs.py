"""API routes for IOCs (Indicators of Compromise)."""

import json
import re
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select, func, desc, or_, text
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from models import IOC, CampaignIOC
from routers.workspaces import active_workspace
from feeds.ioc_feeds import poll_all_ioc_feeds
from services.enrichment import enrich_ioc
from services.scoring import compute_ioc_score, score_label

router = APIRouter(prefix="/api/iocs", tags=["iocs"])

IOC_PATTERNS = {
    "hash": re.compile(r"^[a-fA-F0-9]{32,64}$"),
    "ip": re.compile(r"^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$"),
    "domain": re.compile(r"^[a-zA-Z0-9]([a-zA-Z0-9\-]*\.)+[a-zA-Z]{2,}$"),
    "url": re.compile(r"^https?://"),
}


def detect_ioc_type(value: str) -> str:
    for ioc_type, pattern in IOC_PATTERNS.items():
        if pattern.match(value):
            return ioc_type
    return "unknown"


def _serialize(i: IOC) -> dict:
    return {
        "id": i.id,
        "ioc_type": i.ioc_type,
        "value": i.value,
        "source": i.source,
        "threat_type": i.threat_type,
        "malware_family": i.malware_family,
        "confidence": i.confidence,
        "threat_score": round(i.threat_score or 0, 1),
        "score_label": score_label(i.threat_score or 0),
        "seen_count": i.seen_count or 1,
        "sources": json.loads(i.sources) if i.sources else [i.source],
        "first_seen": i.first_seen.isoformat() if i.first_seen else None,
        "last_seen": i.last_seen.isoformat() if i.last_seen else None,
        "tags": i.tags.split(", ") if i.tags else [],
        "analyst_notes": i.analyst_notes,
        "analyst_tags": i.analyst_tags.split(", ") if i.analyst_tags else [],
        "assignee": i.assignee,
        "triage_status": i.triage_status or "new",
    }


@router.get("")
async def list_iocs(
    ioc_type: str | None = None,
    source: str | None = None,
    search: str | None = None,
    sort: str = Query(default="score", pattern="^(score|first_seen)$"),
    limit: int = Query(default=50, le=200),
    offset: int = Query(default=0, ge=0),
    db: AsyncSession = Depends(get_db),
    ws: int = Depends(active_workspace),
):
    order = desc(IOC.threat_score) if sort == "score" else desc(IOC.first_seen)
    query = select(IOC).where(IOC.workspace_id == ws).order_by(order)

    if ioc_type:
        query = query.where(IOC.ioc_type == ioc_type)
    if source:
        query = query.where(IOC.source == source)
    if search:
        pattern = f"%{search}%"
        query = query.where(
            or_(
                IOC.value.ilike(pattern),
                IOC.malware_family.ilike(pattern),
                IOC.tags.ilike(pattern),
            )
        )

    result = await db.execute(query.offset(offset).limit(limit))
    iocs = result.scalars().all()
    return {"count": len(iocs), "offset": offset, "iocs": [_serialize(i) for i in iocs]}


@router.get("/search")
async def fts_search(
    q: str = Query(..., min_length=2, description="Full-text search query"),
    limit: int = Query(default=50, le=200),
    db: AsyncSession = Depends(get_db),
):
    """Full-text search across IOC values, threat types, malware families, and tags."""
    fts_result = await db.execute(
        text("SELECT rowid FROM iocs_fts WHERE iocs_fts MATCH :q ORDER BY rank LIMIT :limit"),
        {"q": q, "limit": limit},
    )
    ids = [row[0] for row in fts_result.fetchall()]
    if not ids:
        return {"count": 0, "query": q, "iocs": []}

    result = await db.execute(
        select(IOC).where(IOC.id.in_(ids)).order_by(desc(IOC.threat_score))
    )
    iocs = result.scalars().all()
    return {"count": len(iocs), "query": q, "iocs": [_serialize(i) for i in iocs]}


@router.get("/graph")
async def correlation_graph(
    limit: int = Query(default=80, le=200),
    db: AsyncSession = Depends(get_db),
):
    """Correlation graph (#3): IOCs as nodes, edges where they share a malware
    family or a campaign. Only connected nodes are returned, so the graph stays
    readable. Edges within a family group are capped to a star to avoid hairballs.
    """
    # Candidate IOCs: highest-scoring with a family, plus anything in a campaign
    rows = (await db.execute(
        select(IOC).where(IOC.malware_family.is_not(None))
        .order_by(desc(IOC.threat_score)).limit(limit)
    )).scalars().all()
    by_id = {i.id: i for i in rows}

    # Pull campaign memberships for the candidate set
    camp_rows = (await db.execute(
        select(CampaignIOC.campaign_id, CampaignIOC.ioc_id)
    )).all()

    edges: list[dict] = []
    seen_pairs: set[tuple[int, int]] = set()

    def add_edge(a: int, b: int, kind: str):
        if a == b:
            return
        key = (a, b) if a < b else (b, a)
        if key in seen_pairs:
            return
        seen_pairs.add(key)
        edges.append({"source": key[0], "target": key[1], "kind": kind})

    # Family edges: connect each family group as a star around its top-scoring member
    families: dict[str, list[IOC]] = {}
    for i in rows:
        families.setdefault(i.malware_family, []).append(i)
    for members in families.values():
        if len(members) < 2:
            continue
        members.sort(key=lambda x: -(x.threat_score or 0))
        hub = members[0].id
        for m in members[1:]:
            add_edge(hub, m.id, "family")

    # Campaign edges: connect IOCs sharing a campaign (only candidates we have)
    camp_groups: dict[int, list[int]] = {}
    for cid, iid in camp_rows:
        if iid in by_id:
            camp_groups.setdefault(cid, []).append(iid)
    for members in camp_groups.values():
        for j in range(1, len(members)):
            add_edge(members[0], members[j], "campaign")

    connected = {e["source"] for e in edges} | {e["target"] for e in edges}
    nodes = [
        {
            "id": i.id,
            "label": i.value if len(i.value) <= 28 else i.value[:25] + "...",
            "ioc_type": i.ioc_type,
            "family": i.malware_family,
            "score": round(i.threat_score or 0, 1),
        }
        for i in rows if i.id in connected
    ]
    return {"node_count": len(nodes), "edge_count": len(edges), "nodes": nodes, "edges": edges}


@router.get("/stats")
async def ioc_stats(db: AsyncSession = Depends(get_db), ws: int = Depends(active_workspace)):
    type_result = await db.execute(
        select(IOC.ioc_type, func.count(IOC.id)).where(IOC.workspace_id == ws).group_by(IOC.ioc_type)
    )
    source_result = await db.execute(
        select(IOC.source, func.count(IOC.id)).where(IOC.workspace_id == ws).group_by(IOC.source)
    )
    total = await db.execute(select(func.count(IOC.id)).where(IOC.workspace_id == ws))
    critical = await db.execute(select(func.count(IOC.id)).where(IOC.workspace_id == ws, IOC.threat_score >= 75))
    high = await db.execute(select(func.count(IOC.id)).where(IOC.workspace_id == ws, IOC.threat_score >= 50, IOC.threat_score < 75))

    return {
        "total": total.scalar() or 0,
        "by_type": {row[0]: row[1] for row in type_result.all()},
        "by_source": {row[0]: row[1] for row in source_result.all()},
        "by_severity": {
            "critical": critical.scalar() or 0,
            "high": high.scalar() or 0,
        },
    }


@router.post("/lookup")
async def lookup_ioc(value: str, ioc_type: str | None = None):
    """Lookup and enrich a single IOC. Auto-detects type if not provided."""
    value = value.strip()
    if not ioc_type:
        ioc_type = detect_ioc_type(value)

    enrichments = await enrich_ioc(value, ioc_type)

    # Compute a live score from the enrichment result alone
    score, breakdown = compute_ioc_score(
        confidence=50,
        source="manual",
        first_seen=datetime.now(timezone.utc),
        seen_count=1,
        raw_data=json.dumps(enrichments) if enrichments else None,
    )

    return {
        "value": value,
        "detected_type": ioc_type,
        "threat_score": round(score, 1),
        "score_label": score_label(score),
        "enrichments": enrichments,
    }


@router.get("/tags")
async def list_tags(db: AsyncSession = Depends(get_db)):
    """Distinct analyst tags across IOCs with usage counts (#22)."""
    result = await db.execute(
        select(IOC.analyst_tags).where(IOC.analyst_tags.is_not(None))
    )
    counts: dict[str, int] = {}
    for (raw,) in result.all():
        for tag in (raw or "").split(", "):
            tag = tag.strip()
            if tag:
                counts[tag] = counts.get(tag, 0) + 1
    tags = sorted(counts.items(), key=lambda kv: (-kv[1], kv[0]))
    return {"count": len(tags), "tags": [{"tag": t, "count": c} for t, c in tags]}


@router.patch("/{ioc_id}")
async def update_ioc(
    ioc_id: int,
    analyst_notes: str | None = None,
    analyst_tags: str | None = None,
    assignee: str | None = None,
    triage_status: str | None = None,
    db: AsyncSession = Depends(get_db),
):
    """Update analyst notes, tags, assignment, or triage status on an IOC."""
    from fastapi import HTTPException
    from services.audit import log_action
    ioc = (await db.execute(select(IOC).where(IOC.id == ioc_id))).scalar_one_or_none()
    if not ioc:
        raise HTTPException(status_code=404, detail="IOC not found")
    if analyst_notes is not None:
        ioc.analyst_notes = analyst_notes or None
    if analyst_tags is not None:
        ioc.analyst_tags = analyst_tags or None
    if assignee is not None:
        ioc.assignee = assignee or None
        await log_action(db, "update", "ioc", ioc_id, f"Assigned IOC {ioc.value} to {assignee or 'unassigned'}")
    if triage_status is not None:
        ioc.triage_status = triage_status
        await log_action(db, "update", "ioc", ioc_id, f"Set IOC {ioc.value} triage status to {triage_status}")
    await db.commit()
    return {"status": "updated", "id": ioc_id}


@router.post("/poll")
async def trigger_ioc_poll(db: AsyncSession = Depends(get_db)):
    """Manually trigger a poll of all IOC feeds."""
    results = await poll_all_ioc_feeds(db)
    total = sum(results.values())
    return {"status": "completed", "total_new": total, "per_source": results}
