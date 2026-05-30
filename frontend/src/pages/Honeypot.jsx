import { useState, useEffect, useCallback } from "react";
import { getHoneypotHits, recordHoneypotHit } from "../api/client";
import { Flame, Send, RefreshCw } from "lucide-react";

export default function Honeypot() {
  const [hits, setHits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ source_ip: "", token: "", detail: "" });
  const [sending, setSending] = useState(false);
  const [err, setErr] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try { const r = await getHoneypotHits(); setHits(r.hits ?? []); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  async function submit(e) {
    e.preventDefault();
    setErr("");
    if (!form.source_ip.trim()) return;
    setSending(true);
    try {
      await recordHoneypotHit(form);
      setForm({ source_ip: "", token: "", detail: "" });
      await load();
    } catch (e) { setErr(e.message); } finally { setSending(false); }
  }

  const webhook = `${window.location.origin}/api/honeypot/hit`;

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Flame size={22} className="text-cti-green" />
          <h1 className="text-xl font-semibold text-gray-100">Honeypot Feed</h1>
          <span className="text-xs text-gray-500 bg-cti-surface border border-cti-border px-2 py-0.5 rounded-full">{hits.length} hits</span>
        </div>
        <button onClick={load} className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-gray-400 border border-cti-border hover:text-gray-200 text-xs">
          <RefreshCw size={13} className={loading ? "animate-spin" : ""} /> Refresh
        </button>
      </div>

      <div className="bg-cti-surface border border-cti-border rounded-xl p-4">
        <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Webhook endpoint</div>
        <code className="text-xs text-cti-amber break-all">POST {webhook}</code>
        <p className="text-[11px] text-gray-600 mt-1">
          Point a Canarytoken or low-interaction honeypot here. Body: {"{ source_ip, token?, detail? }"}. Each hit becomes a max-confidence IP IOC.
        </p>
      </div>

      <form onSubmit={submit} className="bg-cti-surface border border-cti-border rounded-xl p-5 flex flex-wrap items-end gap-3">
        <div className="text-xs text-gray-500 w-full">Simulate a hit (for testing):</div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Source IP *</label>
          <input value={form.source_ip} onChange={(e) => setForm({ ...form, source_ip: e.target.value })}
            placeholder="203.0.113.7"
            className="bg-cti-bg border border-cti-border rounded-lg px-3 py-2 text-sm font-mono text-gray-200 focus:outline-none focus:border-cti-green/50" />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Token</label>
          <input value={form.token} onChange={(e) => setForm({ ...form, token: e.target.value })}
            placeholder="web-canary-01"
            className="bg-cti-bg border border-cti-border rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-cti-green/50" />
        </div>
        <div className="flex-1 min-w-[160px]">
          <label className="block text-xs text-gray-500 mb-1">Detail</label>
          <input value={form.detail} onChange={(e) => setForm({ ...form, detail: e.target.value })}
            placeholder="hit on fake admin login"
            className="w-full bg-cti-bg border border-cti-border rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-cti-green/50" />
        </div>
        <button type="submit" disabled={sending}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-cti-green/20 border border-cti-green/40 text-cti-green text-sm font-medium hover:bg-cti-green/30 disabled:opacity-50">
          <Send size={14} /> {sending ? "Sending…" : "Fire"}
        </button>
        {err && <p className="text-xs text-red-400 w-full">{err}</p>}
      </form>

      <div className="bg-cti-surface border border-cti-border rounded-xl overflow-hidden">
        <div className="px-5 py-3 border-b border-cti-border text-xs font-semibold text-gray-400 uppercase tracking-wider">Recent Hits</div>
        {loading ? (
          <div className="p-8 text-center text-gray-500 text-sm">Loading…</div>
        ) : hits.length === 0 ? (
          <div className="p-10 text-center text-gray-500 text-sm">No honeypot hits yet. Fire a test hit above or point a canary at the webhook.</div>
        ) : (
          <div className="divide-y divide-cti-border">
            {hits.map((h) => (
              <div key={h.id} className="px-5 py-3 flex items-center gap-3">
                <Flame size={14} className="text-orange-400 flex-shrink-0" />
                <span className="text-sm font-mono text-gray-200 flex-1">{h.ip}</span>
                {h.detail?.token && <span className="text-[10px] px-1.5 py-0.5 rounded bg-cti-amber/10 border border-cti-amber/20 text-cti-amber">{h.detail.token}</span>}
                {h.seen_count > 1 && <span className="text-[10px] text-cti-amber">×{h.seen_count}</span>}
                <span className="text-[11px] text-gray-600 flex-shrink-0">{h.last_seen?.slice(0, 16).replace("T", " ")}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
