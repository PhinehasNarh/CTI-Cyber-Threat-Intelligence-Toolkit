import { useState } from "react";

const PHASES = [
  {
    id: "stack",
    title: "01 :  Web Stack",
    icon: "⚙️",
    color: "#00ff87",
    summary: "Recommended technology choices for frontend, backend, and database.",
    details: [
      {
        heading: "Frontend :  React + Vite",
        body: `React is the most popular UI library with massive community support. Vite gives you lightning-fast dev builds. For charts and dashboards, use Recharts or Chart.js. Tailwind CSS handles styling without writing custom CSS. If you want something simpler, Next.js bundles React + routing + API routes into one framework.`,
      },
      {
        heading: "Backend :  Python (FastAPI)",
        body: `FastAPI is beginner-friendly, has automatic API docs (Swagger UI), and Python's ecosystem is unmatched for security tooling. Libraries like feedparser (RSS), requests (APIs), and BeautifulSoup (scraping) make data collection trivial. Flask is an alternative if you want even simpler setup.`,
      },
      {
        heading: "Database :  PostgreSQL + Redis",
        body: `PostgreSQL stores your threat intel data: IOCs, articles, feed entries, user preferences. Redis acts as a cache and job queue for background feed polling. For a simpler start, SQLite works fine for localhost and requires zero setup. Upgrade to Postgres when you deploy.`,
      },
      {
        heading: "Task Queue :  Celery or APScheduler",
        body: `Feeds need to be polled on a schedule (every 15-60 min). Celery with Redis handles this at scale. For localhost, APScheduler is simpler :  it runs scheduled jobs inside your Python process without extra infrastructure.`,
      },
    ],
  },
  {
    id: "feeds",
    title: "02 :  Threat Intel Feeds",
    icon: "📡",
    color: "#00d4ff",
    summary: "Open-source feeds your app will consume for IOCs, news, and reputation data.",
    details: [
      {
        heading: "RSS / News Feeds",
        body: `• Krebs on Security :  krebsonsecurity.com/feed/\n• The Hacker News :  feeds.feedburner.com/TheHackersNews\n• Bleeping Computer :  bleepingcomputer.com/feed/\n• CISA Alerts :  cisa.gov/cybersecurity-advisories/all.xml\n• Dark Reading :  darkreading.com/rss.xml\n• Schneier on Security :  schneier.com/feed/\n• SANS ISC :  isc.sans.edu/rssfeed.xml\n\nUse Python's feedparser library to poll these every 30: 60 minutes.`,
      },
      {
        heading: "Malware / IOC Feeds",
        body: `• VirusTotal API (v3) :  Query file hashes, URLs, domains. Free tier: 4 req/min, 500/day. Enough for personal use.\n• MalwareBazaar (abuse.ch) :  Free bulk IOC downloads, no API key needed. CSV/JSON exports of recent malware samples.\n• URLhaus (abuse.ch) :  Database of malicious URLs. Free API with JSON endpoints.\n• ThreatFox (abuse.ch) :  IOCs tied to specific malware families. Free, structured JSON API.`,
      },
      {
        heading: "IP / Domain Reputation",
        body: `• AbuseIPDB :  IP reputation lookups. Free tier: 1,000 checks/day. Great for enriching firewall logs.\n• AlienVault OTX :  Community-driven threat intel pulses. Free API with IOCs, YARA rules, and context.\n• Shodan (InternetDB) :  Free endpoint: internetdb.shodan.io/{ip} returns ports, vulns, hostnames. No key needed.\n• GreyNoise :  Identifies IPs scanning the internet. Free Community API: 50 queries/day.`,
      },
      {
        heading: "Vulnerability Feeds",
        body: `• NVD (NIST) :  National Vulnerability Database. Free REST API for CVE lookups and bulk downloads.\n• CISA KEV :  Known Exploited Vulnerabilities catalog. JSON feed of actively exploited CVEs.\n• Exploit-DB :  Public exploit database. Searchable, downloadable. Pairs with CVEs.`,
      },
    ],
  },
  {
    id: "dashboard",
    title: "03 :  Dashboard Views",
    icon: "📊",
    color: "#a78bfa",
    summary: "Multiple views to visualize and interact with collected intelligence.",
    details: [
      {
        heading: "Threat Overview (Home)",
        body: `A real-time summary panel showing: total IOCs collected today, top trending CVEs, recent critical CISA alerts, and a timeline of the latest 20 feed items. Use cards with severity badges (Critical/High/Medium/Low) color-coded. A world map widget can show geographic distribution of threat origins using a library like react-simple-maps.`,
      },
      {
        heading: "News Feed Aggregator",
        body: `A scrollable, filterable list of security articles from your RSS sources. Each card shows: title, source, publish date, auto-generated tags (malware, phishing, ransomware, APT, vulnerability), and a relevance score based on user role. Include a search bar and tag filters. Mark items as read/starred/archived.`,
      },
      {
        heading: "IOC Explorer",
        body: `A table/search interface for Indicators of Compromise. Users can search by hash, IP, domain, or URL. Results show enrichment data from VirusTotal, AbuseIPDB, and Shodan side-by-side. Include a manual submission form where users paste an IOC and get instant lookups across all integrated APIs.`,
      },
      {
        heading: "Vulnerability Tracker",
        body: `Track CVEs with a kanban-style board or sortable table. Columns: CVE ID, CVSS score, affected products, exploit availability (from Exploit-DB), CISA KEV status. Filter by severity, date range, or product. Highlight CVEs that appear in both NVD and CISA KEV as high priority.`,
      },
      {
        heading: "Analytics & Trends",
        body: `Charts showing: IOCs collected over time (line chart), threat category distribution (pie/donut), top malware families this week (bar chart), feed source activity (heatmap). Use Recharts or Chart.js. This view helps identify patterns :  e.g., a spike in phishing IOCs before a holiday.`,
      },
    ],
  },
  {
    id: "personalization",
    title: "04 :  Personalization",
    icon: "🎯",
    color: "#f472b6",
    summary: "Role-based filtering so each user sees what matters most to them.",
    details: [
      {
        heading: "Role Profiles",
        body: `Define preset profiles that control default filters and priority scoring:\n\n• Security Engineer :  Prioritize: CVEs, exploit code, IOCs, malware hashes. De-prioritize: compliance news, career articles.\n• GRC / Compliance :  Prioritize: regulatory updates, CISA alerts, framework changes, breach disclosures. De-prioritize: raw IOCs, exploit details.\n• SOC Analyst :  Prioritize: real-time IOCs, AbuseIPDB hits, active campaigns, detection rules. De-prioritize: long-form research, policy.\n• Security Student :  Show everything with explanatory context. Add "learn more" links and glossary tooltips for jargon.\n• CISO / Manager :  Prioritize: executive summaries, risk trends, breach impact reports. De-prioritize: technical IOC details.`,
      },
      {
        heading: "Relevance Scoring Engine",
        body: `Each feed item gets a relevance score (0: 100) based on: keyword matching against role profile, source credibility weight, recency, and severity (if CVE/IOC). Store keyword sets per role in the database. The backend computes scores during ingestion. Users see items sorted by relevance by default, with the option to switch to chronological.`,
      },
      {
        heading: "Custom Watchlists",
        body: `Let users create personal watchlists: specific CVE IDs, IP ranges, domain patterns, malware family names, or product names. When new data matches a watchlist item, it surfaces at the top of the dashboard. Optional: email or browser notifications for critical matches.`,
      },
      {
        heading: "Daily Digest",
        body: `A scheduled job (morning, configurable) compiles the top 10 items for the user's role into a digest view or optional email. This is the "curated gateway" :  users open the app and immediately see what matters without scrolling through noise.`,
      },
    ],
  },
  {
    id: "architecture",
    title: "05 :  Architecture",
    icon: "🏗️",
    color: "#fbbf24",
    summary: "How all the components connect :  from feeds to frontend.",
    details: [
      {
        heading: "Data Flow",
        body: `1. INGESTION :  Scheduled workers poll RSS feeds, API endpoints (VirusTotal, AbuseIPDB, NVD) at set intervals. Raw data is normalized into a common schema and stored in PostgreSQL.\n\n2. ENRICHMENT :  When an IOC is ingested, a background job queries enrichment APIs (VirusTotal, Shodan, GreyNoise) and attaches context. Results are cached in Redis to avoid rate-limit waste.\n\n3. SCORING :  The relevance engine tags each item with categories and computes per-role scores. Watchlist matches are flagged.\n\n4. SERVING :  FastAPI exposes REST endpoints: /api/feed, /api/iocs, /api/cves, /api/dashboard. The React frontend calls these.\n\n5. DISPLAY :  React renders dashboard views. User interactions (search, filter, star) call the API and update state.`,
      },
      {
        heading: "Localhost Setup",
        body: `For local development:\n• Frontend: Vite dev server on port 5173\n• Backend: FastAPI with uvicorn on port 8000\n• Database: SQLite file (zero config) or Docker Postgres\n• Scheduler: APScheduler running in the FastAPI process\n• No Redis needed :  use in-memory caching\n\nOne command to start: a docker-compose.yml that spins up everything.`,
      },
      {
        heading: "Production Deployment",
        body: `When ready to deploy to your own domain:\n• Host: A $5-10/mo VPS (DigitalOcean, Linode, Hetzner) or free tier (Oracle Cloud, AWS Lightsail trial)\n• Reverse Proxy: Nginx or Caddy (Caddy auto-configures HTTPS)\n• Database: PostgreSQL in Docker or managed DB\n• Queue: Redis in Docker for Celery workers\n• Frontend: Build React to static files, serve via Nginx\n• Domain: Point DNS A record to your VPS IP. Caddy handles SSL.\n• Optional: Cloudflare in front for DDoS protection and caching.`,
      },
      {
        heading: "Suggested Build Order",
        body: `Week 1-2: Set up FastAPI + SQLite. Write one RSS feed poller. Store articles. Build a simple /api/feed endpoint.\n\nWeek 3-4: Add React frontend with Vite. Build the news feed view. Connect to API.\n\nWeek 5-6: Add more feeds (abuse.ch, NVD). Build IOC Explorer and CVE tracker views.\n\nWeek 7-8: Integrate VirusTotal and AbuseIPDB APIs. Add enrichment pipeline.\n\nWeek 9-10: Build personalization :  role profiles, relevance scoring, watchlists.\n\nWeek 11-12: Dashboard analytics, daily digest, polish UI. Deploy to VPS.`,
      },
    ],
  },
];

