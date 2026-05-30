import { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { readArticle, updateArticleParams, getArticleBrief } from "../api/client";
import { ChevronLeft, ExternalLink, Shield, ShieldCheck, Sparkles, Users, Building2, Target } from "lucide-react";

const TYPE_COLORS = { hash: "#a78bfa", ip: "#00d4ff", domain: "#00ff87", url: "#f472b6" };

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Split text into plain segments and highlighted IOC segments.
function highlight(text, iocs) {
  if (!text || iocs.length === 0) return [{ text }];
  const byValue = Object.fromEntries(iocs.map((i) => [i.value, i]));
  const pattern = new RegExp(
    "(" + iocs.map((i) => escapeRegExp(i.value)).sort((a, b) => b.length - a.length).join("|") + ")",
    "g"
  );
  return text.split(pattern).map((chunk) => (byValue[chunk] ? { text: chunk, ioc: byValue[chunk] } : { text: chunk }));
}

export default function Reader() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [article, setArticle] = useState(null);
  const [brief, setBrief] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  useEffect(() => {
    setLoading(true);
    setBrief(null);
    readArticle(id)
      .then((a) => {
        setArticle(a);
        if (!a.is_read) updateArticleParams(a.id, { is_read: true }).catch(() => {});
      })
      .catch((e) => setErr(e.message))
      .finally(() => setLoading(false));
    getArticleBrief(id).then(setBrief).catch(() => {});
  }, [id]);

  const segments = useMemo(
    () => (article ? highlight(article.summary || "", article.detected_iocs || []) : []),
    [article]
  );

  if (loading) return <div className="p-8 text-center text-gray-500 text-sm">Loading article…</div>;
  if (err) return <div className="p-8 text-center text-red-400 text-sm">{err}</div>;
  if (!article) return null;

  const iocs = article.detected_iocs || [];

  return (
    <div className="max-w-5xl mx-auto">
      <button onClick={() => navigate("/feed")}
        className="flex items-center gap-1 text-sm text-gray-400 hover:text-gray-200 mb-6">
        <ChevronLeft size={16} /> Back to feed
      </button>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Article column */}
        <article className="lg:col-span-2">
          <div className="flex items-center gap-3 mb-3 text-xs">
            <span className="text-cti-blue font-medium">{article.source}</span>
            {article.published && (
              <span className="text-gray-600">
                {new Date(article.published).toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" })}
              </span>
            )}
          </div>
          <h1 className="font-display text-3xl font-bold text-white leading-tight mb-5">{article.title}</h1>

          <a href={article.url} target="_blank" rel="noreferrer"
            className="inline-flex items-center gap-1.5 text-sm text-cti-green hover:underline mb-6">
            Read original <ExternalLink size={13} />
          </a>

          <div className="prose-invert text-[15px] leading-8 text-gray-300 whitespace-pre-wrap">
            {segments.map((seg, i) =>
              seg.ioc ? (
                <span key={i}
                  title={`${seg.ioc.ioc_type}${seg.ioc.known ? ` · known IOC (score ${seg.ioc.threat_score})` : " · not yet tracked"}`}
                  className="px-1 rounded font-mono text-[13px] cursor-help border-b border-dotted"
                  style={{
                    color: TYPE_COLORS[seg.ioc.ioc_type] || "#fff",
                    background: (TYPE_COLORS[seg.ioc.ioc_type] || "#fff") + "14",
                    borderColor: (TYPE_COLORS[seg.ioc.ioc_type] || "#fff") + "66",
                  }}>
                  {seg.text}
                </span>
              ) : (
                <span key={i}>{seg.text}</span>
              )
            )}
            {!article.summary && <span className="text-gray-600 italic">No summary text stored for this article. Open the original to read in full.</span>}
          </div>
        </article>

        {/* Sidebar */}
        <aside className="lg:col-span-1 space-y-5">
          {/* Quick Brief */}
          <div className="bg-cti-surface border border-cti-border rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-cti-border text-xs font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-2">
              <Sparkles size={13} className="text-cti-amber" /> Quick Brief
            </div>
            {!brief ? (
              <div className="p-4 text-xs text-gray-600">Analyzing…</div>
            ) : (
              <div className="p-4 space-y-3">
                <p className="text-xs text-gray-300 leading-relaxed">{brief.summary || "No summary text available."}</p>
                {brief.threat_actors?.length > 0 && (
                  <div>
                    <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-1 flex items-center gap-1"><Users size={10} /> Actors</div>
                    <div className="flex flex-wrap gap-1">
                      {brief.threat_actors.map((a) => (
                        <span key={a} className="text-[10px] px-1.5 py-0.5 rounded bg-cti-pink/10 border border-cti-pink/20 text-cti-pink">{a}</span>
                      ))}
                    </div>
                  </div>
                )}
                {brief.industries?.length > 0 && (
                  <div>
                    <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-1 flex items-center gap-1"><Building2 size={10} /> Targeted</div>
                    <div className="flex flex-wrap gap-1">
                      {brief.industries.map((i) => (
                        <span key={i} className="text-[10px] px-1.5 py-0.5 rounded bg-cti-blue/10 border border-cti-blue/20 text-cti-blue">{i}</span>
                      ))}
                    </div>
                  </div>
                )}
                {brief.attack_techniques?.length > 0 && (
                  <div>
                    <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-1 flex items-center gap-1"><Target size={10} /> ATT&CK</div>
                    <div className="flex flex-wrap gap-1">
                      {brief.attack_techniques.map((t) => (
                        <span key={t.id} title={`${t.name} · ${t.tactic}`} className="text-[10px] px-1.5 py-0.5 rounded bg-cti-purple/10 border border-cti-purple/20 text-cti-purple font-mono cursor-help">{t.id}</span>
                      ))}
                    </div>
                  </div>
                )}
                {brief.threat_actors?.length === 0 && brief.industries?.length === 0 && brief.attack_techniques?.length === 0 && (
                  <p className="text-[11px] text-gray-600">No actors, industries, or techniques detected.</p>
                )}
              </div>
            )}
          </div>

          {/* IOC list */}
          <div className="bg-cti-surface border border-cti-border rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-cti-border text-xs font-semibold text-gray-400 uppercase tracking-wider">
              Detected IOCs ({iocs.length})
            </div>
            {iocs.length > 0 ? (
              <div className="divide-y divide-cti-border max-h-[70vh] overflow-y-auto">
                {iocs.map((i, idx) => (
                  <div key={idx} className="px-4 py-2.5">
                    <div className="flex items-center gap-2">
                      {i.known
                        ? <ShieldCheck size={13} className="text-cti-green flex-shrink-0" />
                        : <Shield size={13} className="text-gray-600 flex-shrink-0" />}
                      <span className="text-[10px] px-1.5 py-0.5 rounded flex-shrink-0"
                        style={{ color: TYPE_COLORS[i.ioc_type] || "#999", background: (TYPE_COLORS[i.ioc_type] || "#999") + "14" }}>
                        {i.ioc_type}
                      </span>
                      {i.known && <span className="text-[10px] text-cti-amber ml-auto">{i.threat_score}</span>}
                    </div>
                    <div className="text-xs font-mono text-gray-300 break-all mt-1">{i.value}</div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-6 text-center text-gray-600 text-sm">No IOC-shaped tokens found in this article.</div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
