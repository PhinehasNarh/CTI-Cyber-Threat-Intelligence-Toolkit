import { useState, useEffect, useCallback } from "react";
import { getFeedSchedules, updateFeedSchedule, runDueFeeds, getFeedPlugins, runFeedPlugin } from "../api/client";
import { CalendarClock, ToggleLeft, ToggleRight, Play, Puzzle } from "lucide-react";

export default function FeedScheduler() {
  const [feeds, setFeeds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [msg, setMsg] = useState("");
  const [plugins, setPlugins] = useState([]);
  const [pluginMsg, setPluginMsg] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [r, p] = await Promise.all([getFeedSchedules(), getFeedPlugins()]);
      setFeeds(r.feeds ?? []);
      setPlugins(p.plugins ?? []);
    } finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  async function runPlugin(name) {
    setPluginMsg(`Running ${name}…`);
    try { const r = await runFeedPlugin(name); setPluginMsg(`${name}: ${r.new_records} new records.`); }
    catch (e) { setPluginMsg(`${name}: ${e.message}`); }
  }

  async function patch(id, body) {
    const updated = await updateFeedSchedule(id, body);
    setFeeds((fs) => fs.map((f) => (f.id === id ? { ...f, ...updated } : f)));
  }

  async function runNow() {
    setRunning(true); setMsg("");
    try {
      const r = await runDueFeeds();
      setMsg(`Swept ${Object.keys(r.polled).length} due feeds, ${r.total_new} new items.`);
      await load();
    } finally { setRunning(false); }
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <CalendarClock size={22} className="text-cti-green" />
          <h1 className="text-xl font-semibold text-gray-100">Feed Scheduler</h1>
        </div>
        <button onClick={runNow} disabled={running}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-cti-green/10 text-cti-green border border-cti-green/20 hover:bg-cti-green/20 text-sm disabled:opacity-50">
          <Play size={15} className={running ? "animate-pulse" : ""} /> {running ? "Sweeping…" : "Run due now"}
        </button>
      </div>
      <p className="text-xs text-gray-500">
        Each feed polls on its own interval; a background sweep runs every 5 minutes and polls those that are due, highest priority first (lower number = higher priority).
      </p>
      {msg && <p className="text-xs text-cti-amber">{msg}</p>}

      <div className="bg-cti-surface border border-cti-border rounded-xl overflow-hidden">
        <div className="grid grid-cols-[1fr_auto_auto_auto_auto] gap-3 px-5 py-2.5 border-b border-cti-border text-[10px] text-gray-500 uppercase tracking-wider">
          <span>Feed</span><span>Interval</span><span>Priority</span><span>Last</span><span>Enabled</span>
        </div>
        {loading ? (
          <div className="p-8 text-center text-gray-500 text-sm">Loading…</div>
        ) : (
          <div className="divide-y divide-cti-border">
            {feeds.map((f) => (
              <div key={f.id} className="grid grid-cols-[1fr_auto_auto_auto_auto] gap-3 px-5 py-2.5 items-center">
                <div className="min-w-0">
                  <span className="text-sm text-gray-200 truncate">{f.source_name}</span>
                  <span className="text-[10px] text-gray-600 ml-2">{f.feed_type}</span>
                </div>
                <div className="flex items-center gap-1">
                  <input type="number" min="1" value={f.interval_minutes}
                    onChange={(e) => setFeeds((fs) => fs.map((x) => x.id === f.id ? { ...x, interval_minutes: e.target.value } : x))}
                    onBlur={(e) => patch(f.id, { interval_minutes: Number(e.target.value) })}
                    className="w-16 bg-cti-bg border border-cti-border rounded px-2 py-1 text-xs text-gray-200 focus:outline-none focus:border-cti-green/50" />
                  <span className="text-[10px] text-gray-600">min</span>
                </div>
                <input type="number" min="1" max="9" value={f.priority}
                  onChange={(e) => setFeeds((fs) => fs.map((x) => x.id === f.id ? { ...x, priority: e.target.value } : x))}
                  onBlur={(e) => patch(f.id, { priority: Number(e.target.value) })}
                  className="w-12 bg-cti-bg border border-cti-border rounded px-2 py-1 text-xs text-gray-200 focus:outline-none focus:border-cti-green/50" />
                <span className="text-[10px] text-gray-500 w-28">
                  {f.last_polled ? `${f.last_polled.slice(5, 16).replace("T", " ")} (${f.last_count})` : "never"}
                </span>
                <button onClick={() => patch(f.id, { enabled: !f.enabled })}>
                  {f.enabled ? <ToggleRight size={20} className="text-cti-green" /> : <ToggleLeft size={20} className="text-gray-500" />}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Community plugins (#30) */}
      <div className="bg-cti-surface border border-cti-border rounded-xl overflow-hidden">
        <div className="px-5 py-3 border-b border-cti-border text-xs font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-2">
          <Puzzle size={13} className="text-cti-blue" /> Feed Plugins ({plugins.length})
        </div>
        <div className="px-5 py-2 text-[11px] text-gray-600">
          Auto-discovered from <code className="text-cti-amber">backend/feeds/plugins/</code>. Drop in a FeedPlugin subclass to add a source, no core changes.
        </div>
        {plugins.length === 0 ? (
          <div className="p-6 text-center text-gray-600 text-sm">No plugins discovered.</div>
        ) : (
          <div className="divide-y divide-cti-border">
            {plugins.map((p) => (
              <div key={p.name} className="px-5 py-2.5 flex items-center gap-3">
                <Puzzle size={13} className="text-gray-500" />
                <span className="text-sm text-gray-200 flex-1">{p.name}</span>
                <span className="text-[10px] text-gray-600">{p.feed_type}</span>
                <button onClick={() => runPlugin(p.name)}
                  className="px-3 py-1 rounded-lg bg-cti-blue/10 text-cti-blue border border-cti-blue/20 text-xs hover:bg-cti-blue/20">
                  Run
                </button>
              </div>
            ))}
          </div>
        )}
        {pluginMsg && <p className="px-5 py-2 text-[11px] text-cti-amber">{pluginMsg}</p>}
      </div>
    </div>
  );
}
