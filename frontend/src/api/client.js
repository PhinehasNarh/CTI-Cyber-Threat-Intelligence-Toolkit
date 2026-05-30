/**
 * API client for the CTI backend.
 * In dev mode, Vite proxies /api to http://localhost:8000.
 */

// In dev (or behind a Vercel rewrite), calls go to same-origin "/api".
// Set VITE_API_BASE_URL to a backend origin (e.g. https://cti-api.onrender.com)
// to call a cross-origin backend directly in production.
const BASE = (import.meta.env.VITE_API_BASE_URL || "").replace(/\/$/, "") + "/api";

export function activeWorkspace() {
  return localStorage.getItem("cti-workspace") || "1";
}

async function request(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    headers: {
      "Content-Type": "application/json",
      "X-Workspace-Id": activeWorkspace(),
      ...options.headers,
    },
    ...options,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API ${res.status}: ${text}`);
  }
  return res.json();
}

// Dashboard
export const getDashboard = () => request("/dashboard");

// Feed articles
export const getArticles = (params = {}) => {
  const qs = new URLSearchParams(params).toString();
  return request(`/feed${qs ? "?" + qs : ""}`);
};
export const getSources = () => request("/feed/sources");
export const updateArticle = (id, data) =>
  request(`/feed/${id}`, { method: "PATCH", body: JSON.stringify(data) });
export const updateArticleParams = (id, params = {}) => {
  const qs = new URLSearchParams(params).toString();
  return request(`/feed/${id}${qs ? "?" + qs : ""}`, { method: "PATCH" });
};
export const pollFeeds = () => request("/feed/poll", { method: "POST" });
export const readArticle = (id) => request(`/feed/${id}/read`);
export const getArticleBrief = (id) => request(`/feed/${id}/brief`);

// Triage queue
export const getTriageQueue = (params = {}) => {
  const qs = new URLSearchParams(params).toString();
  return request(`/triage${qs ? "?" + qs : ""}`);
};
export const getTriageSummary = () => request("/triage/summary");

// Digest
export const getDigest = (days = 7) => request(`/digest?days=${days}`);

// Leaderboard
export const getLeaderboard = (days) =>
  request(`/leaderboard${days ? "?days=" + days : ""}`);

// Time-lapse replay
export const getTimelapse = (days = 90) => request(`/timelapse?days=${days}`);

// Honeypot integration
export const getHoneypotHits = (limit = 50) => request(`/honeypot/hits?limit=${limit}`);
export const recordHoneypotHit = (body) =>
  request("/honeypot/hit", { method: "POST", body: JSON.stringify(body) });

// World threat map (geolocation)
export const getThreatMap = (limit = 150) => request(`/geo/map?limit=${limit}`);

// Certificate Transparency logs (crt.sh)
export const searchCTLogs = (domain, limit = 50) =>
  request(`/ctlogs?domain=${encodeURIComponent(domain)}&limit=${limit}`);

// Chatbot (rule-based NL query)
export const askChat = (query) =>
  request("/chat", { method: "POST", body: JSON.stringify({ query }) });

// Clusters
export const getClusters = (params = {}) => {
  const qs = new URLSearchParams(params).toString();
  return request(`/clusters${qs ? "?" + qs : ""}`);
};

// Retention policies
export const getRetention = () => request("/retention");
export const createRetention = (body) =>
  request("/retention", { method: "POST", body: JSON.stringify(body) });
export const toggleRetention = (id, isActive) =>
  request(`/retention/${id}?is_active=${isActive}`, { method: "PATCH" });
export const deleteRetention = (id) =>
  request(`/retention/${id}`, { method: "DELETE" });
export const runRetention = (id) =>
  request(`/retention/${id}/run`, { method: "POST" });

// IOCs
export const getIOCs = (params = {}) => {
  const qs = new URLSearchParams(params).toString();
  return request(`/iocs${qs ? "?" + qs : ""}`);
};
export const searchIOCs = (q, limit = 50) =>
  request(`/iocs/search?q=${encodeURIComponent(q)}&limit=${limit}`);
export const getIOCStats = () => request("/iocs/stats");
export const lookupIOC = (value, iocType) =>
  request(`/iocs/lookup?value=${encodeURIComponent(value)}${iocType ? "&ioc_type=" + iocType : ""}`, {
    method: "POST",
  });
export const pollIOCs = () => request("/iocs/poll", { method: "POST" });
export const getIOCTags = () => request("/iocs/tags");
export const getIOCGraph = (limit = 80) => request(`/iocs/graph?limit=${limit}`);
export const updateIOC = (id, params = {}) => {
  const qs = new URLSearchParams(params).toString();
  return request(`/iocs/${id}${qs ? "?" + qs : ""}`, { method: "PATCH" });
};

// Watchlist
export const getWatchlist = () => request("/watchlist");
export const addWatchlistEntry = (pattern, label) =>
  request("/watchlist", { method: "POST", body: JSON.stringify({ pattern, label }) });
export const deleteWatchlistEntry = (id) =>
  request(`/watchlist/${id}`, { method: "DELETE" });
export const getWatchlistHits = (limit = 50) =>
  request(`/watchlist/hits?limit=${limit}`);

// ATT&CK
export const getAttackHeatmap = () => request("/attack/heatmap");

// Timeline
export const getTimeline = (days = 30) => request(`/timeline?days=${days}`);

// Export — returns a Blob for file download
export const exportIOCs = async (params = {}) => {
  const qs = new URLSearchParams(params).toString();
  const res = await fetch(`${BASE}/export/iocs${qs ? "?" + qs : ""}`);
  if (!res.ok) throw new Error(`Export failed: ${res.status}`);
  const blob = await res.blob();
  const disposition = res.headers.get("Content-Disposition") || "";
  const filename = disposition.match(/filename=(.+)/)?.[1] ?? "cti_export";
  return { blob, filename };
};

// Alert rules & hits
export const getAlertRules = () => request("/alerts/rules");
export const createAlertRule = (body) =>
  request("/alerts/rules", { method: "POST", body: JSON.stringify(body) });
export const toggleAlertRule = (id, isActive) =>
  request(`/alerts/rules/${id}?is_active=${isActive}`, { method: "PATCH" });
export const deleteAlertRule = (id) =>
  request(`/alerts/rules/${id}`, { method: "DELETE" });
export const getAlertHits = (limit = 50) =>
  request(`/alerts/hits?limit=${limit}`);

// Threat actors
export const getActors = () => request("/actors");
export const getActor = (id) => request(`/actors/${id}`);
export const createActor = (body) =>
  request("/actors", { method: "POST", body: JSON.stringify(body) });
export const updateActor = (id, body) =>
  request(`/actors/${id}`, { method: "PATCH", body: JSON.stringify(body) });
export const deleteActor = (id) =>
  request(`/actors/${id}`, { method: "DELETE" });

// Campaigns
export const getCampaigns = () => request("/campaigns");
export const getCampaign = (id) => request(`/campaigns/${id}`);
export const createCampaign = (body) =>
  request("/campaigns", { method: "POST", body: JSON.stringify(body) });
export const updateCampaign = (id, body) =>
  request(`/campaigns/${id}`, { method: "PATCH", body: JSON.stringify(body) });
export const deleteCampaign = (id) =>
  request(`/campaigns/${id}`, { method: "DELETE" });
export const addCampaignIOC = (id, iocValue) =>
  request(`/campaigns/${id}/iocs?ioc_value=${encodeURIComponent(iocValue)}`, { method: "POST" });
export const removeCampaignIOC = (id, iocId) =>
  request(`/campaigns/${id}/iocs/${iocId}`, { method: "DELETE" });

// Audit log
export const getAuditLog = (params = {}) => {
  const qs = new URLSearchParams(params).toString();
  return request(`/audit${qs ? "?" + qs : ""}`);
};

// Asset watch (Shodan InternetDB)
export const getAssets = () => request("/assets");
export const addAsset = (body) =>
  request("/assets", { method: "POST", body: JSON.stringify(body) });
export const deleteAsset = (id) => request(`/assets/${id}`, { method: "DELETE" });

// Integrations (MISP / OpenCTI / Dark Web)
export const getIntegrationStatus = () => request("/integrations/status");
export const pushToMisp = (minScore = 75) =>
  request(`/integrations/misp/push?min_score=${minScore}`, { method: "POST" });

// Feed scheduler (#15)
export const getFeedSchedules = () => request("/feeds");
export const updateFeedSchedule = (id, body) =>
  request(`/feeds/${id}`, { method: "PATCH", body: JSON.stringify(body) });
export const runDueFeeds = () => request("/feeds/run-due", { method: "POST" });
export const getFeedPlugins = () => request("/feeds/plugins");
export const runFeedPlugin = (name) =>
  request(`/feeds/plugins/${encodeURIComponent(name)}/run`, { method: "POST" });

// API keys (public REST API #26)
export const getApiKeys = () => request("/keys");
export const createApiKey = (body) =>
  request("/keys", { method: "POST", body: JSON.stringify(body) });
export const toggleApiKey = (id, isActive) =>
  request(`/keys/${id}?is_active=${isActive}`, { method: "PATCH" });
export const deleteApiKey = (id) => request(`/keys/${id}`, { method: "DELETE" });

// Workspaces (multi-tenant)
export const getWorkspaces = () => request("/workspaces");
export const createWorkspace = (body) =>
  request("/workspaces", { method: "POST", body: JSON.stringify(body) });
export const deleteWorkspace = (id) =>
  request(`/workspaces/${id}`, { method: "DELETE" });

// Health
export const getHealth = () => request("/health");
