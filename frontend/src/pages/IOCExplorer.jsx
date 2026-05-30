import { useEffect, useState, useCallback } from "react";
import {
  Search,
  Shield,
  RefreshCw,
  XCircle,
  Zap,
  Download,
} from "lucide-react";
import { getIOCs, searchIOCs, getIOCStats, lookupIOC, pollIOCs, exportIOCs } from "../api/client";

const TYPE_COLORS = {
  hash: "#a78bfa",
  ip: "#00d4ff",
  domain: "#00ff87",
  url: "#f472b6",
  unknown: "#666",
};

const SCORE_STYLES = {
  Critical: { color: "#ef4444", bg: "#ef444411", border: "#ef444433" },
  High:     { color: "#fb923c", bg: "#fb923c11", border: "#fb923c33" },
  Medium:   { color: "#fbbf24", bg: "#fbbf2411", border: "#fbbf2433" },
  Low:      { color: "#6b7280", bg: "#6b728011", border: "#6b728033" },
};

function ScoreBadge({ score, label }) {
  const s = SCORE_STYLES[label] || SCORE_STYLES.Low;
  return (
    <div className="flex items-center gap-1.5">
      <span
        className="text-[10px] font-bold px-2 py-0.5 rounded-full border"
        style={{ color: s.color, background: s.bg, borderColor: s.border }}
      >
        {label}
      </span>
      <span className="text-xs text-gray-500">{score}</span>
    </div>
  );
}

