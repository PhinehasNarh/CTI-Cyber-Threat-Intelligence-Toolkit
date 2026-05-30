import { useState, useEffect, useCallback } from "react";
import { getDigest } from "../api/client";
import { FileText, Newspaper, Shield, Bell, Copy, Check, Bug } from "lucide-react";

const TYPE_COLORS = { hash: "#a78bfa", ip: "#00d4ff", domain: "#00ff87", url: "#f472b6", unknown: "#666" };
const SEV_COLORS = { critical: "#ef4444", high: "#fb923c", medium: "#fbbf24", low: "#6b7280" };

function Section({ icon: Icon, title, count, children }) {
  return (
    <div className="bg-cti-surface border border-cti-border rounded-xl overflow-hidden">
      <div className="px-5 py-3 border-b border-cti-border flex items-center gap-2">
        <Icon size={14} className="text-cti-green" />
        <span className="text-xs font-semibold text-gray-300 uppercase tracking-wider">{title}</span>
        {count != null && <span className="text-[10px] text-gray-500 ml-auto">{count}</span>}
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

export default function Digest() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(7);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try { setData(await getDigest(days)); } finally { setLoading(false); }
  }, [days]);

  useEffect(() => { load(); }, [load]);

  async function copyMarkdown() {
    if (!data?.markdown) return;
    await navigator.clipboard.writeText(data.markdown);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <FileText size={22} className="text-cti-green" />
          <h1 className="text-xl font-semibold text-gray-100">Threat Intelligence Digest</h1>
        </div>
        <div className="flex items-center gap-2">
          <select value={days} onChange={(e) => setDays(Number(e.target.value))}
            className="px-3 py-1.5 rounded-lg bg-cti-surface border border-cti-border text-xs text-gray-300 focus:outline-none">
            <option value={1}>Last 24h</option>
            <option value={7}>Last 7 days</option>
            <option value={30}>Last 30 days</option>
          </select>
          <button onClick={copyMarkdown}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cti-blue/10 text-cti-blue border border-cti-blue/20 hover:bg-cti-blue/20 text-xs">
            {copied ? <Check size={13} /> : <Copy size={13} />}
            {copied ? "Copied" : "Copy Markdown"}
          </button>
        </div>
      </div>

      {loading || !data ? (
        <div className="p-8 text-center text-gray-500 text-sm">Generating digest…</div>
      ) : (
        <>
          {/* Headline stats */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-cti-surface border border-cti-border rounded-lg p-4 text-center">
              <div className="text-2xl font-display font-bold text-cti-blue">{data.articles.total}</div>
              <div className="text-[10px] text-gray-500 uppercase tracking-wider">New Articles</div>
            </div>
            <div className="bg-cti-surface border border-cti-border rounded-lg p-4 text-center">
              <div className="text-2xl font-display font-bold text-cti-green">{data.iocs.total}</div>
              <div className="text-[10px] text-gray-500 uppercase tracking-wider">New IOCs</div>
            </div>
            <div className="bg-cti-surface border border-cti-border rounded-lg p-4 text-center">
              <div className="text-2xl font-display font-bold text-cti-amber">{data.alerts.total}</div>
              <div className="text-[10px] text-gray-500 uppercase tracking-wider">Alert Hits</div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <Section icon={Newspaper} title="Top Articles" count={data.articles.total}>
              {data.articles.top.length > 0 ? (
                <ul className="space-y-2.5">
                  {data.articles.top.map((a) => (
                    <li key={a.id}>
                      <a href={a.url} target="_blank" rel="noreferrer"
                        className="text-sm text-gray-200 hover:text-cti-blue line-clamp-2">{a.title}</a>
                      <div className="text-[10px] text-gray-600 mt-0.5">{a.source} · {a.published?.slice(0, 10)}</div>
                    </li>
                  ))}
                </ul>
              ) : <p className="text-sm text-gray-600">No articles in window.</p>}
            </Section>

            <Section icon={Shield} title="New IOCs by Type" count={data.iocs.total}>
              <div className="flex flex-wrap gap-2 mb-4">
                {Object.entries(data.iocs.by_type).map(([t, c]) => (
                  <span key={t} className="text-xs px-2.5 py-1 rounded-full border"
                    style={{ color: TYPE_COLORS[t] || "#666", borderColor: (TYPE_COLORS[t] || "#666") + "44", background: (TYPE_COLORS[t] || "#666") + "11" }}>
                    {t}: {c}
                  </span>
                ))}
                {Object.keys(data.iocs.by_type).length === 0 && <span className="text-sm text-gray-600">No new IOCs.</span>}
              </div>
              {data.iocs.top.length > 0 && (
                <ul className="space-y-1.5">
                  {data.iocs.top.map((i) => (
                    <li key={i.id} className="flex items-center gap-2 text-xs">
                      <span className="text-cti-amber w-8">{i.threat_score}</span>
                      <span className="font-mono text-gray-300 truncate flex-1">{i.value}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Section>

            <Section icon={Bug} title="Most Active Malware Families">
              {data.iocs.top_families.length > 0 ? (
                <ul className="space-y-2">
                  {data.iocs.top_families.map((f) => (
                    <li key={f.family} className="flex items-center justify-between text-sm">
                      <span className="text-cti-pink">{f.family}</span>
                      <span className="text-gray-500">{f.count}</span>
                    </li>
                  ))}
                </ul>
              ) : <p className="text-sm text-gray-600">No tagged families in window.</p>}
            </Section>

            <Section icon={Bell} title="Alert Activity" count={data.alerts.total}>
              {Object.keys(data.alerts.by_severity).length > 0 ? (
                <div className="space-y-2">
                  {Object.entries(data.alerts.by_severity).map(([s, c]) => (
                    <div key={s} className="flex items-center justify-between text-sm">
                      <span style={{ color: SEV_COLORS[s] || "#9ca3af" }}>{s}</span>
                      <span className="text-gray-400">{c}</span>
                    </div>
                  ))}
                </div>
              ) : <p className="text-sm text-gray-600">No alerts fired in window.</p>}
            </Section>
          </div>
        </>
      )}
    </div>
  );
}
