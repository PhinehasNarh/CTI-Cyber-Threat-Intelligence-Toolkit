# CTI Platform

A real-time **Cyber Threat Intelligence** aggregation and analysis platform. Collects security news, indicators of compromise (IOCs), and vulnerability data from open-source feeds, then presents them through an interactive dark-themed dashboard.

![Python](https://img.shields.io/badge/Python-3.10+-blue?logo=python&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-0.115-009688?logo=fastapi&logoColor=white)
![License](https://img.shields.io/badge/License-MIT-green)

---

## Features

| Module | Description |
|--------|-------------|
| **Dashboard** | Real-time threat overview with charts, stats, and a live severity-tagged feed |
| **News Feed** | Aggregates 8+ security RSS feeds (Krebs, CISA, Dark Reading, Bleeping Computer, etc.) |
| **IOC Explorer** | Collects IOCs from MalwareBazaar, URLhaus, ThreatFox with enrichment via VirusTotal |
| **KEV Catalog** | Syncs CISA Known Exploited Vulnerabilities with search and filtering |
| **IP Intelligence** | Consolidated IP lookups across AbuseIPDB, Shodan InternetDB, and GreyNoise |
| **Domain Reputation** | Domain analysis via VirusTotal with detection breakdown |
| **Settings & Logs** | API key management, system health monitoring, and live log viewer |

## Architecture

```
CTI Platform
├── backend/                 # Python FastAPI server
│   ├── main.py              # Entry point, scheduler, middleware
│   ├── config.py            # Pydantic settings (.env loader)
│   ├── database.py          # SQLAlchemy async engine (SQLite)
│   ├── models.py            # DB models: FeedArticle, IOC, CVE
│   ├── feeds/               # Feed pollers
│   │   ├── rss_poller.py    # 8 security RSS feeds
│   │   ├── ioc_feeds.py     # MalwareBazaar, URLhaus, ThreatFox
│   │   └── kev_sync.py      # CISA KEV catalog sync
│   ├── services/            # Business logic
│   │   ├── enrichment.py    # IOC enrichment (VT, AbuseIPDB)
│   │   └── ip_intel.py      # IP intel + domain rep lookups
│   ├── routers/             # API endpoints
│   │   ├── feed.py          # /api/feed
│   │   ├── iocs.py          # /api/iocs
│   │   ├── dashboard.py     # /api/dashboard
│   │   ├── kev.py           # /api/kev
│   │   ├── intel.py         # /api/intel
│   │   └── settings.py      # /api/settings + /api/settings/logs
│   ├── static/              # Frontend (served by FastAPI)
│   │   ├── index.html       # Single-page app shell
│   │   └── js/              # React components (no build step)
│   ├── logs/                # Auto-generated log files
│   └── .env                 # API keys (DO NOT COMMIT)
├── .env.example             # Template for environment variables
├── .gitignore               # Security-hardened ignore rules
├── start.bat                # One-click launcher (Windows)
└── README.md
```

## Quick Start

### Prerequisites

- **Python 3.10+** installed and on PATH
- Internet connection (for fetching feeds and CDN resources)

### 1. Clone the Repository

```bash
git clone https://github.com/PhinehasNarh/CTI
cd CTI
```

### 2. Install Dependencies

```bash
cd backend
pip install -r requirements.txt
```

### 3. Configure API Keys (Optional)

```bash
# Copy the example config
cp .env.example .env

# Edit .env and add your API keys
# All keys are optional — the app works without them
```

See [API Keys](#api-keys) below for free signup links.

### 4. Run the Server

```bash
# From the backend/ directory
python -m uvicorn main:app --reload --host 127.0.0.1 --port 8000
```

Or on Windows, double-click **`start.bat`** from the project root.

### 5. Open the Dashboard

Navigate to **http://localhost:8000** in your browser.

The platform will automatically poll all feeds on startup and then every 30 minutes.

---

## API Keys

All integrations use **free tiers**. The platform works without any keys, but enrichment features will be limited.

| Service | What It Powers | Free Tier | Signup Link |
|---------|---------------|-----------|-------------|
| **VirusTotal** | IOC lookups, Domain reputation | 4 req/min, 500/day | [virustotal.com](https://www.virustotal.com/gui/join-us) |
| **AbuseIPDB** | IP reputation & abuse reports | 1,000 checks/day | [abuseipdb.com](https://www.abuseipdb.com/register) |
| **Shodan** | Port/vuln scanning (InternetDB is free without key) | Limited queries | [shodan.io](https://account.shodan.io/register) |
| **GreyNoise** | Internet noise & scanner detection | 50 queries/day | [greynoise.io](https://viz.greynoise.io/signup) |
| **AlienVault OTX** | Additional threat feeds | Generous limits | [otx.alienvault.com](https://otx.alienvault.com/accounts/signup) |

After signing up, add your keys to `backend/.env`:

```env
VIRUSTOTAL_API_KEY=your_key_here
ABUSEIPDB_API_KEY=your_key_here
```

Restart the server for changes to take effect.

---

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/health` | GET | Server health check |
| `/api/dashboard` | GET | Dashboard statistics and recent data |
| `/api/feed` | GET | List feed articles (supports `?search=`, `?source=`) |
| `/api/feed/poll` | POST | Manually trigger RSS feed polling |
| `/api/iocs` | GET | List IOCs (supports `?type=`, `?search=`) |
| `/api/iocs/lookup` | POST | Enrich an IOC via VirusTotal/AbuseIPDB |
| `/api/iocs/poll` | POST | Manually trigger IOC feed polling |
| `/api/kev` | GET | List CISA KEV entries (supports `?search=`) |
| `/api/kev/sync` | POST | Sync KEV catalog from CISA |
| `/api/intel/ip` | POST | Full IP intelligence report |
| `/api/intel/domain` | POST | Domain reputation report |
| `/api/settings` | GET | Current config (API keys masked) |
| `/api/settings/logs` | GET | View application/access logs |

---

## Logging

The platform writes two rotating log files in `backend/logs/`:

| File | Contents |
|------|----------|
| `cti-platform.log` | All application events: feed polls, errors, scheduler activity |
| `access.log` | HTTP API requests: method, path, status code, response time |

Logs rotate daily and are retained for **30 days**. View them live from **Settings > Activity Logs** in the UI, or directly:

```bash
# Tail the main log
tail -f backend/logs/cti-platform.log

# Windows equivalent
type backend\logs\cti-platform.log
```

---

## Security Notes

- **Never commit `.env`** — it is excluded by `.gitignore`
- API keys are **masked** in the Settings UI (only first/last 4 chars shown)
- The log viewer only serves files from the `logs/` directory (path traversal safe)
- All external API calls use **HTTPS**
- The SQLite database file (`*.db`) is excluded from version control
- CORS is configured for localhost only by default

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Backend** | Python 3.10+, FastAPI, SQLAlchemy (async), APScheduler |
| **Database** | SQLite via aiosqlite (zero config) |
| **Frontend** | React 18 (UMD, no build step), Tailwind CSS, Recharts |
| **HTTP Client** | httpx (async) |
| **Feed Parsing** | feedparser |

The frontend uses `React.createElement` directly (no JSX, no Node.js, no build tools required). Everything runs from a single `python -m uvicorn` command.

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