const ArchDiagram = () => {
  const nodes = [
    { id: "feeds", label: "Threat Feeds", sub: "RSS, APIs, IOC sources", x: 80, y: 50, color: "#00d4ff" },
    { id: "ingest", label: "Ingestion Workers", sub: "Scheduled polling", x: 80, y: 170, color: "#00ff87" },
    { id: "db", label: "PostgreSQL", sub: "Normalized storage", x: 80, y: 290, color: "#fbbf24" },
    { id: "enrich", label: "Enrichment", sub: "VT, AbuseIPDB, Shodan", x: 280, y: 170, color: "#f472b6" },
    { id: "cache", label: "Redis Cache", sub: "Rate-limit aware", x: 280, y: 290, color: "#fb923c" },
    { id: "api", label: "FastAPI", sub: "REST endpoints", x: 180, y: 400, color: "#a78bfa" },
    { id: "react", label: "React Dashboard", sub: "Vite + Tailwind", x: 180, y: 510, color: "#34d399" },
  ];

  const edges = [
    { from: "feeds", to: "ingest" },
    { from: "ingest", to: "db" },
    { from: "ingest", to: "enrich" },
    { from: "enrich", to: "cache" },
    { from: "cache", to: "db" },
    { from: "db", to: "api" },
    { from: "cache", to: "api" },
    { from: "api", to: "react" },
  ];

  const getNode = (id) => nodes.find((n) => n.id === id);

  return (
    <svg viewBox="0 0 420 590" style={{ width: "100%", maxWidth: 420, display: "block", margin: "0 auto" }}>
      <defs>
        <marker id="arrow" viewBox="0 0 10 10" refX="10" refY="5" markerWidth="6" markerHeight="6" orient="auto">
          <path d="M 0 0 L 10 5 L 0 10 z" fill="#555" />
        </marker>
      </defs>
      {edges.map((e, i) => {
        const from = getNode(e.from);
        const to = getNode(e.to);
        return (
          <line
            key={i}
            x1={from.x + 60}
            y1={from.y + 35}
            x2={to.x + 60}
            y2={to.y + 5}
            stroke="#444"
            strokeWidth="1.5"
            markerEnd="url(#arrow)"
            strokeDasharray="4 3"
          />
        );
      })}
      {nodes.map((n) => (
        <g key={n.id}>
          <rect x={n.x} y={n.y} width={120} height={45} rx={8} fill="#1a1a2e" stroke={n.color} strokeWidth="1.5" />
          <text x={n.x + 60} y={n.y + 18} textAnchor="middle" fill={n.color} fontSize="11" fontWeight="600" fontFamily="monospace">
            {n.label}
          </text>
          <text x={n.x + 60} y={n.y + 33} textAnchor="middle" fill="#888" fontSize="9" fontFamily="monospace">
            {n.sub}
          </text>
        </g>
      ))}
    </svg>
  );
};

