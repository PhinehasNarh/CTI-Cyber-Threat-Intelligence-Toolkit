"""Offline behavioural clustering of articles (#7).

Pure-Python TF-IDF vectors + greedy cosine clustering, no ML dependency and no
external calls. Groups similar articles into themes and labels each cluster by
its most distinctive terms.
"""

import math
import re
from collections import Counter

_TOKEN = re.compile(r"[a-z][a-z0-9'-]{2,}")

_STOPWORDS = {
    "the", "and", "for", "are", "was", "with", "that", "this", "from", "has", "have",
    "but", "not", "you", "your", "all", "can", "new", "out", "use", "via", "its",
    "their", "they", "been", "more", "said", "will", "who", "what", "when", "how",
    "which", "into", "over", "also", "than", "them", "were", "after", "about",
    "could", "would", "should", "other", "some", "such", "only", "most", "may",
    "one", "two", "now", "his", "her", "say", "says", "according", "report", "reports",
    "researchers", "security", "attack", "attacks", "attackers", "threat", "cyber",
    "data", "users", "company", "companies", "according", "including", "used", "using",
}


def _tokens(text: str) -> list[str]:
    return [t for t in _TOKEN.findall((text or "").lower()) if t not in _STOPWORDS]


def _cosine(a: dict, b: dict) -> float:
    if len(a) > len(b):
        a, b = b, a
    dot = sum(w * b.get(t, 0.0) for t, w in a.items())
    if dot == 0:
        return 0.0
    na = math.sqrt(sum(w * w for w in a.values()))
    nb = math.sqrt(sum(w * w for w in b.values()))
    return dot / (na * nb) if na and nb else 0.0


def cluster_articles(docs: list[dict], threshold: float = 0.16, max_clusters: int = 40) -> list[dict]:
    """docs: [{id, title, source, text}]. Returns clusters sorted by size."""
    if not docs:
        return []

    # Document frequency
    tokenized = []
    df = Counter()
    for d in docs:
        toks = _tokens(d["text"])
        tf = Counter(toks)
        tokenized.append(tf)
        for term in tf:
            df[term] += 1

    n = len(docs)
    # TF-IDF sparse vectors
    vectors = []
    for tf in tokenized:
        total = sum(tf.values()) or 1
        vec = {
            term: (count / total) * math.log((1 + n) / (1 + df[term]) + 1)
            for term, count in tf.items()
        }
        vectors.append(vec)

    clusters: list[dict] = []
    for i, d in enumerate(docs):
        vec = vectors[i]
        best, best_sim = None, threshold
        for c in clusters:
            sim = _cosine(vec, c["centroid"])
            if sim >= best_sim:
                best, best_sim = c, sim
        if best is None:
            if len(clusters) >= max_clusters:
                # dump into the nearest cluster regardless to avoid unbounded growth
                best = max(clusters, key=lambda c: _cosine(vec, c["centroid"]))
            else:
                clusters.append({"members": [i], "centroid": dict(vec), "term_sum": Counter(vec)})
                continue
        best["members"].append(i)
        # incremental centroid (running mean) + term accumulation for labels
        m = len(best["members"])
        for term, w in vec.items():
            best["centroid"][term] = best["centroid"].get(term, 0.0) + (w - best["centroid"].get(term, 0.0)) / m
            best["term_sum"][term] += w

    out = []
    for c in clusters:
        top_terms = [t for t, _ in c["term_sum"].most_common(4)]
        members = [docs[i] for i in c["members"]]
        out.append({
            "label": " / ".join(top_terms[:3]) if top_terms else "misc",
            "top_terms": top_terms,
            "size": len(members),
            "articles": [{"id": m["id"], "title": m["title"], "source": m["source"]} for m in members[:25]],
        })
    out.sort(key=lambda c: -c["size"])
    return out
