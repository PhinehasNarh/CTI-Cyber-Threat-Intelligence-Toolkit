import { useEffect, useState } from "react";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { Clock } from "lucide-react";
import { getTimeline } from "../api/client";

const RANGE_OPTIONS = [
  { label: "7 days",  value: 7  },
  { label: "14 days", value: 14 },
  { label: "30 days", value: 30 },
  { label: "90 days", value: 90 },
];

const SOURCE_COLORS = [
  "#00ff87", "#00d4ff", "#a78bfa", "#f472b6", "#fbbf24",
  "#fb923c", "#34d399", "#e879f9", "#60a5fa", "#f87171",
];

const TYPE_COLORS = {
  hash: "#a78bfa",
  ip: "#00d4ff",
  domain: "#00ff87",
  url: "#f472b6",
  unknown: "#6b7280",
};

const CHART_STYLE = {
  background: "#111118",
  border: "1px solid #1a1a2e",
  borderRadius: 8,
  color: "#e0e0e0",
  fontSize: 12,
};

function shortDate(d, totalDays) {
  if (totalDays <= 14) return d.slice(5);         // MM-DD
  if (totalDays <= 31) return d.slice(5);
  return d.slice(5);                              // always MM-DD for x-axis space
}

function ChartCard({ title, children }) {
  return (
    <div className="bg-cti-surface rounded-xl border border-cti-border p-4">
      <h3 className="text-sm font-semibold text-gray-300 mb-4">{title}</h3>
      {children}
    </div>
  );
}

