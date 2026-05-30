import { useState, useEffect } from "react";
import {
  AreaChart, Area, XAxis, ResponsiveContainer, Tooltip,
} from "recharts";
import { getDashboard, getTriageSummary } from "../api/client";
import { LayoutGrid, Plus, X, ChevronUp, ChevronDown } from "lucide-react";

const STORAGE_KEY = "cti-custom-dashboard";

// Each widget renders from the shared { dash, triage } data bundle.
const WIDGETS = {
  total_iocs: { title: "Total IOCs", render: (d) => <Stat value={d.dash?.stats?.total_iocs ?? 0} accent="#00ff87" /> },
  total_articles: { title: "Total Articles", render: (d) => <Stat value={d.dash?.stats?.total_articles ?? 0} accent="#00d4ff" /> },
  unread: { title: "Unread Articles", render: (d) => <Stat value={d.dash?.stats?.unread_articles ?? 0} accent="#fbbf24" /> },
  triage_open: { title: "Open Triage", render: (d) => <Stat value={d.triage?.open ?? 0} accent="#f472b6" /> },
  ioc_trend: {
    title: "IOC Trend (7d)", wide: true,
    render: (d) => (
      <ResponsiveContainer width="100%" height={120}>
        <AreaChart data={d.dash?.ioc_trend || []}>
          <defs>
            <linearGradient id="cd" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#00ff87" stopOpacity={0.5} />
              <stop offset="100%" stopColor="#00ff87" stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis dataKey="date" tick={{ fontSize: 9, fill: "#6b7280" }} tickFormatter={(v) => v.slice(5)} />
          <Tooltip contentStyle={{ background: "#11111a", border: "1px solid #2a2a3a", borderRadius: 8, fontSize: 12 }} />
          <Area type="monotone" dataKey="count" stroke="#00ff87" fill="url(#cd)" strokeWidth={1.5} />
        </AreaChart>
      </ResponsiveContainer>
    ),
  },
  ioc_by_type: {
    title: "IOCs by Type", wide: true,
    render: (d) => (
      <div className="flex flex-wrap gap-2">
        {Object.entries(d.dash?.ioc_by_type || {}).map(([t, c]) => (
          <span key={t} className="text-xs px-2.5 py-1 rounded-full bg-cti-bg border border-cti-border text-gray-300">{t}: {c}</span>
        ))}
        {Object.keys(d.dash?.ioc_by_type || {}).length === 0 && <span className="text-xs text-gray-600">no IOCs</span>}
      </div>
    ),
  },
  top_sources: {
    title: "Top Sources", wide: true,
    render: (d) => {
      const entries = Object.entries(d.dash?.articles_by_source || {}).slice(0, 6);
      return (
        <div className="space-y-1.5">
          {entries.map(([s, c]) => (
            <div key={s} className="flex items-center justify-between text-xs">
              <span className="text-gray-300">{s}</span><span className="text-gray-500">{c}</span>
            </div>
          ))}
          {entries.length === 0 && <span className="text-xs text-gray-600">no sources</span>}
        </div>
      );
    },
  },
};

function Stat({ value, accent }) {
  return <div className="text-3xl font-display font-bold" style={{ color: accent }}>{value}</div>;
}

const DEFAULT_LAYOUT = ["total_iocs", "total_articles", "triage_open", "ioc_trend"];

function loadLayout() {
  try {
    const v = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return Array.isArray(v) ? v.filter((k) => WIDGETS[k]) : DEFAULT_LAYOUT;
  } catch { return DEFAULT_LAYOUT; }
}

export default function CustomDashboard() {
  const [layout, setLayout] = useState(loadLayout);
  const [data, setData] = useState({ dash: null, triage: null });
  const [loading, setLoading] = useState(true);
  const [palette, setPalette] = useState(false);

  useEffect(() => { localStorage.setItem(STORAGE_KEY, JSON.stringify(layout)); }, [layout]);

  useEffect(() => {
    Promise.all([getDashboard(), getTriageSummary()])
      .then(([dash, triage]) => setData({ dash, triage }))
      .finally(() => setLoading(false));
  }, []);

  const add = (key) => { setLayout((l) => [...l, key]); setPalette(false); };
  const remove = (idx) => setLayout((l) => l.filter((_, i) => i !== idx));
  const move = (idx, dir) => setLayout((l) => {
    const j = idx + dir;
    if (j < 0 || j >= l.length) return l;
    const copy = [...l];
    [copy[idx], copy[j]] = [copy[j], copy[idx]];
    return copy;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <LayoutGrid size={22} className="text-cti-green" />
          <h1 className="text-xl font-semibold text-gray-100">My Dashboard</h1>
        </div>
        <div className="relative">
          <button onClick={() => setPalette((v) => !v)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-cti-green/10 text-cti-green border border-cti-green/20 hover:bg-cti-green/20 transition-colors text-sm">
            <Plus size={15} /> Add Widget
          </button>
          {palette && (
            <div className="absolute right-0 mt-2 w-56 bg-cti-surface border border-cti-border rounded-xl shadow-xl z-10 overflow-hidden">
              {Object.entries(WIDGETS).map(([key, w]) => (
                <button key={key} onClick={() => add(key)}
                  className="w-full text-left px-4 py-2.5 text-sm text-gray-300 hover:bg-white/5 border-b border-cti-border last:border-0">
                  {w.title}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <p className="text-[11px] text-gray-600">Your layout is saved locally. Add, remove, and reorder widgets to build a personal view.</p>

      {loading ? (
        <div className="p-8 text-center text-gray-500 text-sm">Loading…</div>
      ) : layout.length === 0 ? (
        <div className="bg-cti-surface border border-cti-border rounded-xl p-12 text-center text-gray-500 text-sm">
          Empty dashboard. Use "Add Widget" to start building your view.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {layout.map((key, idx) => {
            const w = WIDGETS[key];
            if (!w) return null;
            return (
              <div key={`${key}-${idx}`}
                className={`bg-cti-surface border border-cti-border rounded-xl p-4 ${w.wide ? "md:col-span-2" : ""}`}>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[10px] text-gray-500 uppercase tracking-wider">{w.title}</span>
                  <div className="flex items-center gap-1 text-gray-600">
                    <button onClick={() => move(idx, -1)} className="hover:text-gray-300"><ChevronUp size={13} /></button>
                    <button onClick={() => move(idx, 1)} className="hover:text-gray-300"><ChevronDown size={13} /></button>
                    <button onClick={() => remove(idx)} className="hover:text-red-400"><X size={13} /></button>
                  </div>
                </div>
                {w.render(data)}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