export default function CTIRoadmap() {
  const [activePhase, setActivePhase] = useState("stack");
  const [expandedDetail, setExpandedDetail] = useState(null);

  const phase = PHASES.find((p) => p.id === activePhase);

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#0a0a14",
        color: "#e0e0e0",
        fontFamily: "'IBM Plex Mono', 'Fira Code', monospace",
      }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@300;400;500;600;700&family=Space+Grotesk:wght@400;600;700&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: #0a0a14; }
        ::-webkit-scrollbar-thumb { background: #333; border-radius: 3px; }
      `}</style>

      {/* Header */}
      <div style={{ padding: "32px 24px 0", maxWidth: 960, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 6 }}>
          <div
            style={{
              width: 10,
              height: 10,
              borderRadius: "50%",
              background: "#00ff87",
              boxShadow: "0 0 12px #00ff8766",
              animation: "pulse 2s infinite",
            }}
          />
          <span style={{ color: "#666", fontSize: 12, letterSpacing: 3, textTransform: "uppercase" }}>
            Project Roadmap
          </span>
        </div>
        <h1
          style={{
            fontFamily: "'Space Grotesk', sans-serif",
            fontSize: "clamp(24px, 5vw, 36px)",
            fontWeight: 700,
            background: "linear-gradient(135deg, #00ff87, #00d4ff)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            lineHeight: 1.2,
            marginBottom: 8,
          }}
        >
          Cyber Threat Intelligence Platform
        </h1>
        <p style={{ color: "#777", fontSize: 14, maxWidth: 600, lineHeight: 1.6 }}>
          A complete roadmap for building your own CTI dashboard :  from stack selection to deployment.
          Click each phase below to explore.
        </p>
      </div>

      {/* Phase Tabs */}
      <div style={{ maxWidth: 960, margin: "24px auto 0", padding: "0 24px" }}>
        <div
          style={{
            display: "flex",
            gap: 6,
            overflowX: "auto",
            paddingBottom: 8,
          }}
        >
          {PHASES.map((p) => (
            <button
              key={p.id}
              onClick={() => {
                setActivePhase(p.id);
                setExpandedDetail(null);
              }}
              style={{
                flex: "0 0 auto",
                padding: "10px 16px",
                borderRadius: 8,
                border: activePhase === p.id ? `1.5px solid ${p.color}` : "1.5px solid #222",
                background: activePhase === p.id ? `${p.color}11` : "#111118",
                color: activePhase === p.id ? p.color : "#666",
                fontSize: 12,
                fontFamily: "inherit",
                cursor: "pointer",
                transition: "all 0.2s",
                whiteSpace: "nowrap",
                fontWeight: activePhase === p.id ? 600 : 400,
              }}
            >
              {p.icon} {p.title}
            </button>
          ))}
        </div>
      </div>

      {/* Phase Content */}
      <div style={{ maxWidth: 960, margin: "20px auto", padding: "0 24px 40px" }}>
        <div
          style={{
            background: "#111118",
            borderRadius: 12,
            border: `1px solid ${phase.color}22`,
            overflow: "hidden",
          }}
        >
          {/* Phase Header */}
          <div style={{ padding: "24px 24px 16px", borderBottom: "1px solid #1a1a2e" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
              <span style={{ fontSize: 24 }}>{phase.icon}</span>
              <h2
                style={{
                  fontFamily: "'Space Grotesk', sans-serif",
                  fontSize: 22,
                  fontWeight: 700,
                  color: phase.color,
                }}
              >
                {phase.title}
              </h2>
            </div>
            <p style={{ color: "#888", fontSize: 14, lineHeight: 1.5 }}>{phase.summary}</p>
          </div>

          {/* Architecture Diagram (only for architecture phase) */}
          {phase.id === "architecture" && (
            <div style={{ padding: "20px 24px 0" }}>
              <div
                style={{
                  background: "#0d0d1a",
                  borderRadius: 10,
                  padding: "20px 12px",
                  border: "1px solid #1a1a2e",
                }}
              >
                <ArchDiagram />
              </div>
            </div>
          )}

          {/* Detail Cards */}
          <div style={{ padding: 16 }}>
            {phase.details.map((d, i) => {
              const isExpanded = expandedDetail === `${phase.id}-${i}`;
              return (
                <div
                  key={i}
                  style={{
                    marginBottom: 8,
                    borderRadius: 8,
                    border: isExpanded ? `1px solid ${phase.color}44` : "1px solid #1a1a2e",
                    background: isExpanded ? `${phase.color}08` : "#0d0d1a",
                    transition: "all 0.2s",
                    overflow: "hidden",
                  }}
                >
                  <button
                    onClick={() => setExpandedDetail(isExpanded ? null : `${phase.id}-${i}`)}
                    style={{
                      width: "100%",
                      padding: "14px 16px",
                      background: "none",
                      border: "none",
                      color: "#e0e0e0",
                      fontSize: 14,
                      fontFamily: "inherit",
                      fontWeight: 600,
                      cursor: "pointer",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      textAlign: "left",
                    }}
                  >
                    <span>
                      <span style={{ color: phase.color, marginRight: 8 }}>▸</span>
                      {d.heading}
                    </span>
                    <span
                      style={{
                        color: "#555",
                        transform: isExpanded ? "rotate(180deg)" : "rotate(0)",
                        transition: "transform 0.2s",
                        fontSize: 12,
                      }}
                    >
                      ▼
                    </span>
                  </button>
                  {isExpanded && (
                    <div
                      style={{
                        padding: "0 16px 16px",
                        color: "#aaa",
                        fontSize: 13,
                        lineHeight: 1.7,
                        whiteSpace: "pre-wrap",
                        borderTop: "1px solid #1a1a2e",
                        paddingTop: 14,
                      }}
                    >
                      {d.body}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Quick Reference Cards */}
        <div style={{ marginTop: 24, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 }}>
          {[
            { label: "Estimated Build", value: "10: 12 weeks", color: "#00ff87" },
            { label: "Min. VPS Cost", value: "$5: 10/mo", color: "#00d4ff" },
            { label: "Free API Calls/Day", value: "~1,500+", color: "#a78bfa" },
            { label: "Feed Sources", value: "15+ included", color: "#f472b6" },
          ].map((c, i) => (
            <div
              key={i}
              style={{
                background: "#111118",
                borderRadius: 10,
                padding: "16px 18px",
                border: "1px solid #1a1a2e",
              }}
            >
              <div style={{ color: "#555", fontSize: 11, letterSpacing: 1, textTransform: "uppercase", marginBottom: 6 }}>
                {c.label}
              </div>
              <div style={{ color: c.color, fontSize: 20, fontWeight: 700, fontFamily: "'Space Grotesk', sans-serif" }}>
                {c.value}
              </div>
            </div>
          ))}
        </div>
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>
    </div>
  );
}
