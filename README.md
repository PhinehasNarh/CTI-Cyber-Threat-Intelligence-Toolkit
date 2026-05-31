# CTI Platform

A self-contained Cyber Threat Intelligence platform. It polls security news and indicator feeds on a schedule, stores everything in a local SQLite database, enriches indicators on demand, and serves it all through a React dashboard. It runs on your own machine or in Docker and needs no cloud infrastructure beyond a few optional free-tier API keys.

![Python](https://img.shields.io/badge/Python-3.11+-blue?logo=python&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-0.115-009688?logo=fastapi&logoColor=white)
![React](https://img.shields.io/badge/React-18-61dafb?logo=react&logoColor=white)
![License](https://img.shields.io/badge/License-MIT-green)

## Preview
<img width="1920" height="977" alt="Screenshot 2026-03-11 175946" src="https://github.com/user-attachments/assets/2e63120f-624a-47f3-bc06-e8dc868cd021" />

---

## What it does

The backend polls 8 security RSS feeds (Krebs, The Hacker News, Bleeping Computer, CISA, Dark Reading, Schneier, SANS ISC, Threatpost) and three abuse.ch IOC feeds (MalwareBazaar, URLhaus, ThreatFox) every 30 minutes. An immediate poll runs on startup so the dashboard has data on first load. Indicators can be enriched on demand against VirusTotal, AbuseIPDB, and Shodan InternetDB.

On top of that core, v0.3.0 adds a wide feature set, each with its own backend router and frontend page:

| Area | Features |
|------|----------|
| **Intelligence** | Threat actor profiles and a printable wanted-poster generator, campaign tracker, IOC correlation graph, offline article summaries, behavioural clustering (TF-IDF), and a rule-based threat-intel assistant |
| **Workflow** | Rule-based alert engine, team notes and tagging, triage queue, audit log, analyst leaderboard, a localStorage workbench and custom dashboard builder, and a copy-to-Markdown intel digest |
| **Visualisation** | Article reading mode with IOC highlighting, world threat map (free ip-api.com), and time-lapse replay |
| **Integrations** | CT log watcher (crt.sh), Shodan asset watch (free InternetDB), honeypot sink, and config-gated MISP/OpenCTI and dark-web hooks |
| **Platform** | Public REST API with scoped API keys and rate limiting, custom per-feed scheduler, a plugin/feed SDK, a Manifest V3 browser extension, multi-tenant workspaces, data retention policies, and PWA install support |

LLM-style features (summaries, the assistant) are built offline with heuristics, not a hosted model, so they work without any paid keys. Key-gated integrations degrade to a clear "not configured" state.

## Architecture

```
CTI/
├── backend/                 # FastAPI + async SQLAlchemy (SQLite)
│   ├── main.py              # App, lifespan, CORS, APScheduler, /api/health
│   ├── config.py            # pydantic-settings (.env loader)
│   ├── database.py          # Async engine + session factory
│   ├── models.py            # ORM models: FeedArticle, IOC, CVE
│   ├── feeds/               # rss_poller, ioc_feeds, plugin SDK + plugins/
│   ├── services/            # enrichment, clustering, summarizer, scoring, ...
│   └── routers/             # 30 API routers (feed, iocs, dashboard, actors, ...)
├── frontend/                # React 18 + Vite (29 pages)
│   └── src/                 # App.jsx, api/client.js, pages/, components/
├── cli/                     # cti.py command-line client
├── extension/               # Manifest V3 browser extension
├── docs/                    # DOCS.md, DEPLOYMENT.md, idea.md, architecture.svg, roadmap
├── docker-compose.yml       # backend + frontend services
├── start.bat / stop.bat     # Windows launchers
└── render.yaml
```

Full developer reference and the annotated diagram live in [docs/DOCS.md](docs/DOCS.md) and [docs/architecture.svg](docs/architecture.svg).

## Quick Start

### Prerequisites

- **Python 3.11+** on PATH
- **Node 18+** (frontend build only)
- Internet access for feeds and enrichment

### Backend

```bash
cd backend
python -m venv venv
venv\Scripts\activate        # Windows
# source venv/bin/activate   # Linux/Mac
pip install -r requirements.txt
python -m uvicorn main:app --reload --port 8000
```

The SQLite file `cti.db` is created on first run and the initial feed poll runs immediately.

### Frontend

```bash
cd frontend
npm install
npm run dev
```

The dashboard opens at **http://localhost:5173** and talks to the backend on port 8000.

### Both at once

On Windows, run **`start.bat`** from the project root to launch both servers and open the browser. With Docker, `docker compose up -d --build` brings up both services.

---

## API Keys

All integrations use free tiers, and the platform runs without any of them. Add keys to `backend/.env` to enable richer enrichment.

| Service | Powers | Free tier | Signup |
|---------|--------|-----------|--------|
| **VirusTotal** | Hash, domain, and IP lookups | 4 req/min, 500/day | [virustotal.com](https://www.virustotal.com/gui/join-us) |
| **AbuseIPDB** | IP reputation and abuse reports | 1,000 checks/day | [abuseipdb.com](https://www.abuseipdb.com/register) |
| **Shodan InternetDB** | Open ports and vulns for IPs | Keyless | [shodan.io](https://account.shodan.io/register) |
| **GreyNoise** | Scanner/noise classification (placeholder, not yet wired) | 50 queries/day | [greynoise.io](https://viz.greynoise.io/signup) |
| **AlienVault OTX** | Additional feeds (placeholder, not yet wired) | Generous | [otx.alienvault.com](https://otx.alienvault.com/accounts/signup) |

```env
VIRUSTOTAL_API_KEY=your_key_here
ABUSEIPDB_API_KEY=your_key_here
```

Restart the server after editing `.env`. `GREYNOISE_API_KEY` and `OTX_API_KEY` are defined in `config.py` but not yet attached to any lookup.

---

## Core API

All routes are prefixed with `/api` and return JSON. The dashboard and the public `/api/v1` surface are documented in full in [docs/DOCS.md](docs/DOCS.md).

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/health` | GET | Status, version, and scheduler state |
| `/api/dashboard` | GET | Stats, recent articles, IOC breakdown, 7-day trend |
| `/api/feed` | GET | List articles (`source`, `search`, `starred`, `unread`, `limit`, `offset`) |
| `/api/feed/sources` | GET | Sources with article counts |
| `/api/feed/{id}` | PATCH | Mark an article read or starred |
| `/api/feed/poll` | POST | Trigger an RSS poll |
| `/api/iocs` | GET | List IOCs (`ioc_type`, `source`, `search`, `limit`, `offset`) |
| `/api/iocs/stats` | GET | Totals by type and source |
| `/api/iocs/lookup` | POST | Live enrichment for a value |
| `/api/iocs/poll` | POST | Trigger an IOC feed poll |

Beyond these, routers exist for actors, campaigns, alerts, triage, audit, leaderboard, clusters, chat, CT logs, geo, honeypot, workspaces, assets, integrations, retention, time-lapse, export, the public API (`/api/v1`), API keys, and the feed scheduler.

---

## Security Notes

- `.env` and the SQLite `*.db` files are excluded from version control by `.gitignore`.
- The public API uses scoped API keys with a per-key rate limit.
- External lookups go over HTTPS.
- CORS is restricted to localhost by default. Set `CORS_ORIGINS` in `.env` before exposing the API.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Backend** | Python 3.11+, FastAPI 0.115, SQLAlchemy 2.0 (async), APScheduler |
| **Database** | SQLite via aiosqlite (zero config) |
| **Frontend** | React 18, Vite 5, React Router 6, Recharts, Tailwind CSS, Lucide |
| **HTTP client** | httpx (async) |
| **Feed parsing** | feedparser |

The frontend is a standard Vite app, so it needs `npm install` and either `npm run dev` or `npm run build`.

---

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/my-feature`
3. Commit your changes: `git commit -m "Add my feature"`
4. Push to the branch: `git push origin feature/my-feature`
5. Open a Pull Request

---

## License

This project is licensed under the MIT License. See [LICENSE](LICENSE) for details.


### #ph1n3y
