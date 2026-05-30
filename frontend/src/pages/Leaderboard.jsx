import { useState, useEffect, useCallback } from "react";
import { getLeaderboard } from "../api/client";
import { Trophy, Medal, Award, Activity } from "lucide-react";

const WINDOWS = [
  { label: "This week", value: 7 },
  { label: "This month", value: 30 },
  { label: "All time", value: 0 },
];

const RANK_ICON = {
  1: { Icon: Trophy, color: "#fbbf24" },
  2: { Icon: Medal, color: "#cbd5e1" },
  3: { Icon: Award, color: "#d97706" },
};

function relativeTime(iso) {
  if (!iso) return "never";
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 3600) return `${Math.max(1, Math.floor(diff / 60))}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export default function Leaderboard() {
  const [data, setData] = useState({ leaderboard: [], scoring: {} });
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(7);

  const load = useCallback(async () => {
    setLoading(true);
    try { setData(await getLeaderboard(days || undefined)); }
    finally { setLoading(false); }
  }, [days]);

  useEffect(() => { load(); }, [load]);

  const board = data.leaderboard || [];
  const maxPoints = board.length > 0 ? board[0].points : 1;

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Trophy size={22} className="text-cti-amber" />
          <h1 className="text-xl font-semibold text-gray-100">Analyst Leaderboard</h1>
        </div>
        <div className="flex gap-1">
          {WINDOWS.map((w) => (
            <button key={w.value} onClick={() => setDays(w.value)}
              className={`px-3 py-1.5 rounded-lg text-xs border transition-colors ${
                days === w.value ? "bg-cti-amber/10 text-cti-amber border-cti-amber/20"
                  : "text-gray-500 border-transparent hover:text-gray-300"}`}>
              {w.label}
            </button>
          ))}
        </div>
      </div>

      <p className="text-xs text-gray-500">
        Points awarded per logged action: create {data.scoring?.create ?? 5} · update {data.scoring?.update ?? 3} · delete {data.scoring?.delete ?? 2}.
      </p>

      {loading ? (
        <div className="p-8 text-center text-gray-500 text-sm">Loading…</div>
      ) : board.length === 0 ? (
        <div className="bg-cti-surface border border-cti-border rounded-xl p-12 text-center text-gray-500 text-sm">
          No analyst activity recorded in this window yet. Curate actors, triage IOCs, or build alert rules to score points.
        </div>
      ) : (
        <div className="space-y-3">
          {board.map((e) => {
            const ri = RANK_ICON[e.rank];
            return (
              <div key={e.actor}
                className="bg-cti-surface border border-cti-border rounded-xl p-4 flex items-center gap-4">
                <div className="w-8 flex-shrink-0 flex items-center justify-center">
                  {ri ? <ri.Icon size={22} style={{ color: ri.color }} />
                    : <span className="text-sm font-display font-bold text-gray-500">#{e.rank}</span>}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-sm font-semibold text-gray-100">{e.actor}</span>
                    <span className="text-lg font-display font-bold text-cti-amber">{e.points} pts</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-cti-bg overflow-hidden mb-2">
                    <div className="h-full rounded-full bg-gradient-to-r from-cti-amber to-cti-green"
                      style={{ width: `${(e.points / maxPoints) * 100}%` }} />
                  </div>
                  <div className="flex items-center gap-3 text-[11px] text-gray-500 flex-wrap">
                    <span>{e.total_actions} actions</span>
                    {Object.entries(e.by_action).map(([a, c]) => (
                      <span key={a} className="text-gray-600">{a}: {c}</span>
                    ))}
                    <span className="flex items-center gap-1 ml-auto">
                      <Activity size={10} /> {relativeTime(e.last_active)}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
