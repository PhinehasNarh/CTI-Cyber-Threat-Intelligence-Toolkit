import { useState, useEffect, useCallback } from "react";
import { getThreatMap } from "../api/client";
import { Globe, RefreshCw, AlertTriangle } from "lucide-react";

const W = 720, H = 360;

function project(lat, lon) {
  return { x: ((lon + 180) / 360) * W, y: ((90 - lat) / 180) * H };
}

function scoreColor(s) {
  if (s >= 75) return "#ef4444";
  if (s >= 50) return "#fb923c";
  if (s >= 25) return "#fbbf24";
  return "#00d4ff";
}

function flag(cc) {
  if (!cc || cc.length !== 2) return "";
  return String.fromCodePoint(...[...cc.toUpperCase()].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65));
}

export default function WorldMap() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try { setData(await getThreatMap(200)); } finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Globe size={22} className="text-cti-green" />
          <h1 className="text-xl font-semibold text-gray-100">World Threat Map</h1>
          {data && <span className="text-xs text-gray-500 bg-cti-surface border border-cti-border px-2 py-0.5 rounded-full">
            {data.point_count} located / {data.ips_total} IP IOCs
          </span>}
        </div>
        <button onClick={load}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-cti-purple/10 text-cti-purple border border-cti-purple/20 hover:bg-cti-purple/20 text-sm">
          <RefreshCw size={15} className={loading ? "animate-spin" : ""} /> Refresh
        </button>
      </div>

      {data && !data.available && (
        <div className="flex items-center gap-2 text-sm text-orange-400 bg-orange-400/5 border border-orange-400/20 rounded-lg p-4">
          <AlertTriangle size={16} /> Geolocation service (ip-api.com) was unreachable or rate-limited. Showing whatever resolved from cache.
        </div>
      )}

      {loading ? (
        <div className="p-8 text-center text-gray-500 text-sm">Geolocating IP indicators…</div>
      ) : !data || data.ips_total === 0 ? (
        <div className="bg-cti-surface border border-cti-border rounded-xl p-12 text-center text-gray-500 text-sm">
          No IP IOCs to plot. Poll the IOC feeds to collect IP indicators, then refresh.
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-5">
          <div className="lg:col-span-3 bg-cti-surface border border-cti-border rounded-xl p-3">
            <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
              <rect x="0" y="0" width={W} height={H} fill="#0a0a0f" rx="8" />
              {/* lat/lon grid */}
              {[...Array(7)].map((_, i) => (
                <line key={`h${i}`} x1="0" y1={(H / 6) * i} x2={W} y2={(H / 6) * i} stroke="#1c1c2a" strokeWidth="0.5" />
              ))}
              {[...Array(13)].map((_, i) => (
                <line key={`v${i}`} x1={(W / 12) * i} y1="0" x2={(W / 12) * i} y2={H} stroke="#1c1c2a" strokeWidth="0.5" />
              ))}
              <line x1="0" y1={H / 2} x2={W} y2={H / 2} stroke="#2a2a3a" strokeWidth="0.8" />
              {data.points.map((p, i) => {
                if (p.lat == null || p.lon == null) return null;
                const { x, y } = project(p.lat, p.lon);
                const c = scoreColor(p.score);
                return (
                  <g key={i}>
                    <circle cx={x} cy={y} r={4} fill={c} fillOpacity={0.85}>
                      <title>{`${p.ip}\n${p.city ? p.city + ", " : ""}${p.country}\nscore ${p.score} · ${p.isp || ""}`}</title>
                    </circle>
                    <circle cx={x} cy={y} r={4} fill="none" stroke={c} strokeOpacity={0.3} strokeWidth="4" />
                  </g>
                );
              })}
            </svg>
            <p className="text-[10px] text-gray-600 mt-1 text-center">Equirectangular projection · dot colour = threat score</p>
          </div>

          <div className="bg-cti-surface border border-cti-border rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-cti-border text-xs font-semibold text-gray-400 uppercase tracking-wider">
              By Country
            </div>
            {data.by_country.length === 0 ? (
              <div className="p-6 text-center text-gray-600 text-sm">None resolved.</div>
            ) : (
              <div className="divide-y divide-cti-border max-h-[360px] overflow-y-auto">
                {data.by_country.map((c) => (
                  <div key={c.country_code} className="px-4 py-2 flex items-center gap-2 text-sm">
                    <span>{flag(c.country_code)}</span>
                    <span className="text-gray-300 truncate flex-1">{c.country || c.country_code}</span>
                    <span className="text-gray-500">{c.count}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
