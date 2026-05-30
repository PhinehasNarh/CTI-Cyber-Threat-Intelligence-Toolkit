#!/usr/bin/env python3
"""CTI Platform CLI — quick terminal access without opening a browser.

Usage:
  python cti.py stats
  python cti.py iocs [--type ip|domain|hash|url] [--limit N] [--sort score|first_seen]
  python cti.py lookup <value>
  python cti.py search <query>
  python cti.py export --format json|csv|suricata|iptables|stix [--min-score N] [--type TYPE]
  python cti.py watchlist
  python cti.py watchlist add <pattern> [--label "description"]
  python cti.py watchlist hits
  python cti.py actors
  python cti.py campaigns
  python cti.py alerts

Set CTI_BASE_URL env var to override the API base (default: http://localhost:8000/api).
"""

import argparse
import json
import os
import sys
import urllib.error
import urllib.parse
import urllib.request

BASE = os.environ.get("CTI_BASE_URL", "http://localhost:8000/api").rstrip("/")

# ── ANSI colours ──────────────────────────────────────────────────────────────
_USE_COLOR = sys.stdout.isatty()

def _c(text, code): return f"\033[{code}m{text}\033[0m" if _USE_COLOR else text

def red(t):    return _c(t, "31")
def green(t):  return _c(t, "32")
def yellow(t): return _c(t, "33")
def cyan(t):   return _c(t, "36")
def bold(t):   return _c(t, "1")
def dim(t):    return _c(t, "2")

SEVERITY_COLOR = {"Critical": red, "High": yellow, "Medium": cyan, "Low": dim}

def severity_str(label, score):
    fn = SEVERITY_COLOR.get(label, str)
    return fn(f"{label}({score})")


# ── HTTP helpers ──────────────────────────────────────────────────────────────
def _get(path, params=None):
    url = f"{BASE}{path}"
    if params:
        url += "?" + urllib.parse.urlencode({k: v for k, v in params.items() if v is not None})
    try:
        with urllib.request.urlopen(url, timeout=15) as r:
            return json.loads(r.read())
    except urllib.error.HTTPError as e:
        print(red(f"API error {e.code}: {e.read().decode()}"), file=sys.stderr)
        sys.exit(1)
    except Exception as e:
        print(red(f"Connection failed: {e}"), file=sys.stderr)
        print(dim(f"Is the backend running at {BASE}?"), file=sys.stderr)
        sys.exit(1)


def _post(path, body=None, params=None):
    url = f"{BASE}{path}"
    if params:
        url += "?" + urllib.parse.urlencode({k: v for k, v in params.items() if v is not None})
    data = json.dumps(body or {}).encode()
    req = urllib.request.Request(
        url, data=data,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=15) as r:
            return json.loads(r.read())
    except urllib.error.HTTPError as e:
        print(red(f"API error {e.code}: {e.read().decode()}"), file=sys.stderr)
        sys.exit(1)
    except Exception as e:
        print(red(f"Connection failed: {e}"), file=sys.stderr)
        sys.exit(1)


def _download(path, params, out_file):
    url = f"{BASE}{path}"
    if params:
        url += "?" + urllib.parse.urlencode({k: v for k, v in params.items() if v is not None})
    try:
        with urllib.request.urlopen(url, timeout=30) as r:
            content = r.read()
        with open(out_file, "wb") as f:
            f.write(content)
        print(green(f"Saved to {out_file} ({len(content):,} bytes)"))
    except Exception as e:
        print(red(f"Export failed: {e}"), file=sys.stderr)
        sys.exit(1)


# ── Commands ──────────────────────────────────────────────────────────────────
def cmd_stats(_):
    d = _get("/dashboard")
    s = d["stats"]
    print(bold("── CTI Platform Stats ─────────────────────"))
    print(f"  Articles    {green(str(s['total_articles']))}  (today: {s['articles_today']}, unread: {s['unread_articles']})")
    print(f"  IOCs        {green(str(s['total_iocs']))}  (today: {s['iocs_today']})")
    ioc_s = _get("/iocs/stats")
    bsev = ioc_s.get("by_severity", {})
    print(f"  Critical    {red(str(bsev.get('critical', 0)))}   High: {yellow(str(bsev.get('high', 0)))}")
    print(f"  By type     " + "  ".join(f"{k}: {v}" for k, v in ioc_s.get("by_type", {}).items()))


