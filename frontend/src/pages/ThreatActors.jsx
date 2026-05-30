import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  getActors, getActor, createActor, deleteActor,
} from "../api/client";
import { Users, Plus, Trash2, Globe, Target, ChevronLeft, Shield, Newspaper, FileWarning } from "lucide-react";

const MOTIVATIONS = ["espionage", "financial", "hacktivism", "destruction", "unknown"];

const EMPTY_FORM = {
  name: "",
  aliases: "",
  description: "",
  origin_country: "",
  motivation: "espionage",
  confidence: 50,
  attack_tags: "",
};

function ConfidenceBar({ value }) {
  const color = value >= 75 ? "#00ff87" : value >= 50 ? "#fbbf24" : "#6b7280";
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-20 rounded-full bg-cti-bg overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${value}%`, background: color }} />
      </div>
      <span className="text-[10px] text-gray-500">{value}%</span>
    </div>
  );
}

function ActorDetail({ id, onBack, onDeleted }) {
  const [actor, setActor] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    getActor(id).then(setActor).finally(() => setLoading(false));
  }, [id]);

  if (loading) return <div className="p-8 text-center text-gray-500 text-sm">Loading…</div>;
  if (!actor) return null;

  return (
    <div className="space-y-6">
      <button onClick={onBack} className="flex items-center gap-1 text-sm text-gray-400 hover:text-gray-200">
        <ChevronLeft size={16} /> Back to actors
      </button>

      <div className="bg-cti-surface border border-cti-border rounded-xl p-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="font-display text-2xl font-bold text-white">{actor.name}</h1>
            {actor.aliases?.length > 0 && (
              <p className="text-sm text-gray-500 mt-1">aka {actor.aliases.join(", ")}</p>
            )}
          </div>
          <div className="flex items-center gap-3">
            <Link to={`/poster/${actor.id}`}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cti-amber/10 text-cti-amber border border-cti-amber/20 hover:bg-cti-amber/20 transition-colors text-xs">
              <FileWarning size={14} /> Wanted Poster
            </Link>
            <button
              onClick={async () => {
                if (!confirm(`Delete actor "${actor.name}"?`)) return;
                await deleteActor(actor.id);
                onDeleted();
              }}
              className="text-gray-600 hover:text-red-400 transition-colors"
            >
              <Trash2 size={16} />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-5">
          <div>
            <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Origin</div>
            <div className="text-sm text-gray-200 flex items-center gap-1.5">
              <Globe size={13} className="text-cti-blue" />{actor.origin_country || "Unknown"}
            </div>
          </div>
          <div>
            <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Motivation</div>
            <div className="text-sm text-gray-200">{actor.motivation || "Unknown"}</div>
          </div>
          <div>
            <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Confidence</div>
            <ConfidenceBar value={actor.confidence} />
          </div>
          <div>
            <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">ATT&CK</div>
            <div className="flex flex-wrap gap-1">
              {actor.attack_tags?.length > 0
                ? actor.attack_tags.map((t) => (
                    <span key={t} className="text-[10px] px-1.5 py-0.5 rounded bg-cti-purple/10 border border-cti-purple/20 text-cti-purple">{t}</span>
                  ))
                : <span className="text-xs text-gray-600">none</span>}
            </div>
          </div>
        </div>

        {actor.description && (
          <p className="text-sm text-gray-400 mt-5 leading-relaxed">{actor.description}</p>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-cti-surface border border-cti-border rounded-xl overflow-hidden">
          <div className="px-5 py-3 border-b border-cti-border text-xs font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-2">
            <Shield size={13} /> Related IOCs ({actor.related_iocs?.length ?? 0})
          </div>
          {actor.related_iocs?.length > 0 ? (
            <div className="divide-y divide-cti-border">
              {actor.related_iocs.map((i) => (
                <div key={i.id} className="px-5 py-2.5 flex items-center gap-3">
                  <span className="text-[10px] text-gray-500 w-12">{i.ioc_type}</span>
                  <span className="text-xs font-mono text-gray-300 truncate flex-1">{i.value}</span>
                  <span className="text-[10px] text-cti-amber">{i.threat_score}</span>
                </div>
              ))}
            </div>
          ) : <div className="p-6 text-center text-gray-600 text-sm">No matching IOCs</div>}
        </div>

        <div className="bg-cti-surface border border-cti-border rounded-xl overflow-hidden">
          <div className="px-5 py-3 border-b border-cti-border text-xs font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-2">
            <Newspaper size={13} /> Related Articles ({actor.related_articles?.length ?? 0})
          </div>
          {actor.related_articles?.length > 0 ? (
            <div className="divide-y divide-cti-border">
              {actor.related_articles.map((a) => (
                <div key={a.id} className="px-5 py-2.5">
                  <div className="text-xs text-gray-200 truncate">{a.title}</div>
                  <div className="text-[10px] text-gray-600 mt-0.5">{a.source} · {a.published?.slice(0, 10)}</div>
                </div>
              ))}
            </div>
          ) : <div className="p-6 text-center text-gray-600 text-sm">No matching articles</div>}
        </div>
      </div>
    </div>
  );
}

export default function ThreatActors() {
  const [actors, setActors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  async function load() {
    setLoading(true);
    try {
      const r = await getActors();
      setActors(r.actors ?? []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function handleCreate(e) {
    e.preventDefault();
    setErr("");
    setSaving(true);
    try {
      await createActor({
        ...form,
        confidence: Number(form.confidence),
        aliases: form.aliases ? form.aliases.split(",").map((s) => s.trim()).filter(Boolean) : [],
      });
      setForm(EMPTY_FORM);
      setShowForm(false);
      await load();
    } catch (e) {
      setErr(e.message);
    } finally {
      setSaving(false);
    }
  }

  if (selected) {
    return <ActorDetail id={selected} onBack={() => setSelected(null)}
      onDeleted={() => { setSelected(null); load(); }} />;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Users size={22} className="text-cti-green" />
          <h1 className="text-xl font-semibold text-gray-100">Threat Actors</h1>
          <span className="text-xs text-gray-500 bg-cti-surface border border-cti-border px-2 py-0.5 rounded-full">
            {actors.length} profiles
          </span>
        </div>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-cti-green/10 text-cti-green border border-cti-green/20 hover:bg-cti-green/20 transition-colors text-sm"
        >
          <Plus size={16} /> New Actor
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="bg-cti-surface border border-cti-border rounded-xl p-5 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Name *</label>
            <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="e.g. APT28"
              className="w-full bg-cti-bg border border-cti-border rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-cti-green/50" />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Aliases (comma-separated)</label>
            <input value={form.aliases} onChange={(e) => setForm({ ...form, aliases: e.target.value })}
              placeholder="Fancy Bear, Sofacy"
              className="w-full bg-cti-bg border border-cti-border rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-cti-green/50" />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Origin country</label>
            <input value={form.origin_country} onChange={(e) => setForm({ ...form, origin_country: e.target.value })}
              className="w-full bg-cti-bg border border-cti-border rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-cti-green/50" />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Motivation</label>
            <select value={form.motivation} onChange={(e) => setForm({ ...form, motivation: e.target.value })}
              className="w-full bg-cti-bg border border-cti-border rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-cti-green/50">
              {MOTIVATIONS.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">ATT&CK techniques (comma-separated)</label>
            <input value={form.attack_tags} onChange={(e) => setForm({ ...form, attack_tags: e.target.value })}
              placeholder="T1566, T1059"
              className="w-full bg-cti-bg border border-cti-border rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-cti-green/50" />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Confidence ({form.confidence}%)</label>
            <input type="range" min="0" max="100" value={form.confidence}
              onChange={(e) => setForm({ ...form, confidence: e.target.value })} className="w-full mt-2" />
          </div>
          <div className="md:col-span-2">
            <label className="block text-xs text-gray-500 mb-1">Description</label>
            <textarea rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="w-full bg-cti-bg border border-cti-border rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-cti-green/50" />
          </div>
          {err && <p className="text-xs text-red-400 md:col-span-2">{err}</p>}
          <div className="md:col-span-2">
            <button type="submit" disabled={saving}
              className="px-5 py-2 rounded-lg bg-cti-green/20 border border-cti-green/40 text-cti-green text-sm font-medium hover:bg-cti-green/30 transition-colors disabled:opacity-50">
              {saving ? "Creating…" : "Create Actor"}
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="p-8 text-center text-gray-500 text-sm">Loading…</div>
      ) : actors.length === 0 ? (
        <div className="bg-cti-surface border border-cti-border rounded-xl p-12 text-center text-gray-500 text-sm">
          No threat actors yet, create a profile to start tracking.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {actors.map((a) => (
            <button key={a.id} onClick={() => setSelected(a.id)}
              className="text-left bg-cti-surface border border-cti-border rounded-xl p-5 hover:border-cti-green/30 transition-colors">
              <div className="flex items-center gap-2 mb-2">
                <Target size={16} className="text-cti-pink" />
                <span className="text-base font-semibold text-gray-100">{a.name}</span>
              </div>
              {a.aliases?.length > 0 && (
                <p className="text-xs text-gray-500 mb-3 truncate">aka {a.aliases.join(", ")}</p>
              )}
              <div className="flex items-center justify-between text-xs text-gray-500">
                <span className="flex items-center gap-1"><Globe size={12} />{a.origin_country || "?"}</span>
                <span>{a.motivation || "unknown"}</span>
              </div>
              <div className="mt-3"><ConfidenceBar value={a.confidence} /></div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
