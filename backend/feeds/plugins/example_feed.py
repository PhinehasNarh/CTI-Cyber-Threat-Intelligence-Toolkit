"""Example feed plugin (#30).

A complete, working plugin in well under 50 lines. Copy this file, rename the
class, and implement fetch() to add a new source. It is auto-discovered, no
registration or core changes required.

This example pulls the Feodo Tracker botnet C2 IP blocklist from abuse.ch
(free, no key). Delete or disable it freely.
"""

import httpx

from feeds.sdk import FeedPlugin


class FeodoTrackerFeed(FeedPlugin):
    name = "feodo-tracker"
    feed_type = "ioc"

    URL = "https://feodotracker.abuse.ch/downloads/ipblocklist.json"

    async def fetch(self) -> list[dict]:
        try:
            async with httpx.AsyncClient(timeout=20.0) as client:
                resp = await client.get(self.URL)
            resp.raise_for_status()
            rows = resp.json()
        except (httpx.HTTPError, ValueError):
            return []

        items = []
        for r in rows[:200]:
            ip = r.get("ip_address")
            if not ip:
                continue
            items.append({
                "value": ip,
                "ioc_type": "ip",
                "malware_family": r.get("malware"),
                "threat_type": "botnet_cc",
                "confidence": 75,
                "tags": "feodo, c2",
            })
        return items