function EnrichmentCard({ enrichment }) {
  const { source, ...rest } = enrichment;
  return (
    <div className="bg-cti-bg rounded-lg border border-cti-border p-3">
      <div className="text-xs font-semibold text-cti-amber mb-2 uppercase tracking-wider">
        {source.replace(/_/g, " ")}
      </div>
      <div className="space-y-1">
        {Object.entries(rest).map(([key, val]) => {
          if (val === null || val === undefined) return null;
          const display = Array.isArray(val)
            ? val.length > 0 ? val.join(", ") : "none"
            : String(val);
          return (
            <div key={key} className="flex items-start gap-2 text-xs">
              <span className="text-gray-500 min-w-[100px]">{key.replace(/_/g, " ")}</span>
              <span className="text-gray-300 break-all">{display}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function IOCExplorer() {
  const [iocs, setIOCs] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [polling, setPolling] = useState(false);

  const [lookupValue, setLookupValue] = useState("");
  const [lookupResult, setLookupResult] = useState(null);
  const [lookupLoading, setLookupLoading] = useState(false);

  const [exportFormat, setExportFormat] = useState("json");
  const [exportMinScore, setExportMinScore] = useState(0);
  const [exporting, setExporting] = useState(false);

  const [typeFilter, setTypeFilter] = useState("");
  const [search, setSearch] = useState("");
  const [ftsMode, setFtsMode] = useState(false);
  const [sort, setSort] = useState("score");

  const fetchData = useCallback(async () => {
    try {
      let iocData;
      if (ftsMode && search.trim().length >= 2) {
        iocData = await searchIOCs(search.trim(), 100);
      } else {
        const params = { limit: "100", sort };
        if (typeFilter) params.ioc_type = typeFilter;
        if (!ftsMode && search) params.search = search;
        iocData = await getIOCs(params);
      }
      const statsData = await getIOCStats();
      setIOCs(iocData.iocs);
      setStats(statsData);
    } catch (err) {
      console.error("Failed to load IOCs:", err);
    } finally {
      setLoading(false);
    }
  }, [typeFilter, search, ftsMode, sort]);

  useEffect(() => { fetchData(); }, []);

  useEffect(() => {
    const timer = setTimeout(() => fetchData(), 300);
    return () => clearTimeout(timer);
  }, [typeFilter, search, ftsMode, sort]);

  const handleLookup = async (e) => {
    e.preventDefault();
    if (!lookupValue.trim()) return;
    setLookupLoading(true);
    setLookupResult(null);
    try {
      setLookupResult(await lookupIOC(lookupValue.trim()));
    } catch (err) {
      setLookupResult({ error: err.message });
    } finally {
      setLookupLoading(false);
    }
  };

  const handlePoll = async () => {
    setPolling(true);
    try {
      await pollIOCs();
      await fetchData();
    } finally {
      setPolling(false);
    }
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const params = { format: exportFormat, min_score: exportMinScore };
      if (typeFilter) params.ioc_type = typeFilter;
      const { blob, filename } = await exportIOCs(params);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Export failed:", err);
    } finally {
      setExporting(false);
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64 text-gray-500">Loading IOCs...</div>;
  }

  return (
    <div className="max-w-5xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display text-2xl font-bold text-white">IOC Explorer</h1>
          <p className="text-sm text-gray-500 mt-1">Search and enrich Indicators of Compromise</p>
        </div>
        <button
          onClick={handlePoll}
          disabled={polling}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-cti-purple/10 text-cti-purple border border-cti-purple/20 hover:bg-cti-purple/20 transition-colors text-sm disabled:opacity-50"
        >
          <RefreshCw size={16} className={polling ? "animate-spin" : ""} />
          {polling ? "Polling..." : "Poll IOC Feeds"}
        </button>
      </div>

      {/* IOC Lookup Box */}
      <div className="bg-cti-surface rounded-xl border border-cti-border p-5 mb-6">
        <h3 className="text-sm font-semibold text-gray-300 mb-3 flex items-center gap-2">
          <Shield size={16} className="text-cti-green" />
          IOC Lookup
        </h3>
        <form onSubmit={handleLookup} className="flex gap-3">
          <div className="flex-1 relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
            <input
              type="text"
              placeholder="Paste a hash, IP, domain, or URL..."
              value={lookupValue}
              onChange={(e) => setLookupValue(e.target.value)}
              className="w-full pl-10 pr-4 py-3 rounded-lg bg-cti-bg border border-cti-border text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-cti-green/40 font-mono"
            />
          </div>
          <button
            type="submit"
            disabled={lookupLoading || !lookupValue.trim()}
            className="px-6 py-3 rounded-lg bg-cti-green/10 text-cti-green border border-cti-green/20 hover:bg-cti-green/20 transition-colors text-sm font-semibold disabled:opacity-50"
          >
            {lookupLoading ? "Looking up..." : "Enrich"}
          </button>
        </form>

        {lookupResult && (
          <div className="mt-4">
            {lookupResult.error ? (
              <div className="flex items-center gap-2 text-red-400 text-sm">
                <XCircle size={16} /> {lookupResult.error}
              </div>
            ) : (
              <div>
                <div className="flex items-center gap-3 mb-3">
                  <code className="text-sm text-gray-200 break-all">{lookupResult.value}</code>
                  <span
                    className="text-[10px] px-2 py-0.5 rounded-full border"
                    style={{
                      color: TYPE_COLORS[lookupResult.detected_type] || "#666",
                      borderColor: (TYPE_COLORS[lookupResult.detected_type] || "#666") + "44",
                      background: (TYPE_COLORS[lookupResult.detected_type] || "#666") + "11",
                    }}
                  >
                    {lookupResult.detected_type}
                  </span>
                  {lookupResult.score_label && (
                    <ScoreBadge score={lookupResult.threat_score} label={lookupResult.score_label} />
                  )}
                </div>
                {lookupResult.enrichments?.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {lookupResult.enrichments.map((e, i) => <EnrichmentCard key={i} enrichment={e} />)}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500">
                    No enrichment data available. Add API keys in <code className="text-cti-amber">.env</code> to enable lookups.
                  </p>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Stats Summary */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
          <div className="bg-cti-surface rounded-lg border border-cti-border p-3 text-center">
            <div className="text-xl font-display font-bold text-cti-green">{stats.total}</div>
            <div className="text-[10px] text-gray-500 uppercase tracking-wider">Total IOCs</div>
          </div>
          <div className="bg-cti-surface rounded-lg border border-red-500/20 p-3 text-center">
            <div className="text-xl font-display font-bold text-red-400">{stats.by_severity?.critical ?? 0}</div>
            <div className="text-[10px] text-gray-500 uppercase tracking-wider">Critical</div>
          </div>
          <div className="bg-cti-surface rounded-lg border border-orange-500/20 p-3 text-center">
            <div className="text-xl font-display font-bold text-orange-400">{stats.by_severity?.high ?? 0}</div>
            <div className="text-[10px] text-gray-500 uppercase tracking-wider">High</div>
          </div>
          {Object.entries(stats.by_type).slice(0, 2).map(([type, count]) => (
            <div key={type} className="bg-cti-surface rounded-lg border border-cti-border p-3 text-center">
              <div className="text-xl font-display font-bold" style={{ color: TYPE_COLORS[type] || "#666" }}>{count}</div>
              <div className="text-[10px] text-gray-500 uppercase tracking-wider">{type}</div>
            </div>
          ))}
        </div>
      )}

      {/* Filter Bar */}
      <div className="flex gap-3 mb-4 flex-wrap">
        <div className="flex-1 min-w-[200px] relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input
            type="text"
            placeholder={ftsMode ? "Full-text search (values, families, tags)…" : "Filter IOCs…"}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-cti-surface border border-cti-border text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-cti-blue/40"
          />
        </div>
        <button
          onClick={() => setFtsMode((v) => !v)}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs border transition-colors ${
            ftsMode
              ? "bg-cti-amber/10 text-cti-amber border-cti-amber/20"
              : "text-gray-500 border-transparent hover:text-gray-300"
          }`}
          title="Toggle full-text search (searches across all fields)"
        >
          <Zap size={13} /> FTS
        </button>
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value)}
          className="px-3 py-2 rounded-lg bg-cti-surface border border-cti-border text-xs text-gray-400 focus:outline-none"
        >
          <option value="score">Sort: Risk Score</option>
          <option value="first_seen">Sort: Newest</option>
        </select>
        <div className="flex gap-1">
          {["", "hash", "ip", "domain", "url"].map((t) => (
            <button
              key={t}
              onClick={() => setTypeFilter(t)}
              className={`px-3 py-2 rounded-lg text-xs transition-colors border ${
                typeFilter === t
                  ? "bg-cti-blue/10 text-cti-blue border-cti-blue/20"
                  : "text-gray-500 border-transparent hover:text-gray-300"
              }`}
            >
              {t || "All"}
            </button>
          ))}
        </div>
      </div>

      {/* IOC Table */}
      <div className="bg-cti-surface rounded-xl border border-cti-border overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-cti-border text-left">
              <th className="px-4 py-3 text-xs text-gray-500 font-medium">Risk</th>
              <th className="px-4 py-3 text-xs text-gray-500 font-medium">Type</th>
              <th className="px-4 py-3 text-xs text-gray-500 font-medium">Value</th>
              <th className="px-4 py-3 text-xs text-gray-500 font-medium">Malware</th>
              <th className="px-4 py-3 text-xs text-gray-500 font-medium">Seen</th>
              <th className="px-4 py-3 text-xs text-gray-500 font-medium">First Seen</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-cti-border">
            {iocs.map((ioc) => (
              <tr key={ioc.id} className="hover:bg-white/[0.02] transition-colors">
                <td className="px-4 py-2.5">
                  <ScoreBadge score={ioc.threat_score} label={ioc.score_label} />
                </td>
                <td className="px-4 py-2.5">
                  <span
                    className="text-[10px] px-2 py-0.5 rounded-full border"
                    style={{
                      color: TYPE_COLORS[ioc.ioc_type] || "#666",
                      borderColor: (TYPE_COLORS[ioc.ioc_type] || "#666") + "44",
                      background: (TYPE_COLORS[ioc.ioc_type] || "#666") + "11",
                    }}
                  >
                    {ioc.ioc_type}
                  </span>
                </td>
                <td className="px-4 py-2.5 font-mono text-xs text-gray-300 max-w-[280px] truncate">
                  {ioc.value}
                </td>
                <td className="px-4 py-2.5 text-xs text-cti-pink">
                  {ioc.malware_family || "—"}
                </td>
                <td className="px-4 py-2.5 text-xs text-gray-500">
                  <span
                    className={`px-1.5 py-0.5 rounded text-[10px] ${
                      ioc.seen_count > 1
                        ? "bg-cti-amber/10 text-cti-amber border border-cti-amber/20"
                        : ""
                    }`}
                  >
                    ×{ioc.seen_count}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-xs text-gray-500">
                  {ioc.first_seen ? new Date(ioc.first_seen).toLocaleDateString() : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {iocs.length === 0 && (
          <div className="p-12 text-center text-gray-500 text-sm">
            No IOCs found. Poll the IOC feeds to populate this view.
          </div>
        )}
      </div>

      {/* Export Panel */}
      <div className="mt-6 bg-cti-surface rounded-xl border border-cti-border p-5">
        <h3 className="text-sm font-semibold text-gray-300 mb-3 flex items-center gap-2">
          <Download size={15} className="text-cti-blue" />
          Export / Blocklist Generator
        </h3>
        <div className="flex flex-wrap gap-3 items-end">
          <div>
            <label className="block text-[10px] text-gray-500 uppercase tracking-wider mb-1">Format</label>
            <select
              value={exportFormat}
              onChange={(e) => setExportFormat(e.target.value)}
              className="px-3 py-2 rounded-lg bg-cti-bg border border-cti-border text-sm text-gray-300 focus:outline-none"
            >
              <option value="json">JSON</option>
              <option value="csv">CSV</option>
              <option value="stix">STIX 2.1</option>
              <option value="suricata">Suricata Rules</option>
              <option value="iptables">iptables Script</option>
            </select>
          </div>
          <div>
            <label className="block text-[10px] text-gray-500 uppercase tracking-wider mb-1">Min Score</label>
            <select
              value={exportMinScore}
              onChange={(e) => setExportMinScore(Number(e.target.value))}
              className="px-3 py-2 rounded-lg bg-cti-bg border border-cti-border text-sm text-gray-300 focus:outline-none"
            >
              <option value={0}>All</option>
              <option value={25}>Medium+ (≥25)</option>
              <option value={50}>High+ (≥50)</option>
              <option value={75}>Critical only (≥75)</option>
            </select>
          </div>
          {typeFilter && (
            <div className="text-xs text-gray-500 self-center">
              Filtered to: <span className="text-cti-blue">{typeFilter}</span>
            </div>
          )}
          <button
            onClick={handleExport}
            disabled={exporting}
            className="flex items-center gap-2 px-5 py-2 rounded-lg bg-cti-blue/10 text-cti-blue border border-cti-blue/20 hover:bg-cti-blue/20 transition-colors text-sm font-semibold disabled:opacity-50"
          >
            <Download size={14} />
            {exporting ? "Exporting…" : "Download"}
          </button>
        </div>
        <p className="text-[11px] text-gray-600 mt-2">
          Suricata and iptables formats include only IP and domain IOCs respectively. STIX 2.1 covers all types.
        </p>
      </div>
    </div>
  );
}
