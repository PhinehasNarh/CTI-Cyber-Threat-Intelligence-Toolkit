import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Search,
  Star,
  ExternalLink,
  RefreshCw,
  Filter,
  BookOpen,
} from "lucide-react";
import { getArticles, getSources, updateArticle, pollFeeds } from "../api/client";

export default function NewsFeed() {
  const [articles, setArticles] = useState([]);
  const [sources, setSources] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [sourceFilter, setSourceFilter] = useState("");
  const [polling, setPolling] = useState(false);

  const fetchArticles = async () => {
    try {
      const params = {};
      if (search) params.search = search;
      if (sourceFilter) params.source = sourceFilter;
      params.limit = "100";
      const data = await getArticles(params);
      setArticles(data.articles);
    } catch (err) {
      console.error("Failed to load articles:", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchSources = async () => {
    try {
      const data = await getSources();
      setSources(data.sources);
    } catch (err) {
      console.error("Failed to load sources:", err);
    }
  };

  useEffect(() => {
    fetchArticles();
    fetchSources();
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => fetchArticles(), 300);
    return () => clearTimeout(timer);
  }, [search, sourceFilter]);

  const handleStar = async (id, currentStarred) => {
    await updateArticle(id, { is_starred: !currentStarred });
    setArticles((prev) =>
      prev.map((a) =>
        a.id === id ? { ...a, is_starred: !currentStarred } : a
      )
    );
  };

  const handleMarkRead = async (id) => {
    await updateArticle(id, { is_read: true });
    setArticles((prev) =>
      prev.map((a) => (a.id === id ? { ...a, is_read: true } : a))
    );
  };

  const handlePoll = async () => {
    setPolling(true);
    try {
      await pollFeeds();
      await fetchArticles();
    } finally {
      setPolling(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500">
        Loading articles...
      </div>
    );
  }

  return (
    <div className="max-w-4xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display text-2xl font-bold text-white">
            News Feed
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Security news from {sources.length} sources
          </p>
        </div>
        <button
          onClick={handlePoll}
          disabled={polling}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-cti-green/10 text-cti-green border border-cti-green/20 hover:bg-cti-green/20 transition-colors text-sm disabled:opacity-50"
        >
          <RefreshCw size={16} className={polling ? "animate-spin" : ""} />
          {polling ? "Polling..." : "Refresh"}
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-4">
        <div className="flex-1 relative">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500"
          />
          <input
            type="text"
            placeholder="Search articles..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-cti-surface border border-cti-border text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-cti-blue/40"
          />
        </div>
        <div className="relative">
          <Filter
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500"
          />
          <select
            value={sourceFilter}
            onChange={(e) => setSourceFilter(e.target.value)}
            className="pl-10 pr-8 py-2.5 rounded-lg bg-cti-surface border border-cti-border text-sm text-gray-200 focus:outline-none focus:border-cti-blue/40 appearance-none cursor-pointer"
          >
            <option value="">All Sources</option>
            {sources.map((s) => (
              <option key={s.name} value={s.name}>
                {s.name} ({s.count})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Article List */}
      <div className="bg-cti-surface rounded-xl border border-cti-border divide-y divide-cti-border">
        {articles.map((article) => (
          <div
            key={article.id}
            className={`px-4 py-3 hover:bg-white/[0.02] transition-colors ${
              article.is_read ? "opacity-60" : ""
            }`}
          >
            <div className="flex items-start gap-3">
              {/* Star button */}
              <button
                onClick={() => handleStar(article.id, article.is_starred)}
                className="mt-0.5 flex-shrink-0"
              >
                <Star
                  size={16}
                  className={
                    article.is_starred
                      ? "fill-cti-amber text-cti-amber"
                      : "text-gray-600 hover:text-gray-400"
                  }
                />
              </button>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <a
                  href={article.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => handleMarkRead(article.id)}
                  className="text-sm text-gray-200 hover:text-cti-blue transition-colors flex items-center gap-1.5"
                >
                  <span className="truncate">{article.title}</span>
                  <ExternalLink size={12} className="flex-shrink-0 opacity-40" />
                </a>
                <div className="flex items-center gap-3 mt-1.5">
                  <span className="text-xs text-cti-blue font-medium">
                    {article.source}
                  </span>
                  {article.published && (
                    <span className="text-xs text-gray-600">
                      {new Date(article.published).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </span>
                  )}
                  {article.categories?.length > 0 && (
                    <div className="flex gap-1">
                      {article.categories.slice(0, 3).map((cat, i) => (
                        <span
                          key={i}
                          className="text-[10px] px-1.5 py-0.5 rounded bg-cti-purple/10 text-cti-purple"
                        >
                          {cat}
                        </span>
                      ))}
                    </div>
                  )}
                  <Link
                    to={`/read/${article.id}`}
                    className="ml-auto flex items-center gap-1 text-[11px] text-gray-500 hover:text-cti-green transition-colors"
                  >
                    <BookOpen size={12} /> Reader
                  </Link>
                </div>
                {article.summary && (
                  <p className="text-xs text-gray-500 mt-1.5 line-clamp-2">
                    {article.summary}
                  </p>
                )}
              </div>
            </div>
          </div>
        ))}

        {articles.length === 0 && (
          <div className="p-12 text-center text-gray-500 text-sm">
            No articles found. Try polling feeds or adjusting your filters.
          </div>
        )}
      </div>
    </div>
  );
}
