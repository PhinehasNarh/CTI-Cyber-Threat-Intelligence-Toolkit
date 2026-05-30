"""Feed plugin SDK (#30).

Write a new feed source in ~50 lines: subclass FeedPlugin, set `name` and
`feed_type`, and implement async `fetch()` returning a list of plain dicts.
Drop the file in feeds/plugins/ and it is auto-discovered, no core changes.

IOC item dict:     {value, ioc_type?, malware_family?, threat_type?, confidence?, tags?}
Article item dict: {title, url, source?, summary?}
"""

import importlib
import logging
import pkgutil
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger(__name__)


class FeedPlugin:
    """Base class for community feed plugins."""
    name: str = "unnamed-plugin"
    feed_type: str = "ioc"   # "ioc" or "article"

    async def fetch(self) -> list[dict]:
        """Return a list of item dicts. Override this."""
        raise NotImplementedError


def discover_plugins() -> list[FeedPlugin]:
    """Import every module under feeds/plugins and instantiate FeedPlugin subclasses."""
    plugins: list[FeedPlugin] = []
    try:
        import feeds.plugins as pkg
    except ModuleNotFoundError:
        return plugins
    for mod in pkgutil.iter_modules(pkg.__path__):
        try:
            module = importlib.import_module(f"feeds.plugins.{mod.name}")
            importlib.reload(module)
            for attr in vars(module).values():
                if isinstance(attr, type) and issubclass(attr, FeedPlugin) and attr is not FeedPlugin:
                    plugins.append(attr())
        except Exception as e:
            logger.error(f"[sdk] failed to load plugin {mod.name}: {e}")
    return plugins


async def run_plugin(plugin: FeedPlugin, db: AsyncSession) -> int:
    """Run one plugin and persist its items. Returns count of new records."""
    from models import FeedArticle
    from feeds.ioc_feeds import _upsert_ioc
    from services.watchlist_checker import check_watchlist
    from services.alert_engine import evaluate_rules

    items = await plugin.fetch()
    new = 0
    for it in items:
        if plugin.feed_type == "ioc":
            value = (it.get("value") or "").strip()
            if not value:
                continue
            ioc, is_new = await _upsert_ioc(
                db,
                ioc_type=it.get("ioc_type", "unknown"),
                value=value[:1000],
                source=f"plugin:{plugin.name}",
                threat_type=it.get("threat_type"),
                malware_family=it.get("malware_family"),
                confidence=int(it.get("confidence", 50)),
                tags=it.get("tags", "") or "",
            )
            if is_new:
                await check_watchlist(ioc, db)
                await evaluate_rules(ioc, db)
                new += 1
        else:  # article
            url = (it.get("url") or "").strip()
            if not url:
                continue
            exists = (await db.execute(select(FeedArticle).where(FeedArticle.url == url))).scalar_one_or_none()
            if exists:
                continue
            db.add(FeedArticle(
                title=(it.get("title") or "Untitled")[:500],
                url=url[:1000],
                source=it.get("source") or plugin.name,
                summary=(it.get("summary") or None),
                published=datetime.now(timezone.utc),
            ))
            new += 1
    await db.commit()
    return new
