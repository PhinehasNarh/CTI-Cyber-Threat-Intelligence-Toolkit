import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import {
  AreaChart, Area, XAxis, YAxis, ResponsiveContainer, ReferenceLine, Tooltip,
} from "recharts";
import { getTimelapse } from "../api/client";
import { Clapperboard, Play, Pause, RotateCcw } from "lucide-react";

const TYPE_COLORS = { hash: "#a78bfa", ip: "#00d4ff", domain: "#00ff87", url: "#f472b6", unknown: "#666" };

export default function TimeLapse() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(90);
  const [frame, setFrame] = useState(0);
  const [playing, setPlaying] = useState(false);
  const timer = useRef(null);

  const load = useCallback(async () => {
    setLoading(true);
    setPlaying(false);
    try {
      const d = await getTimelapse(days);
      setData(d);
      setFrame(0);
    } finally { setLoading(false); }
  }, [days]);

  useEffect(() => { load(); }, [load]);

  const frames = data?.frames || [];

  // Cumulative series for the chart
  const series = useMemo(() => {
    let ci = 0, ca = 0;
    return frames.map((f) => {
      ci += f.iocs; ca += f.articles;
      return { date: f.date, iocs: ci, articles: ca };
    });
  }, [frames]);

  // Cumulative state up to current frame
  const cumulative = useMemo(() => {
    const acc = { iocs: 0, articles: 0, by_type: {} };
    for (let i = 0; i <= frame && i < frames.length; i++) {
      acc.iocs += frames[i].iocs;
      acc.articles += frames[i].articles;
      for (const [t, c] of Object.entries(frames[i].by_type || {})) {
        acc.by_type[t] = (acc.by_type[t] || 0) + c;
      }
    }
    return acc;
  }, [frame, frames]);

  // Playback loop
  useEffect(() => {
    if (!playing) return;
    timer.current = setInterval(() => {
      setFrame((f) => {
        if (f >= frames.length - 1) { setPlaying(false); return f; }
        return f + 1;
      });
    }, 120);
    return () => clearInterval(timer.current);
  }, [playing, frames.length]);

  const current = frames[frame];

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Clapperboard size={22} className="text-cti-green" />
          <h1 className="text-xl font-semibold text-gray-100">Time-Lapse Replay</h1>
        </div>
        <select value={days} onChange={(e) => setDays(Number(e.target.value))}
          className="px-3 py-1.5 rounded-lg bg-cti-surface border border-cti-border text-xs text-gray-300 focus:outline-none">
          <option value={30}>30 days</option>
          <option value={90}>90 days</option>
          <option value={180}>180 days</option>
        </select>
      </div>

      {loading || !data ? (
        <div className="p-8 text-center text-gray-500 text-sm">Loading replay…</div>
      ) : (
        <>
          {/* Current frame readout */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-cti-surface border border-cti-border rounded-lg p-4 text-center">
              <div className="text-2xl font-display font-bold text-cti-green">{cumulative.iocs}</div>
              <div className="text-[10px] text-gray-500 uppercase tracking-wider">IOCs collected</div>
            </div>
            <div className="bg-cti-surface border border-cti-border rounded-lg p-4 text-center">
              <div className="text-2xl font-display font-bold text-cti-blue">{cumulative.articles}</div>
              <div className="text-[10px] text-gray-500 uppercase tracking-wider">Articles</div>
            </div>
            <div className="bg-cti-surface border border-cti-border rounded-lg p-4 col-span-2">
              <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-2">By type</div>
              <div className="flex flex-wrap gap-2">
                {Object.keys(cumulative.by_type).length === 0
                  ? <span className="text-xs text-gray-600">none yet</span>
                  : Object.entries(cumulative.by_type).map(([t, c]) => (
                    <span key={t} className="text-xs px-2 py-0.5 rounded-full border"
                      style={{ color: TYPE_COLORS[t] || "#999", borderColor: (TYPE_COLORS[t] || "#999") + "44", background: (TYPE_COLORS[t] || "#999") + "11" }}>
                      {t}: {c}
                    </span>
                  ))}
              </div>
            </div>
          </div>

          {/* Growth chart with moving marker */}
          <div className="bg-cti-surface border border-cti-border rounded-xl p-4">
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={series} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <defs>
                  <linearGradient id="gIocs" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#00ff87" stopOpacity={0.5} />
                    <stop offset="100%" stopColor="#00ff87" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gArts" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#00d4ff" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="#00d4ff" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#6b7280" }} tickFormatter={(d) => d.slice(5)} minTickGap={40} />
                <YAxis tick={{ fontSize: 10, fill: "#6b7280" }} width={40} />
                <Tooltip contentStyle={{ background: "#11111a", border: "1px solid #2a2a3a", borderRadius: 8, fontSize: 12 }} />
                <Area type="monotone" dataKey="iocs" stroke="#00ff87" fill="url(#gIocs)" strokeWidth={1.5} />
                <Area type="monotone" dataKey="articles" stroke="#00d4ff" fill="url(#gArts)" strokeWidth={1.5} />
                {current && <ReferenceLine x={current.date} stroke="#fbbf24" strokeWidth={1.5} />}
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Transport controls */}
          <div className="bg-cti-surface border border-cti-border rounded-xl p-4 flex items-center gap-4">
            <button onClick={() => setPlaying((p) => !p)}
              className="flex items-center justify-center w-10 h-10 rounded-full bg-cti-green/15 text-cti-green border border-cti-green/30 hover:bg-cti-green/25">
              {playing ? <Pause size={18} /> : <Play size={18} />}
            </button>
            <button onClick={() => { setPlaying(false); setFrame(0); }}
              className="flex items-center justify-center w-9 h-9 rounded-full text-gray-400 border border-cti-border hover:text-gray-200">
              <RotateCcw size={15} />
            </button>
            <input type="range" min={0} max={Math.max(0, frames.length - 1)} value={frame}
              onChange={(e) => { setPlaying(false); setFrame(Number(e.target.value)); }}
              className="flex-1 accent-cti-green" />
            <span className="text-xs text-gray-400 font-mono w-24 text-right">{current?.date}</span>
          </div>
        </>
      )}
    </div>
  );
}
