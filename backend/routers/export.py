"""IOC export — download filtered IOC sets in various formats."""

import csv
import io
import json
import uuid
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, Query
from fastapi.responses import Response
from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from models import IOC

router = APIRouter(prefix="/api/export", tags=["export"])


def _hash_pattern(value: str) -> str:
    length = len(value)
    if length == 32:
        return f"[file:hashes.MD5 = '{value}']"
    if length == 40:
        return f"[file:hashes.SHA-1 = '{value}']"
    return f"[file:hashes.SHA-256 = '{value}']"


def _stix_pattern(ioc: IOC) -> str:
    if ioc.ioc_type == "ip":
        return f"[ipv4-addr:value = '{ioc.value}']"
    if ioc.ioc_type == "domain":
        return f"[domain-name:value = '{ioc.value}']"
    if ioc.ioc_type == "url":
        return f"[url:value = '{ioc.value}']"
    if ioc.ioc_type == "hash":
        return _hash_pattern(ioc.value)
    return f"[artifact:mime_type = '{ioc.value}']"


async def _query_iocs(
    db: AsyncSession,
    ioc_type: str | None,
    min_score: float,
    days: int | None,
) -> list[IOC]:
    query = select(IOC).where(IOC.threat_score >= min_score)
    if ioc_type:
        query = query.where(IOC.ioc_type == ioc_type)
    if days:
        cutoff = datetime.now(timezone.utc) - timedelta(days=days)
        query = query.where(IOC.first_seen >= cutoff)
    result = await db.execute(query.order_by(IOC.threat_score.desc()).limit(10000))
    return result.scalars().all()


@router.get("/iocs")
async def export_iocs(
    format: str = Query(default="json", pattern="^(json|csv|suricata|iptables|stix)$"),
    ioc_type: str | None = None,
    min_score: float = Query(default=0.0, ge=0, le=100),
    days: int | None = Query(default=None, ge=1, le=365),
    db: AsyncSession = Depends(get_db),
):
    iocs = await _query_iocs(db, ioc_type, min_score, days)

    if format == "json":
        data = json.dumps(
            [
                {
                    "value": i.value,
                    "type": i.ioc_type,
                    "source": i.source,
                    "threat_type": i.threat_type,
                    "malware_family": i.malware_family,
                    "confidence": i.confidence,
                    "threat_score": round(i.threat_score or 0, 1),
                    "first_seen": i.first_seen.isoformat() if i.first_seen else None,
                    "tags": i.tags,
                }
                for i in iocs
            ],
            indent=2,
        )
        return Response(
            content=data,
            media_type="application/json",
            headers={"Content-Disposition": "attachment; filename=cti_iocs.json"},
        )

    if format == "csv":
        buf = io.StringIO()
        writer = csv.writer(buf)
        writer.writerow(["value", "type", "source", "threat_type", "malware_family",
                          "confidence", "threat_score", "first_seen", "tags"])
        for i in iocs:
            writer.writerow([
                i.value, i.ioc_type, i.source,
                i.threat_type or "", i.malware_family or "",
                i.confidence, round(i.threat_score or 0, 1),
                i.first_seen.isoformat() if i.first_seen else "",
                i.tags or "",
            ])
        return Response(
            content=buf.getvalue(),
            media_type="text/csv",
            headers={"Content-Disposition": "attachment; filename=cti_iocs.csv"},
        )

    if format == "suricata":
        lines = [
            f"# CTI Platform IOC blocklist — generated {datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')}",
            f"# {len(iocs)} indicators | min_score={min_score}",
            "",
        ]
        sid = 9000000
        for i in iocs:
            label = (i.malware_family or i.threat_type or i.source or "malicious").replace(" ", "_")
            if i.ioc_type == "ip":
                lines.append(
                    f'drop ip {i.value} any -> $HOME_NET any '
                    f'(msg:"CTI-{label}-inbound"; sid:{sid}; rev:1;)'
                )
                sid += 1
                lines.append(
                    f'drop ip $HOME_NET any -> {i.value} any '
                    f'(msg:"CTI-{label}-outbound"; sid:{sid}; rev:1;)'
                )
            elif i.ioc_type == "domain":
                lines.append(
                    f'drop dns $HOME_NET any -> any 53 '
                    f'(msg:"CTI-{label}-dns"; dns.query; content:"{i.value}"; nocase; sid:{sid}; rev:1;)'
                )
            elif i.ioc_type == "url":
                host = i.value.split("/")[2] if "//" in i.value else i.value[:60]
                lines.append(
                    f'drop http $HOME_NET any -> any any '
                    f'(msg:"CTI-{label}-http"; http.host; content:"{host}"; nocase; sid:{sid}; rev:1;)'
                )
            sid += 1
        return Response(
            content="\n".join(lines),
            media_type="text/plain",
            headers={"Content-Disposition": "attachment; filename=cti_iocs.rules"},
        )

    if format == "iptables":
        ip_iocs = [i for i in iocs if i.ioc_type == "ip"]
        lines = [
            f"# CTI Platform iptables blocklist — {datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')}",
            f"# {len(ip_iocs)} IP indicators",
            "",
        ]
        for i in ip_iocs:
            lines.append(f"iptables -I INPUT -s {i.value} -j DROP")
            lines.append(f"iptables -I OUTPUT -d {i.value} -j DROP")
        return Response(
            content="\n".join(lines),
            media_type="text/plain",
            headers={"Content-Disposition": "attachment; filename=cti_blocklist.sh"},
        )

    # STIX 2.1
    now_iso = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.000Z")
    objects = []
    for i in iocs:
        objects.append({
            "type": "indicator",
            "spec_version": "2.1",
            "id": f"indicator--{uuid.uuid4()}",
            "created": i.first_seen.strftime("%Y-%m-%dT%H:%M:%S.000Z") if i.first_seen else now_iso,
            "modified": now_iso,
            "name": f"{i.ioc_type}: {i.value[:80]}",
            "description": f"Source: {i.source}. {i.threat_type or ''}. {i.malware_family or ''}".strip(". "),
            "pattern": _stix_pattern(i),
            "pattern_type": "stix",
            "valid_from": i.first_seen.strftime("%Y-%m-%dT%H:%M:%S.000Z") if i.first_seen else now_iso,
            "confidence": i.confidence,
            "labels": [lbl for lbl in [i.threat_type, i.malware_family] if lbl],
        })
    bundle = {
        "type": "bundle",
        "id": f"bundle--{uuid.uuid4()}",
        "spec_version": "2.1",
        "objects": objects,
    }
    return Response(
        content=json.dumps(bundle, indent=2),
        media_type="application/json",
        headers={"Content-Disposition": "attachment; filename=cti_iocs.stix.json"},
    )
