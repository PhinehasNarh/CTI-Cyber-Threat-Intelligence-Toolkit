"""CISA Known Exploited Vulnerabilities (KEV) catalog sync."""

import logging
from datetime import datetime, timezone

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from models import CVE

logger = logging.getLogger(__name__)

KEV_URL = "https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json"
TIMEOUT = httpx.Timeout(30.0, connect=10.0)


async def sync_kev_catalog(db: AsyncSession) -> int:
    """Fetch the full CISA KEV catalog and upsert into the CVE table."""
    new_count = 0

    try:
        async with httpx.AsyncClient(timeout=TIMEOUT) as client:
            resp = await client.get(KEV_URL)
            resp.raise_for_status()
            data = resp.json()

        for vuln in data.get("vulnerabilities", []):
            cve_id = vuln.get("cveID")
            if not cve_id:
                continue

            existing = await db.execute(select(CVE).where(CVE.cve_id == cve_id))
            cve = existing.scalar_one_or_none()

            if cve:
                # Update existing — mark as in KEV
                cve.in_cisa_kev = True
                cve.has_exploit = True
                if not cve.description:
                    cve.description = vuln.get("shortDescription")
                if not cve.affected_products:
                    cve.affected_products = f"{vuln.get('vendorProject', '')} {vuln.get('product', '')}".strip()
            else:
                # Parse date
                pub_date = None
                date_str = vuln.get("dateAdded")
                if date_str:
                    try:
                        pub_date = datetime.strptime(date_str, "%Y-%m-%d").replace(tzinfo=timezone.utc)
                    except ValueError:
                        pass

                cve = CVE(
                    cve_id=cve_id,
                    description=vuln.get("shortDescription"),
                    affected_products=f"{vuln.get('vendorProject', '')} {vuln.get('product', '')}".strip(),
                    published_date=pub_date,
                    in_cisa_kev=True,
                    has_exploit=True,
                    severity=vuln.get("knownRansomwareCampaignUse", "Unknown"),
                    references=vuln.get("notes", ""),
                )
                db.add(cve)
                new_count += 1

        await db.commit()
        logger.info(f"[CISA KEV] Synced catalog — {new_count} new CVEs added")

    except Exception as e:
        logger.error(f"[CISA KEV] Sync failed: {e}")
        await db.rollback()

    return new_count
