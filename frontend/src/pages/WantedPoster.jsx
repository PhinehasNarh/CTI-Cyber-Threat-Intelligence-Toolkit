import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { getActor } from "../api/client";
import { ChevronLeft, Printer, Crosshair, Globe, Target, ShieldAlert } from "lucide-react";

export default function WantedPoster() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [actor, setActor] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getActor(id).then(setActor).finally(() => setLoading(false));
  }, [id]);

  if (loading) return <div className="min-h-screen bg-cti-bg flex items-center justify-center text-gray-500 text-sm">Loading…</div>;
  if (!actor) return <div className="min-h-screen bg-cti-bg flex items-center justify-center text-gray-500 text-sm">Actor not found.</div>;

  const generated = new Date().toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });

  return (
    <div className="min-h-screen bg-cti-bg p-6">
      {/* Toolbar (hidden when printing) */}
      <div className="max-w-3xl mx-auto flex items-center justify-between mb-5 print:hidden">
        <button onClick={() => navigate("/actors")}
          className="flex items-center gap-1 text-sm text-gray-400 hover:text-gray-200">
          <ChevronLeft size={16} /> Back to actors
        </button>
        <button onClick={() => window.print()}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-cti-green/10 text-cti-green border border-cti-green/20 hover:bg-cti-green/20 transition-colors text-sm">
          <Printer size={15} /> Print / Save PDF
        </button>
      </div>

      {/* Poster */}
      <div className="max-w-3xl mx-auto bg-gradient-to-b from-[#11111a] to-[#0a0a0f] border-2 border-cti-border rounded-2xl overflow-hidden print:border-black print:bg-white">
        <div className="bg-gradient-to-r from-red-900/40 to-cti-surface border-b-2 border-red-500/30 px-8 py-6 text-center">
          <div className="flex items-center justify-center gap-2 text-red-400 mb-2">
            <ShieldAlert size={18} />
            <span className="text-xs tracking-[6px] uppercase">Threat Actor Brief</span>
            <ShieldAlert size={18} />
          </div>
          <h1 className="font-display text-5xl font-black text-white tracking-tight">{actor.name}</h1>
          {actor.aliases?.length > 0 && (
            <p className="text-sm text-gray-400 mt-2">a.k.a. {actor.aliases.join(" · ")}</p>
          )}
        </div>

        <div className="p-8 space-y-6">
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-cti-surface/60 border border-cti-border rounded-xl p-4 text-center">
              <Globe size={18} className="text-cti-blue mx-auto mb-2" />
              <div className="text-[10px] text-gray-500 uppercase tracking-wider">Origin</div>
              <div className="text-sm text-gray-100 mt-1">{actor.origin_country || "Unknown"}</div>
            </div>
            <div className="bg-cti-surface/60 border border-cti-border rounded-xl p-4 text-center">
              <Crosshair size={18} className="text-cti-pink mx-auto mb-2" />
              <div className="text-[10px] text-gray-500 uppercase tracking-wider">Motivation</div>
              <div className="text-sm text-gray-100 mt-1">{actor.motivation || "Unknown"}</div>
            </div>
            <div className="bg-cti-surface/60 border border-cti-border rounded-xl p-4 text-center">
              <Target size={18} className="text-cti-amber mx-auto mb-2" />
              <div className="text-[10px] text-gray-500 uppercase tracking-wider">Confidence</div>
              <div className="text-sm text-gray-100 mt-1">{actor.confidence}%</div>
            </div>
          </div>

          {actor.description && (
            <div>
              <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-2">Profile</div>
              <p className="text-sm text-gray-300 leading-relaxed">{actor.description}</p>
            </div>
          )}

          {actor.attack_tags?.length > 0 && (
            <div>
              <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-2">ATT&CK Techniques</div>
              <div className="flex flex-wrap gap-2">
                {actor.attack_tags.map((t) => (
                  <span key={t} className="text-xs px-2.5 py-1 rounded-lg bg-cti-purple/10 border border-cti-purple/30 text-cti-purple font-mono">{t}</span>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-6">
            <div>
              <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-2">
                Associated IOCs ({actor.related_iocs?.length ?? 0})
              </div>
              <div className="space-y-1.5">
                {(actor.related_iocs || []).slice(0, 8).map((i) => (
                  <div key={i.id} className="flex items-center gap-2 text-xs">
                    <span className="text-gray-600 w-10">{i.ioc_type}</span>
                    <span className="font-mono text-gray-300 truncate">{i.value}</span>
                  </div>
                ))}
                {(!actor.related_iocs || actor.related_iocs.length === 0) && (
                  <span className="text-xs text-gray-600">None linked yet.</span>
                )}
              </div>
            </div>
            <div>
              <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-2">
                Recent Reporting ({actor.related_articles?.length ?? 0})
              </div>
              <div className="space-y-1.5">
                {(actor.related_articles || []).slice(0, 6).map((a) => (
                  <div key={a.id} className="text-xs text-gray-300 truncate">{a.title}</div>
                ))}
                {(!actor.related_articles || actor.related_articles.length === 0) && (
                  <span className="text-xs text-gray-600">No matching articles.</span>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="px-8 py-4 border-t border-cti-border text-center text-[10px] text-gray-600 uppercase tracking-wider">
          CTI Platform · Generated {generated} · Confidence {actor.confidence}%
        </div>
      </div>
    </div>
  );
}
