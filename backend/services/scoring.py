"""IOC threat scoring — computes a 0-100 risk score from available signals."""

import json
from datetime import datetime, timezone

_SOURCE_WEIGHTS: dict[str, int] = {
    "threatfox": 20,
    "malwarebazaar": 18,
    "urlhaus": 15,
    "manual": 12,
}

_SCORE_LABELS = [
    (75, "Critical"),
    (50, "High"),
    (25, "Medium"),
    (0,  "Low"),
]


def compute_ioc_score(
    *,
    confidence: int,
    source: str,
    first_seen: datetime,
    seen_count: int,
    raw_data: str | None,
) -> tuple[float, dict]:
    """Return (score 0-100, breakdown dict).

    Factors:
      recency    0-30  — how recently was this IOC first seen
      confidence 0-25  — existing confidence field scaled
      source     0-20  — per-source credibility weight
      seen_count 0-10  — corroboration bonus
      enrichment 0-15  — signals from VT / AbuseIPDB / Shodan
    """
    # Recency (0-30)
    now = datetime.now(timezone.utc)
    if first_seen.tzinfo is None:
        first_seen = first_seen.replace(tzinfo=timezone.utc)
    age_h = (now - first_seen).total_seconds() / 3600

    if age_h < 1:
        recency = 30
    elif age_h < 24:
        recency = 25
    elif age_h < 168:   # 7 days
        recency = 18
    elif age_h < 720:   # 30 days
        recency = 10
    else:
        recency = 3

    # Confidence (0-25)
    conf_score = round(confidence * 0.25)

    # Source weight (0-20)
    src_score = _SOURCE_WEIGHTS.get(source, 8)

    # Seen count bonus (0-10)
    if seen_count >= 6:
        seen_score = 10
    elif seen_count >= 4:
        seen_score = 7
    elif seen_count == 3:
        seen_score = 5
    elif seen_count == 2:
        seen_score = 3
    else:
        seen_score = 0

    # Enrichment bonus (0-15)
    enrich_score = 0
    if raw_data:
        try:
            enrichments = json.loads(raw_data)
            if isinstance(enrichments, list):
                for e in enrichments:
                    src = e.get("source", "")
                    if src == "virustotal":
                        malicious = e.get("malicious") or 0
                        enrich_score += min(10, (malicious // 5) * 5)
                    elif src == "abuseipdb":
                        abuse = e.get("abuse_confidence_score") or 0
                        enrich_score += 8 if abuse > 50 else (4 if abuse > 25 else 0)
                    elif src == "shodan_internetdb":
                        if e.get("vulns"):
                            enrich_score += 5
        except Exception:
            pass
    enrich_score = min(15, enrich_score)

    total = float(min(100, recency + conf_score + src_score + seen_score + enrich_score))
    breakdown = {
        "recency": recency,
        "confidence": conf_score,
        "source": src_score,
        "seen_count": seen_score,
        "enrichment": enrich_score,
    }
    return total, breakdown


def score_label(score: float) -> str:
    for threshold, label in _SCORE_LABELS:
        if score >= threshold:
            return label
    return "Low"