export default function ThreatTimeline() {
  const [days, setDays] = useState(30);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState("combined"); // combined | iocs | articles

  const fetchData = async (d) => {
    setLoading(true);
    try {
      setData(await getTimeline(d));
    } catch (err) {
      console.error("Timeline fetch failed:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(days); }, [days]);

  if (loading) {
    return <div className="flex items-center justify-center h-64 text-gray-500">Loading timeline…</div>;
  }
  if (!data) return null;

  // Build flat chart data — one object per date
  const chartData = data.dates.map((date, i) => {
    const row = {
      date,
      label: shortDate(date, days),
      iocs: data.ioc_total[i],
      articles: data.article_total[i],
    };
    Object.entries(data.ioc_by_source).forEach(([src, vals]) => {
      row[`ioc_${src}`] = vals[i];
    });
    Object.entries(data.article_by_source).forEach(([src, vals]) => {
      row[`art_${src}`] = vals[i];
    });
    Object.entries(data.ioc_by_type).forEach(([t, vals]) => {
      row[`type_${t}`] = vals[i];
    });
    return row;
  });

  const totalIOCs = data.ioc_total.reduce((a, b) => a + b, 0);
  const totalArticles = data.article_total.reduce((a, b) => a + b, 0);
  const peakDay = data.dates[
    data.ioc_total.reduce((maxIdx, v, i, arr) => (v > arr[maxIdx] ? i : maxIdx), 0)
  ];

  const iocSources = Object.keys(data.ioc_by_source);
  const artSources = Object.keys(data.article_by_source);
  const iocTypes = Object.keys(data.ioc_by_type);

  // Ticker interval for x-axis — avoid crowding
  const tickEvery = days <= 14 ? 1 : days <= 31 ? 3 : 7;

  return (
    <div className="max-w-6xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-white flex items-center gap-2">
            <Clock size={22} className="text-cti-blue" />
            Threat Timeline
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Ingestion volume over time — spot spikes and coordinated campaigns
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* View toggle */}
          <div className="flex gap-1">
            {[
              { key: "combined", label: "Combined" },
              { key: "iocs",     label: "IOCs" },
              { key: "articles", label: "Articles" },
            ].map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setView(key)}
                className={`px-3 py-1.5 rounded-lg text-xs border transition-colors ${
                  view === key
                    ? "bg-cti-blue/10 text-cti-blue border-cti-blue/20"
                    : "text-gray-500 border-transparent hover:text-gray-300"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          {/* Range selector */}
          <div className="flex gap-1">
            {RANGE_OPTIONS.map(({ label, value }) => (
              <button
                key={value}
                onClick={() => setDays(value)}
                className={`px-3 py-1.5 rounded-lg text-xs border transition-colors ${
                  days === value
                    ? "bg-cti-green/10 text-cti-green border-cti-green/20"
                    : "text-gray-500 border-transparent hover:text-gray-300"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Summary strip */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="bg-cti-surface rounded-xl border border-cti-border p-4 text-center">
          <div className="text-2xl font-display font-bold text-cti-green">{totalIOCs.toLocaleString()}</div>
          <div className="text-xs text-gray-500 mt-1">IOCs Ingested</div>
        </div>
        <div className="bg-cti-surface rounded-xl border border-cti-border p-4 text-center">
          <div className="text-2xl font-display font-bold text-cti-blue">{totalArticles.toLocaleString()}</div>
          <div className="text-xs text-gray-500 mt-1">Articles Fetched</div>
        </div>
        <div className="bg-cti-surface rounded-xl border border-cti-border p-4 text-center">
          <div className="text-sm font-display font-bold text-cti-amber font-mono">{peakDay}</div>
          <div className="text-xs text-gray-500 mt-1">Peak IOC Day</div>
        </div>
      </div>

      {/* Main combined chart */}
      {(view === "combined" || view === "iocs" || view === "articles") && (
        <ChartCard title={
          view === "combined" ? "IOCs & Articles Over Time"
          : view === "iocs" ? "IOC Ingestion Over Time"
          : "Article Ingestion Over Time"
        }>
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
              <defs>
                <linearGradient id="gIOC" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#00ff87" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#00ff87" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gArt" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#00d4ff" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#00d4ff" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1a1a2e" />
              <XAxis
                dataKey="label"
                tick={{ fill: "#555", fontSize: 10 }}
                interval={tickEvery - 1}
              />
              <YAxis tick={{ fill: "#555", fontSize: 10 }} />
              <Tooltip contentStyle={CHART_STYLE} labelFormatter={(l) => `Date: ${l}`} />
              <Legend wrapperStyle={{ fontSize: 11, color: "#999" }} />
              {(view === "combined" || view === "iocs") && (
                <Area
                  type="monotone"
                  dataKey="iocs"
                  name="IOCs"
                  stroke="#00ff87"
                  fill="url(#gIOC)"
                  strokeWidth={2}
                  dot={false}
                />
              )}
              {(view === "combined" || view === "articles") && (
                <Area
                  type="monotone"
                  dataKey="articles"
                  name="Articles"
                  stroke="#00d4ff"
                  fill="url(#gArt)"
                  strokeWidth={2}
                  dot={false}
                />
              )}
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
        {/* IOC by source */}
        {iocSources.length > 0 && view !== "articles" && (
          <ChartCard title="IOCs by Source">
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={chartData} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1a1a2e" />
                <XAxis dataKey="label" tick={{ fill: "#555", fontSize: 10 }} interval={tickEvery - 1} />
                <YAxis tick={{ fill: "#555", fontSize: 10 }} />
                <Tooltip contentStyle={CHART_STYLE} />
                <Legend wrapperStyle={{ fontSize: 10, color: "#999" }} />
                {iocSources.map((src, i) => (
                  <Bar
                    key={src}
                    dataKey={`ioc_${src}`}
                    name={src}
                    stackId="ioc"
                    fill={SOURCE_COLORS[i % SOURCE_COLORS.length]}
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        )}

        {/* IOC by type */}
        {iocTypes.length > 0 && view !== "articles" && (
          <ChartCard title="IOCs by Type">
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={chartData} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1a1a2e" />
                <XAxis dataKey="label" tick={{ fill: "#555", fontSize: 10 }} interval={tickEvery - 1} />
                <YAxis tick={{ fill: "#555", fontSize: 10 }} />
                <Tooltip contentStyle={CHART_STYLE} />
                <Legend wrapperStyle={{ fontSize: 10, color: "#999" }} />
                {iocTypes.map((t) => (
                  <Bar
                    key={t}
                    dataKey={`type_${t}`}
                    name={t}
                    stackId="type"
                    fill={TYPE_COLORS[t] || "#6b7280"}
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        )}

        {/* Articles by source */}
        {artSources.length > 0 && view !== "iocs" && (
          <ChartCard title="Articles by Source">
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={chartData} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1a1a2e" />
                <XAxis dataKey="label" tick={{ fill: "#555", fontSize: 10 }} interval={tickEvery - 1} />
                <YAxis tick={{ fill: "#555", fontSize: 10 }} />
                <Tooltip contentStyle={CHART_STYLE} />
                <Legend wrapperStyle={{ fontSize: 10, color: "#999" }} />
                {artSources.map((src, i) => (
                  <Bar
                    key={src}
                    dataKey={`art_${src}`}
                    name={src}
                    stackId="art"
                    fill={SOURCE_COLORS[i % SOURCE_COLORS.length]}
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        )}
      </div>

      {totalIOCs === 0 && totalArticles === 0 && (
        <div className="mt-8 text-center text-gray-500 text-sm">
          No data for this range. Poll the feeds to populate the timeline.
        </div>
      )}
    </div>
  );
}
