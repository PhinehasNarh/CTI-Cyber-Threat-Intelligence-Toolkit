import { useEffect, useState } from "react";
import { Target, TrendingUp, RefreshCw } from "lucide-react";
import { getAttackHeatmap } from "../api/client";

const TACTIC_COLORS = {
  "Reconnaissance":         "#6b7280",
  "Resource Development":   "#8b5cf6",
  "Initial Access":         "#ef4444",
  "Execution":              "#f97316",
  "Persistence":            "#eab308",
  "Privilege Escalation":   "#84cc16",
  "Defense Evasion":        "#06b6d4",
  "Credential Access":      "#3b82f6",
  "Discovery":              "#a78bfa",
  "Lateral Movement":       "#f472b6",
  "Collection":             "#34d399",
  "Command and Control":    "#fb923c",
  "Exfiltration":           "#e879f9",
  "Impact":                 "#f87171",
};

function heatColor(count, max) {
  if (count === 0) return { bg: "transparent", border: "#ffffff0a", text: "#374151" };
  const intensity = Math.min(count / Math.max(max, 1), 1);
  if (intensity > 0.66) return { bg: "#ef444422", border: "#ef444455", text: "#fca5a5" };
  if (intensity > 0.33) return { bg: "#f9731622", border: "#f9731655", text: "#fdba74" };
  return { bg: "#fbbf2415", border: "#fbbf2440", text: "#fde68a" };
}

function TechniqueCell({ technique, maxCount }) {
  const { bg, border, text } = heatColor(technique.count, maxCount);
  return (
    <div
      className="rounded px-2 py-1.5 border text-[10px] leading-tight transition-all cursor-default"
      style={{ background: bg, borderColor: border }}
      title={`${technique.id}: ${technique.name} — ${technique.count} hit${technique.count !== 1 ? "s" : ""}`}
    >
      <div className="font-mono" style={{ color: text, opacity: technique.count ? 1 : 0.3 }}>
        {technique.id}
      </div>
      <div className="text-gray-500 truncate max-w-[110px]" title={technique.name}>
        {technique.name}
      </div>
      {technique.count > 0 && (
        <div className="mt-0.5 font-bold" style={{ color: text }}>
          {technique.count}
        </div>
      )}
    </div>
  );
}

export default function ATTACKHeatmap() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    setLoading(true);
    try {
      setData(await getAttackHeatmap());
    } catch (err) {
      console.error("ATT&CK heatmap fetch failed:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  if (loading) {
    return <div className="flex items-center justify-center h-64 text-gray-500">Loading ATT&CK heatmap…</div>;
  }
  if (!data) return null;

  const maxCount = Math.max(
    1,
    ...data.tactics.flatMap((t) => t.techniques.map((tech) => tech.count))
  );

  return (
    <div className="max-w-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display text-2xl font-bold text-white flex items-center gap-2">
            <Target size={22} className="text-cti-amber" />
            MITRE ATT&CK Heatmap
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Techniques auto-detected across ingested articles and IOCs
          </p>
        </div>
        <button
          onClick={fetchData}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-cti-amber/10 text-cti-amber border border-cti-amber/20 hover:bg-cti-amber/20 transition-colors text-sm"
        >
          <RefreshCw size={16} /> Refresh
        </button>
      </div>

      {/* Summary bar */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-cti-surface rounded-xl border border-cti-border p-4 text-center">
          <div className="text-2xl font-display font-bold text-cti-amber">{data.total_hits}</div>
          <div className="text-xs text-gray-500 mt-1">Total Technique Hits</div>
        </div>
        <div className="bg-cti-surface rounded-xl border border-cti-border p-4 text-center">
          <div className="text-2xl font-display font-bold text-cti-blue">{data.unique_techniques}</div>
          <div className="text-xs text-gray-500 mt-1">Unique Techniques Seen</div>
        </div>
        <div className="bg-cti-surface rounded-xl border border-cti-border p-4 text-center">
          <div className="text-2xl font-display font-bold text-cti-green">
            {data.tactics.filter((t) => t.total > 0).length}
          </div>
          <div className="text-xs text-gray-500 mt-1">Active Tactics</div>
        </div>
      </div>

      {/* Top techniques */}
      {data.top_techniques.length > 0 && (
        <div className="bg-cti-surface rounded-xl border border-cti-border p-4 mb-6">
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2">
            <TrendingUp size={13} /> Top Techniques
          </h3>
          <div className="flex flex-wrap gap-2">
            {data.top_techniques.map((t) => (
              <div
                key={t.id}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-cti-bg border border-cti-border"
              >
                <span className="font-mono text-[10px] text-cti-amber">{t.id}</span>
                <span className="text-xs text-gray-300">{t.name}</span>
                <span className="text-[10px] text-gray-500">{t.tactic}</span>
                <span className="text-xs font-bold text-red-400 ml-1">{t.count}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Heatmap grid */}
      <div className="overflow-x-auto">
        <div className="flex gap-3 min-w-max pb-4">
          {data.tactics.map((tactic) => {
            const color = TACTIC_COLORS[tactic.tactic_name] || "#6b7280";
            return (
              <div key={tactic.tactic_id} className="w-[140px] shrink-0">
                {/* Tactic header */}
                <div
                  className="rounded-lg px-2 py-2 mb-2 border text-center"
                  style={{
                    background: color + "15",
                    borderColor: color + "40",
                  }}
                >
                  <div
                    className="text-[9px] font-bold uppercase tracking-wider leading-tight"
                    style={{ color }}
                  >
                    {tactic.tactic_name}
                  </div>
                  {tactic.total > 0 && (
                    <div className="text-xs font-bold mt-0.5" style={{ color }}>
                      {tactic.total}
                    </div>
                  )}
                </div>
                {/* Technique cells */}
                <div className="flex flex-col gap-1">
                  {tactic.techniques.map((tech) => (
                    <TechniqueCell key={tech.id} technique={tech} maxCount={maxCount} />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {data.total_hits === 0 && (
        <div className="mt-4 text-center text-gray-500 text-sm">
          No ATT&CK techniques detected yet. Poll the RSS and IOC feeds to populate the heatmap.
        </div>
      )}
    </div>
  );
}
