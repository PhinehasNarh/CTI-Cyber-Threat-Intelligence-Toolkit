"""IP geolocation via ip-api.com (#17).

Free, no API key. Uses the batch endpoint (one request per 100 IPs) and an
in-process cache to stay under the public rate limit. Degrades gracefully when
the service is unreachable.
"""

import httpx

BATCH_URL = "http://ip-api.com/batch"
_FIELDS = "status,country,countryCode,lat,lon,city,isp,query"

# Module-level cache: ip -> geo dict (or None if lookup failed/private)
_cache: dict[str, dict | None] = {}


def _chunks(items: list, size: int):
    for i in range(0, len(items), size):
        yield items[i:i + size]


async def geolocate(ips: list[str]) -> tuple[dict[str, dict], bool]:
    """Return ({ip: geo}, reachable). Cached IPs skip the network."""
    unique = list(dict.fromkeys(ips))
    todo = [ip for ip in unique if ip not in _cache]
    reachable = True

    if todo:
        try:
            async with httpx.AsyncClient(timeout=12.0) as client:
                for chunk in _chunks(todo, 100):
                    resp = await client.post(f"{BATCH_URL}?fields={_FIELDS}", json=chunk)
                    resp.raise_for_status()
                    for row in resp.json():
                        ip = row.get("query")
                        if not ip:
                            continue
                        _cache[ip] = row if row.get("status") == "success" else None
        except (httpx.HTTPError, ValueError):
            reachable = False

    resolved = {ip: _cache[ip] for ip in unique if _cache.get(ip)}
    return resolved, reachable
