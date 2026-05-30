"""Heuristic article "Quick Brief" extraction (#2).

No LLM / no external calls: produces an extractive summary and pulls out threat
actors, targeted industries, malware families and ATT&CK techniques via keyword
matching. Designed to degrade gracefully and run fully offline.
"""

import re

from services.attack_mapper import map_to_attack, ATTACK_MAP

# Well-known threat actors and common aliases (lowercase match -> canonical name).
KNOWN_ACTORS = {
    "apt28": "APT28", "fancy bear": "APT28", "sofacy": "APT28",
    "apt29": "APT29", "cozy bear": "APT29", "midnight blizzard": "APT29",
    "apt41": "APT41", "winnti": "APT41",
    "lazarus": "Lazarus Group", "hidden cobra": "Lazarus Group",
    "kimsuky": "Kimsuky", "sandworm": "Sandworm", "turla": "Turla",
    "fin7": "FIN7", "carbanak": "FIN7", "ta505": "TA505",
    "scattered spider": "Scattered Spider", "muddywater": "MuddyWater",
    "volt typhoon": "Volt Typhoon", "salt typhoon": "Salt Typhoon",
    "lockbit": "LockBit", "blackcat": "ALPHV/BlackCat", "alphv": "ALPHV/BlackCat",
    "cl0p": "Cl0p", "clop": "Cl0p", "conti": "Conti", "akira": "Akira",
    "black basta": "Black Basta", "play ransomware": "Play", "revil": "REvil",
    "royal ransomware": "Royal", "rhysida": "Rhysida", "medusa": "Medusa",
}

# Targeted industry keywords.
INDUSTRIES = {
    "healthcare": ["healthcare", "hospital", "medical", "health system", "pharma", "clinic"],
    "finance": ["bank", "financial", "fintech", "payment", "credit union", "insurance"],
    "government": ["government", "federal agency", "municipal", "public sector", "ministry", "state agency"],
    "energy": ["energy", "power grid", "utility", "oil and gas", "pipeline", "electric"],
    "education": ["university", "school", "education", "academic", "college"],
    "manufacturing": ["manufacturing", "factory", "industrial", "ics", "operational technology", "scada"],
    "technology": ["software", "saas", "cloud provider", "tech company", "msp", "it services"],
    "retail": ["retail", "e-commerce", "ecommerce", "point of sale", "pos malware"],
    "telecom": ["telecom", "telecommunications", "isp", "carrier", "5g"],
    "defense": ["defense", "military", "defence", "aerospace", "weapons"],
    "critical infrastructure": ["critical infrastructure", "water treatment", "transportation", "nuclear"],
}

_SENT_SPLIT = re.compile(r"(?<=[.!?])\s+")


def _extract_summary(text: str, max_sentences: int = 3, max_chars: int = 360) -> str:
    text = re.sub(r"\s+", " ", (text or "")).strip()
    if not text:
        return ""
    sentences = _SENT_SPLIT.split(text)
    out = " ".join(sentences[:max_sentences]).strip()
    if len(out) > max_chars:
        out = out[:max_chars].rsplit(" ", 1)[0] + "…"
    return out


def _find(haystack: str, mapping: dict) -> list[str]:
    found: list[str] = []
    for needle, canonical in mapping.items():
        if needle in haystack and canonical not in found:
            found.append(canonical)
    return found


def build_brief(title: str, summary: str, extra_actor_terms: list[str] | None = None) -> dict:
    """Return a Quick Brief for an article. extra_actor_terms lets callers fold
    in curated ThreatActor names/aliases from the DB."""
    blob = f"{title or ''}. {summary or ''}".lower()

    actors = _find(blob, KNOWN_ACTORS)
    for term in (extra_actor_terms or []):
        if term and term.lower() in blob and term not in actors:
            actors.append(term)

    industries = [name for name, kws in INDUSTRIES.items() if any(k in blob for k in kws)]

    technique_ids = map_to_attack(f"{title or ''} {summary or ''}")
    techniques = [
        {"id": tid, "name": ATTACK_MAP[tid]["name"], "tactic": ATTACK_MAP[tid]["tactic"]}
        for tid in technique_ids if tid in ATTACK_MAP
    ]

    return {
        "summary": _extract_summary(summary or title),
        "threat_actors": actors,
        "industries": industries,
        "attack_techniques": techniques,
        "mode": "heuristic",
    }