def cmd_iocs(args):
    params = {"limit": args.limit, "sort": args.sort}
    if args.type:
        params["ioc_type"] = args.type
    data = _get("/iocs", params)
    print(bold(f"── IOCs ({data['count']}) ────────────────────────────────"))
    fmt = "{:<8}  {:<12}  {:<16}  {:<30}  {}"
    print(dim(fmt.format("SCORE", "TYPE", "SOURCE", "MALWARE", "VALUE")))
    for i in data["iocs"]:
        label = i.get("score_label", "Low")
        score = i.get("threat_score", 0)
        fn = SEVERITY_COLOR.get(label, str)
        print(fmt.format(
            fn(f"{label[:4]}:{score}"),
            i["ioc_type"],
            i["source"],
            (i.get("malware_family") or "—")[:30],
            i["value"][:80],
        ))


def cmd_lookup(args):
    data = _get("/iocs/lookup", {"value": args.value})  # POST but GET works too via query param? No — use POST via params
    # Actually lookup is POST /api/iocs/lookup?value=...
    url = f"{BASE}/iocs/lookup?value={urllib.parse.quote(args.value)}"
    req = urllib.request.Request(url, data=b"", method="POST")
    try:
        with urllib.request.urlopen(req, timeout=15) as r:
            data = json.loads(r.read())
    except Exception as e:
        print(red(f"Lookup failed: {e}"), file=sys.stderr)
        sys.exit(1)

    label = data.get("score_label", "Unknown")
    fn = SEVERITY_COLOR.get(label, str)
    print(bold(f"── Lookup: {data['value']} ──"))
    print(f"  Type:   {cyan(data['detected_type'])}")
    print(f"  Score:  {fn(label)} ({data.get('threat_score', 0)})")
    enrichments = data.get("enrichments", [])
    if enrichments:
        for e in enrichments:
            src = e.pop("source", "?")
            print(f"\n  {bold(src.upper())}")
            for k, v in e.items():
                if v is None: continue
                print(f"    {dim(k+':')} {v}")
    else:
        print(dim("  No enrichment data (add API keys to .env)"))


def cmd_search(args):
    data = _get("/iocs/search", {"q": args.query, "limit": 50})
    print(bold(f"── FTS Results for '{args.query}' ({data['count']}) ──"))
    for i in data["iocs"]:
        label = i.get("score_label", "Low")
        fn = SEVERITY_COLOR.get(label, str)
        print(f"  {fn(label):<10}  {i['ioc_type']:<8}  {i['value'][:70]}")


def cmd_export(args):
    ext_map = {"json": "json", "csv": "csv", "suricata": "rules",
               "iptables": "sh", "stix": "stix.json"}
    ext = ext_map.get(args.format, "txt")
    out = args.output or f"cti_export.{ext}"
    params = {"format": args.format}
    if args.min_score:
        params["min_score"] = args.min_score
    if args.type:
        params["ioc_type"] = args.type
    print(f"Exporting {args.format}…")
    _download("/export/iocs", params, out)


def cmd_watchlist(args):
    sub = getattr(args, "watchlist_cmd", None)
    if sub == "add":
        data = _post("/watchlist", {"pattern": args.pattern, "label": args.label or args.pattern})
        print(green(f"Added: {data['pattern']} (id={data['id']})"))
    elif sub == "hits":
        data = _get("/watchlist/hits", {"limit": 20})
        print(bold(f"── Watchlist Hits ({data['count']}) ──"))
        for h in data["hits"]:
            print(f"  {cyan(h['ioc_type']):<8}  {yellow(h['ioc_value'][:60])}  → {h.get('label','?')}  {dim(h['hit_at'][:10])}")
    else:
        data = _get("/watchlist")
        print(bold(f"── Watchlist ({data['count']}) ──"))
        for e in data["entries"]:
            hits = f"  {yellow(str(e['hit_count']) + ' hits')}" if e["hit_count"] else ""
            print(f"  {e['id']:<4}  {e['pattern']:<40}  {dim(e['label'])}{hits}")


