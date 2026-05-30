"""Rule-based natural-language query engine (#36).

No LLM: parses a question into a structured intent (target entity, filters, time
window, count-vs-list) using keyword + regex matching. Runs fully offline.
"""

import re
from datetime import datetime, timedelta, timezone

IOC_TYPE_WORDS = {
    "ip": "ip", "ips": "ip", "address": "ip", "addresses": "ip",
    "domain": "domain", "domains": "domain",
    "hash": "hash", "hashes": "hash", "file": "hash", "sample": "hash",
    "url": "url", "urls": "url", "link": "url",
}

_KNOWN_TERMS = [
    "ransomware", "phishing", "malware", "trojan", "botnet", "stealer",
    "loader", "rat", "backdoor", "exploit", "spyware", "miner", "worm",
    "lockbit", "cobalt strike", "emotet", "qakbot", "agent tesla", "redline",
]

_UNIT_SECONDS = {"hour": 3600, "day": 86400, "week": 604800, "month": 2592000}


def parse_query(text: str) -> dict:
    q = (text or "").lower().strip()

    # Target entity
    if any(w in q for w in ["article", "news", "report", "story", "blog"]):
        target = "article"
    elif any(w in q for w in ["ioc", "indicator", "ip", "domain", "hash", "url"]):
        target = "ioc"
    else:
        target = "ioc"

    # Count vs list
    intent = "count" if re.search(r"\bhow many\b|\bcount\b|\bnumber of\b", q) else "list"

    # IOC type
    ioc_type = None
    for word, t in IOC_TYPE_WORDS.items():
        if re.search(rf"\b{re.escape(word)}\b", q):
            ioc_type = t
            break

    # Time window
    since = None
    window_label = None
    m = re.search(r"last\s+(\d+)\s*(hour|day|week|month)s?", q)
    if m:
        n, unit = int(m.group(1)), m.group(2)
        since = datetime.now(timezone.utc) - timedelta(seconds=n * _UNIT_SECONDS[unit])
        window_label = f"last {n} {unit}{'s' if n != 1 else ''}"
    elif re.search(r"\b(\d+)\s*(h|hr|hrs|hours?)\b", q):
        m2 = re.search(r"\b(\d+)\s*(h|hr|hrs|hours?)\b", q)
        n = int(m2.group(1))
        since = datetime.now(timezone.utc) - timedelta(hours=n)
        window_label = f"last {n}h"
    elif "today" in q:
        since = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
        window_label = "today"
    elif "this week" in q or "past week" in q:
        since = datetime.now(timezone.utc) - timedelta(days=7)
        window_label = "this week"
    elif "this month" in q or "past month" in q:
        since = datetime.now(timezone.utc) - timedelta(days=30)
        window_label = "this month"

    # Severity (IOC score buckets)
    min_score = None
    if "critical" in q:
        min_score = 75
    elif "high" in q:
        min_score = 50

    # Keyword: known terms first, then "about/mentioning/related to/for X"
    keywords = [t for t in _KNOWN_TERMS if t in q]
    m3 = re.search(r"(?:about|mentioning|related to|involving|for|on)\s+([a-z0-9 .\-]{3,40})", q)
    free_kw = None
    if m3:
        free_kw = m3.group(1).strip().rstrip("?.").strip()
        # drop trailing stop phrases
        free_kw = re.split(r"\b(in|from|over|during|last|this|today)\b", free_kw)[0].strip()
        if free_kw and free_kw not in keywords and len(free_kw) >= 3:
            keywords.append(free_kw)

    return {
        "target": target,
        "intent": intent,
        "ioc_type": ioc_type,
        "since": since,
        "window_label": window_label,
        "min_score": min_score,
        "keywords": keywords,
    }


def describe(parsed: dict) -> str:
    bits = [f"{parsed['intent']} {parsed.get('ioc_type') or ''} {parsed['target']}s".replace("  ", " ").strip()]
    if parsed["keywords"]:
        bits.append(f"about {', '.join(parsed['keywords'])}")
    if parsed["min_score"]:
        bits.append(f"score >= {parsed['min_score']}")
    if parsed["window_label"]:
        bits.append(f"in {parsed['window_label']}")
    return " ".join(bits)
