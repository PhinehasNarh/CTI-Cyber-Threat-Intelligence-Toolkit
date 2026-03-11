"""RSS feed poller — fetches security news from configured sources."""

import logging
from datetime import datetime, timezone
from time import mktime

import feedparser
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from models import FeedArticle

logger = logging.getLogger(__name__)

# Curated list of security RSS feeds
RSS_FEEDS: dict[str, str] = {
    "Krebs on Security": "https://krebsonsecurity.com/feed/",
    "The Hacker News": "https://feeds.feedburner.com/TheHackersNews",
    "Bleeping Computer": "https://www.bleepingcomputer.com/feed/",
    "CISA Alerts": "https://www.cisa.gov/cybersecurity-advisories/all.xml",
    "Dark Reading": "https://www.darkreading.com/rss.xml",
    "Schneier on Security": "https://www.schneier.com/feed/",
    "SANS ISC": "https://isc.sans.edu/rssfeed.xml",
    "Threatpost": "https://threatpost.com/feed/",
}


def _parse_date(entry) -> datetime | None:
    """Extract published date from a feed entry."""
    for attr in ("published_parsed", "updated_parsed"):
        parsed = getattr(entry, attr, None)
        if parsed:
            try:
                return datetime.fromtimestamp(mktime(parsed), tz=timezone.utc)
            except (ValueError, OverflowError):
                continue
    return None


def _extract_categories(entry) -> str | None:
    """Pull category/tag labels from a feed entry."""
    tags = getattr(entry, "tags", None)
    if tags:
        labels = [t.get("term", "") for t in tags if t.get("term")]
        if labels:
            return ", ".join(labels[:10])  # cap at 10 tags
    return None


def _extract_summary(entry) -> str | None:
    """Get a plain-text summary, stripping HTML."""
    summary = getattr(entry, "summary", None)
    if not summary:
        content = getattr(entry, "content", None)
        if content and len(content) > 0:
            summary = content[0].get("value", "")
    if summary:
        # Basic HTML stripping (good enough for summaries)
        import re
        clean = re.sub(r"<[^>]+>", "", summary)
        return clean[:1000]  # cap length
    return None


async def poll_single_feed(source_name: str, feed_url: str, db: AsyncSession) -> int:
    """Poll one RSS feed and store new articles. Returns count of new articles."""
    new_count = 0
    try:
        feed = feedparser.parse(feed_url)
        if feed.bozo and not feed.entries:
            logger.warning(f"Feed error for {source_name}: {feed.bozo_exception}")
            return 0

        for entry in feed.entries:
            url = getattr(entry, "link", None)
            if not url:
                continue

            # Skip if we already have this article
            existing = await db.execute(
                select(FeedArticle).where(FeedArticle.url == url)
            )
            if existing.scalar_one_or_none():
                continue

            article = FeedArticle(
                title=getattr(entry, "title", "Untitled")[:500],
                url=url[:1000],
                source=source_name,
                summary=_extract_summary(entry),
                published=_parse_date(entry),
                categories=_extract_categories(entry),
            )
            db.add(article)
            new_count += 1

        await db.commit()
        logger.info(f"[{source_name}] Fetched {new_count} new articles")

    except Exception as e:
        logger.error(f"[{source_name}] Poll failed: {e}")
        await db.rollback()

    return new_count


async def poll_all_feeds(db: AsyncSession) -> dict[str, int]:
    """Poll all configured RSS feeds. Returns {source: new_article_count}."""
    results = {}
    for name, url in RSS_FEEDS.items():
        count = await poll_single_feed(name, url, db)
        results[name] = count
    return results
