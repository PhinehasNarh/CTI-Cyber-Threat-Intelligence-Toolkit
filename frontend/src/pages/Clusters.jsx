import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { getClusters } from "../api/client";
import { Boxes, ChevronDown, ChevronRight, BookOpen, RefreshCw } from "lucide-react";

export default function Clusters() {
  const [data, setData] = useState({ clusters: [], article_count: 0 });
  const [loading, setLoading] = useState(true);
  const [threshold, setThreshold] = useState(0.16);
  const [open, setOpen] = useState({});

  const load = useCallback(async () => {
    setLoading(true);
    try { setData(await getClusters({ limit: 300, threshold })); }
    finally { setLoading(false); }
  }, [threshold]);

  useEffect(() => { load(); }, [load]);

  const clusters = data.clusters || [];
  const maxSize = clusters.length > 0 ? clusters[0].size : 1;

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Boxes size={22} className="text-cti-green" />
          <h1 className="text-xl font-semibold text-gray-100">Article Clusters</h1>
          <span className="text-xs text-gray-500 bg-cti-surface border border-cti-border px-2 py-0.5 rounded-full">
            {clusters.length} themes · {data.article_count} articles
          </span>
        </div>
        <div className="flex items-center gap-3">
          <label className="text-xs text-gray-500 flex items-center gap-2">
            Granularity
            <input type="range" min="0.08" max="0.4" step="0.02" value={threshold}
              onChange={(e) => setThreshold(Number(e.target.value))} className="accent-cti-green" />
          </label>
          <button onClick={load}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cti-purple/10 text-cti-purple border border-cti-purple/20 hover:bg-cti-purple/20 text-xs">
            <RefreshCw size={13} className={loading ? "animate-spin" : ""} /> Recluster
          </button>
        </div>
      </div>

      <p className="text-xs text-gray-500">
        Articles grouped by content similarity (offline TF-IDF). Higher granularity = tighter, more numerous clusters.
      </p>

      {loading ? (
        <div className="p-8 text-center text-gray-500 text-sm">Clustering…</div>
      ) : clusters.length === 0 ? (
        <div className="bg-cti-surface border border-cti-border rounded-xl p-12 text-center text-gray-500 text-sm">
          No articles to cluster. Poll the news feeds first.
        </div>
      ) : (
        <div className="space-y-3">
          {clusters.map((c, idx) => {
            const isOpen = open[idx];
            return (
              <div key={idx} className="bg-cti-surface border border-cti-border rounded-xl overflow-hidden">
                <button onClick={() => setOpen((o) => ({ ...o, [idx]: !o[idx] }))}
                  className="w-full px-5 py-3.5 flex items-center gap-3 text-left hover:bg-white/[0.02]">
                  {isOpen ? <ChevronDown size={16} className="text-gray-500" /> : <ChevronRight size={16} className="text-gray-500" />}
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap gap-1.5 mb-1">
                      {c.top_terms.map((t) => (
                        <span key={t} className="text-[10px] px-1.5 py-0.5 rounded bg-cti-green/10 border border-cti-green/20 text-cti-green">{t}</span>
                      ))}
                    </div>
                    <div className="h-1.5 rounded-full bg-cti-bg overflow-hidden w-full max-w-xs">
                      <div className="h-full rounded-full bg-cti-green/60" style={{ width: `${(c.size / maxSize) * 100}%` }} />
                    </div>
                  </div>
                  <span className="text-sm font-display font-bold text-gray-300 flex-shrink-0">{c.size}</span>
                </button>
                {isOpen && (
                  <div className="border-t border-cti-border divide-y divide-cti-border">
                    {c.articles.map((a) => (
                      <div key={a.id} className="px-5 py-2.5 flex items-center gap-3">
                        <span className="text-xs text-gray-300 truncate flex-1">{a.title}</span>
                        <span className="text-[10px] text-cti-blue flex-shrink-0">{a.source}</span>
                        <Link to={`/read/${a.id}`} className="text-gray-600 hover:text-cti-green flex-shrink-0"><BookOpen size={13} /></Link>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
