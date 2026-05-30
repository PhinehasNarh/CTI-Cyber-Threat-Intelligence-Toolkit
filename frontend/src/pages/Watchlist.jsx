import { useEffect, useState } from "react";
import { Bell, Plus, Trash2, AlertTriangle, Shield } from "lucide-react";
import {
  getWatchlist,
  addWatchlistEntry,
  deleteWatchlistEntry,
  getWatchlistHits,
} from "../api/client";

const TYPE_COLORS = {
  hash: "#a78bfa",
  ip: "#00d4ff",
  domain: "#00ff87",
  url: "#f472b6",
  unknown: "#666",
};

function timeAgo(iso) {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export default function Watchlist() {
  const [entries, setEntries] = useState([]);
  const [hits, setHits] = useState([]);
  const [loading, setLoading] = useState(true);

  const [pattern, setPattern] = useState("");
  const [label, setLabel] = useState("");
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState("");

  const fetchAll = async () => {
    try {
      const [wl, h] = await Promise.all([getWatchlist(), getWatchlistHits(30)]);
      setEntries(wl.entries);
      setHits(h.hits);
    } catch (err) {
      console.error("Watchlist fetch failed:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAll(); }, []);

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!pattern.trim()) return;
    setAdding(true);
    setError("");
    try {
      await addWatchlistEntry(pattern.trim(), label.trim() || pattern.trim());
      setPattern("");
      setLabel("");
      await fetchAll();
    } catch (err) {
      setError(err.message.includes("409") ? "Pattern already in watchlist." : err.message);
    } finally {
      setAdding(false);
    }
  };

  const handleDelete = async (id) => {
    await deleteWatchlistEntry(id);
    setEntries((prev) => prev.filter((e) => e.id !== id));
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64 text-gray-500">Loading watchlist…</div>;
  }

  return (
    <div className="max-w-4xl">
      <div className="mb-6">
        <h1 className="font-display text-2xl font-bold text-white flex items-center gap-2">
          <Bell size={22} className="text-cti-amber" />
          IOC Watchlist
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Alert whenever an ingested IOC matches one of your monitored assets.
        </p>
      </div>

      {/* Add entry form */}
      <div className="bg-cti-surface rounded-xl border border-cti-border p-5 mb-6">
        <h3 className="text-sm font-semibold text-gray-300 mb-3 flex items-center gap-2">
          <Plus size={15} className="text-cti-green" /> Add Pattern
        </h3>
        <form onSubmit={handleAdd} className="flex gap-3 flex-wrap">
          <input
            type="text"
            placeholder="IP, domain, hash, or .suffix (e.g. .evil.com)"
            value={pattern}
            onChange={(e) => setPattern(e.target.value)}
            className="flex-[2] min-w-[200px] px-3 py-2.5 rounded-lg bg-cti-bg border border-cti-border text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-cti-green/40 font-mono"
          />
          <input
            type="text"
            placeholder="Label (optional)"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            className="flex-1 min-w-[120px] px-3 py-2.5 rounded-lg bg-cti-bg border border-cti-border text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-cti-green/40"
          />
          <button
            type="submit"
            disabled={adding || !pattern.trim()}
            className="px-5 py-2.5 rounded-lg bg-cti-green/10 text-cti-green border border-cti-green/20 hover:bg-cti-green/20 transition-colors text-sm font-semibold disabled:opacity-50"
          >
            {adding ? "Adding…" : "Add"}
          </button>
        </form>
        {error && <p className="text-red-400 text-xs mt-2">{error}</p>}
        <p className="text-xs text-gray-600 mt-2">
          Tip: prefix with <code className="text-gray-400">.domain.com</code> to match any subdomain.
          Substrings match automatically — <code className="text-gray-400">192.168.1</code> hits any IP in that subnet.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Watchlist entries */}
        <div>
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2">
            <Shield size={14} /> Monitored Patterns ({entries.length})
          </h2>
          {entries.length === 0 ? (
            <div className="bg-cti-surface rounded-xl border border-cti-border p-8 text-center text-gray-500 text-sm">
              No patterns yet. Add an asset above to start monitoring.
            </div>
          ) : (
            <div className="bg-cti-surface rounded-xl border border-cti-border overflow-hidden">
              {entries.map((entry, i) => (
                <div
                  key={entry.id}
                  className={`flex items-center gap-3 px-4 py-3 ${
                    i < entries.length - 1 ? "border-b border-cti-border" : ""
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="font-mono text-xs text-gray-200 truncate">{entry.pattern}</div>
                    <div className="text-[11px] text-gray-500 mt-0.5">{entry.label}</div>
                  </div>
                  {entry.hit_count > 0 && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-cti-amber/10 text-cti-amber border border-cti-amber/20">
                      {entry.hit_count} hit{entry.hit_count !== 1 ? "s" : ""}
                    </span>
                  )}
                  <button
                    onClick={() => handleDelete(entry.id)}
                    className="text-gray-600 hover:text-red-400 transition-colors p-1"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent hits */}
        <div>
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2">
            <AlertTriangle size={14} className="text-cti-amber" /> Recent Hits ({hits.length})
          </h2>
          {hits.length === 0 ? (
            <div className="bg-cti-surface rounded-xl border border-cti-border p-8 text-center text-gray-500 text-sm">
              No matches yet. Hits appear here when an ingested IOC matches a pattern.
            </div>
          ) : (
            <div className="bg-cti-surface rounded-xl border border-cti-border overflow-hidden">
              {hits.map((hit, i) => (
                <div
                  key={hit.id}
                  className={`px-4 py-3 ${i < hits.length - 1 ? "border-b border-cti-border" : ""}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span
                          className="text-[10px] px-1.5 py-0.5 rounded border"
                          style={{
                            color: TYPE_COLORS[hit.ioc_type] || "#666",
                            borderColor: (TYPE_COLORS[hit.ioc_type] || "#666") + "44",
                            background: (TYPE_COLORS[hit.ioc_type] || "#666") + "11",
                          }}
                        >
                          {hit.ioc_type}
                        </span>
                        <span className="text-[11px] text-gray-500">{hit.source}</span>
                      </div>
                      <div className="font-mono text-xs text-cti-amber truncate">{hit.ioc_value}</div>
                      <div className="text-[11px] text-gray-600 mt-0.5">
                        matched <span className="text-gray-400">{hit.label || hit.pattern}</span>
                      </div>
                    </div>
                    <div className="text-[10px] text-gray-600 shrink-0">{timeAgo(hit.hit_at)}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