def cmd_actors(_):
    data = _get("/actors")
    print(bold(f"── Threat Actors ({data['count']}) ──"))
    for a in data["actors"]:
        country = f" [{a['origin_country']}]" if a.get("origin_country") else ""
        conf = f"  conf:{a['confidence']}"
        print(f"  {bold(a['name'])}{country}{conf}  {dim(a.get('motivation') or '')}")
        if a.get("aliases"):
            print(f"    aliases: {', '.join(a['aliases'])}")


def cmd_campaigns(_):
    data = _get("/campaigns")
    print(bold(f"── Campaigns ({data['count']}) ──"))
    STATUS_FN = {"active": green, "closed": dim, "suspected": yellow}
    for c in data["campaigns"]:
        fn = STATUS_FN.get(c["status"], str)
        print(f"  {fn(c['status'][:8]):<12}  {bold(c['name'][:40])}  "
              f"IOCs:{c['ioc_count']}  conf:{c['confidence']}  "
              f"{dim(c.get('threat_actor') or '')}")


def cmd_alerts(_):
    data = _get("/alerts/rules")
    print(bold(f"── Alert Rules ({data['count']}) ──"))
    for r in data["rules"]:
        status = green("ON ") if r["is_active"] else dim("OFF")
        fn = SEVERITY_COLOR.get(r["severity"].capitalize(), str)
        print(f"  {status}  {fn(r['severity'][:8]):<10}  {r['name']:<30}  hits:{r['hit_count']}")
    hits = _get("/alerts/hits", {"limit": 5})
    if hits["count"]:
        print(bold(f"\n── Recent Hits (last {hits['count']}) ──"))
        for h in hits["hits"]:
            fn = SEVERITY_COLOR.get(h["severity"].capitalize(), str)
            print(f"  {fn(h['severity'][:8]):<10}  {h['ioc_type']:<8}  {h['ioc_value'][:60]}"
                  f"  → {dim(h.get('rule_name','?'))}  {dim(h['hit_at'][:16])}")


# ── Argument parser ───────────────────────────────────────────────────────────
def build_parser():
    p = argparse.ArgumentParser(
        prog="cti",
        description="CTI Platform CLI",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    sub = p.add_subparsers(dest="command", required=True)

    sub.add_parser("stats", help="Platform summary stats")

    ioc_p = sub.add_parser("iocs", help="List IOCs")
    ioc_p.add_argument("--type", choices=["hash", "ip", "domain", "url"])
    ioc_p.add_argument("--limit", type=int, default=20)
    ioc_p.add_argument("--sort", choices=["score", "first_seen"], default="score")

    lk = sub.add_parser("lookup", help="Enrich a single IOC")
    lk.add_argument("value")

    sr = sub.add_parser("search", help="Full-text search IOCs")
    sr.add_argument("query")

    ex = sub.add_parser("export", help="Download IOC blocklist")
    ex.add_argument("--format", choices=["json", "csv", "suricata", "iptables", "stix"], default="json")
    ex.add_argument("--min-score", type=float, default=0)
    ex.add_argument("--type", choices=["hash", "ip", "domain", "url"])
    ex.add_argument("--output", "-o", help="Output file path")

    wl = sub.add_parser("watchlist", help="Manage IOC watchlist")
    wl_sub = wl.add_subparsers(dest="watchlist_cmd")
    wl_add = wl_sub.add_parser("add")
    wl_add.add_argument("pattern")
    wl_add.add_argument("--label", default="")
    wl_sub.add_parser("hits")

    sub.add_parser("actors", help="List threat actors")
    sub.add_parser("campaigns", help="List campaigns")
    sub.add_parser("alerts", help="List alert rules and recent hits")

    return p


HANDLERS = {
    "stats": cmd_stats,
    "iocs": cmd_iocs,
    "lookup": cmd_lookup,
    "search": cmd_search,
    "export": cmd_export,
    "watchlist": cmd_watchlist,
    "actors": cmd_actors,
    "campaigns": cmd_campaigns,
    "alerts": cmd_alerts,
}

if __name__ == "__main__":
    parser = build_parser()
    args = parser.parse_args()
    HANDLERS[args.command](args)
