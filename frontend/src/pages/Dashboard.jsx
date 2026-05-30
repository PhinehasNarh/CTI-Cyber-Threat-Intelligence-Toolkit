import { useEffect, useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  CartesianGrid,
} from "recharts";
import { RefreshCw } from "lucide-react";
import StatCard from "../components/StatCard";
import { getDashboard, pollFeeds, pollIOCs } from "../api/client";

const COLORS = ["#00ff87", "#00d4ff", "#a78bfa", "#f472b6", "#fbbf24", "#fb923c"];

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [polling, setPolling] = useState(false);

  const fetchData = async () => {
    try {
      const d = await getDashboard();
      setData(d);
    } catch (err) {
      console.error("Failed to load dashboard:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handlePoll = async () => {
    setPolling(true);
    try {
      await Promise.all([pollFeeds(), pollIOCs()]);
      await fetchData();
    } catch (err) {
      console.error("Poll failed:", err);
    } finally {
      setPolling(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500">
        Loading dashboard...
      </div>
    );
  }

  if (!data) {
    return (
      <div className="text-center text-gray-500 mt-20">
        <p className="mb-4">Could not connect to the backend API.</p>
        <p className="text-sm">
          Make sure the FastAPI server is running on{" "}
          <code className="text-cti-green">localhost:8000</code>
        </p>
      </div>
    );
  }

  const { stats, recent_articles, ioc_by_type, articles_by_source, ioc_trend } = data;

  // Transform data for charts
  const iocTypeData = Object.entries(ioc_by_type).map(([name, value]) => ({
    name,
    value,
  }));

  const sourceData = Object.entries(articles_by_source)
    .slice(0, 8)
    .map(([name, count]) => ({ name: name.length > 15 ? name.slice(0, 15) + "..." : name, count }));

  return (
    <div className="max-w-6xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display text-2xl font-bold text-white">
            Threat Overview
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Real-time summary of collected intelligence
          </p>
        </div>
        <button
          onClick={handlePoll}
          disabled={polling}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-cti-green/10 text-cti-green border border-cti-green/20 hover:bg-cti-green/20 transition-colors text-sm disabled:opacity-50"
        >
          <RefreshCw size={16} className={polling ? "animate-spin" : ""} />
          {polling ? "Polling..." : "Poll Feeds Now"}
        </button>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
        <StatCard label="Total Articles" value={stats.total_articles} color="#00d4ff" />
        <StatCard label="Articles Today" value={stats.articles_today} color="#00ff87" />
        <StatCard label="Unread" value={stats.unread_articles} color="#fbbf24" />
        <StatCard label="Total IOCs" value={stats.total_iocs} color="#a78bfa" />
        <StatCard label="IOCs Today" value={stats.iocs_today} color="#f472b6" />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        {/* IOC Trend */}
        <div className="md:col-span-2 bg-cti-surface rounded-xl border border-cti-border p-4">
          <h3 className="text-sm font-semibold text-gray-300 mb-3">
            IOCs Collected (7 days)
          </h3>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={ioc_trend}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1a1a2e" />
              <XAxis
                dataKey="date"
                tick={{ fill: "#666", fontSize: 11 }}
                tickFormatter={(d) => d.slice(5)}
              />
              <YAxis tick={{ fill: "#666", fontSize: 11 }} />
              <Tooltip
                contentStyle={{
                  background: "#111118",
                  border: "1px solid #1a1a2e",
                  borderRadius: 8,
                  color: "#e0e0e0",
                  fontSize: 12,
                }}
              />
              <Line
                type="monotone"
                dataKey="count"
                stroke="#00ff87"
                strokeWidth={2}
                dot={{ fill: "#00ff87", r: 3 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* IOC Types Pie */}
        <div className="bg-cti-surface rounded-xl border border-cti-border p-4">
          <h3 className="text-sm font-semibold text-gray-300 mb-3">
            IOC Types
          </h3>
          {iocTypeData.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={iocTypeData}
                  cx="50%"
                  cy="50%"
                  innerRadius={40}
                  outerRadius={70}
                  dataKey="value"
                  label={({ name, value }) => `${name}: ${value}`}
                >
                  {iocTypeData.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    background: "#111118",
                    border: "1px solid #1a1a2e",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-[200px] text-gray-500 text-sm">
              No IOC data yet
            </div>
          )}
        </div>
      </div>

      {/* Articles by Source Bar Chart */}
      {sourceData.length > 0 && (
        <div className="bg-cti-surface rounded-xl border border-cti-border p-4 mb-6">
          <h3 className="text-sm font-semibold text-gray-300 mb-3">
            Articles by Source
          </h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={sourceData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1a1a2e" />
              <XAxis dataKey="name" tick={{ fill: "#666", fontSize: 10 }} angle={-20} textAnchor="end" height={50} />
              <YAxis tick={{ fill: "#666", fontSize: 11 }} />
              <Tooltip
                contentStyle={{
                  background: "#111118",
                  border: "1px solid #1a1a2e",
                  borderRadius: 8,
                  fontSize: 12,
                }}
              />
              <Bar dataKey="count" fill="#00d4ff" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Recent Articles */}
      <div className="bg-cti-surface rounded-xl border border-cti-border">
        <div className="p-4 border-b border-cti-border">
          <h3 className="text-sm font-semibold text-gray-300">
            Recent Articles
          </h3>
        </div>
        <div className="divide-y divide-cti-border">
          {recent_articles.map((article) => (
            <a
              key={article.id}
              href={article.url}
              target="_blank"
              rel="noopener noreferrer"
              className="block px-4 py-3 hover:bg-white/[0.02] transition-colors"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-200 truncate">
                    {article.title}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs text-cti-blue">
                      {article.source}
                    </span>
                    {article.published && (
                      <span className="text-xs text-gray-600">
                        {new Date(article.published).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </div>
                {article.categories?.length > 0 && (
                  <div className="flex gap-1 flex-shrink-0">
                    {article.categories.slice(0, 2).map((cat, i) => (
                      <span
                        key={i}
                        className="text-[10px] px-2 py-0.5 rounded-full bg-cti-purple/10 text-cti-purple border border-cti-purple/20"
                      >
                        {cat}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </a>
          ))}
          {recent_articles.length === 0 && (
            <div className="p-8 text-center text-gray-500 text-sm">
              No articles yet. Click "Poll Feeds Now" to fetch.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
