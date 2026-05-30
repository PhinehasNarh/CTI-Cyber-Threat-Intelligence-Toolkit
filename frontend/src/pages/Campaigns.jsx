import { useState, useEffect } from "react";
import {
  getCampaigns, getCampaign, createCampaign, deleteCampaign,
  addCampaignIOC, removeCampaignIOC,
} from "../api/client";
import { Crosshair, Plus, Trash2, ChevronLeft, Shield, Newspaper, X } from "lucide-react";

const STATUS_STYLES = {
  active:    "text-cti-green bg-cti-green/10 border-cti-green/30",
  suspected: "text-cti-amber bg-cti-amber/10 border-cti-amber/30",
  closed:    "text-gray-400 bg-gray-400/10 border-gray-400/20",
};

const EMPTY_FORM = {
  name: "",
  description: "",
  status: "active",
  confidence: 50,
  threat_actor: "",
  start_date: "",
};

function CampaignDetail({ id, onBack, onDeleted }) {
  const [c, setC] = useState(null);
  const [loading, setLoading] = useState(true);
  const [iocValue, setIocValue] = useState("");
  const [err, setErr] = useState("");

  async function load() {
    setLoading(true);
    try { setC(await getCampaign(id)); } finally { setLoading(false); }
  }
  useEffect(() => { load(); }, [id]);

  if (loading) return <div className="p-8 text-center text-gray-500 text-sm">Loading…</div>;
  if (!c) return null;

  async function handleAddIOC(e) {
    e.preventDefault();
    setErr("");
    if (!iocValue.trim()) return;
    try {
      await addCampaignIOC(id, iocValue.trim());
      setIocValue("");
      await load();
    } catch (e) { setErr(e.message); }
  }

  return (
    <div className="space-y-6">
      <button onClick={onBack} className="flex items-center gap-1 text-sm text-gray-400 hover:text-gray-200">
        <ChevronLeft size={16} /> Back to campaigns
      </button>

      <div className="bg-cti-surface border border-cti-border rounded-xl p-6">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <h1 className="font-display text-2xl font-bold text-white">{c.name}</h1>
            <span className={`text-[10px] px-2 py-0.5 rounded border font-medium ${STATUS_STYLES[c.status] ?? STATUS_STYLES.closed}`}>
              {c.status}
            </span>
          </div>
          <button
            onClick={async () => {
              if (!confirm(`Delete campaign "${c.name}"?`)) return;
              await deleteCampaign(c.id);
              onDeleted();
            }}
            className="text-gray-600 hover:text-red-400 transition-colors"
          >
            <Trash2 size={16} />
          </button>
        </div>
        <div className="flex flex-wrap gap-x-8 gap-y-2 mt-4 text-sm">
          <div><span className="text-gray-500">Attributed actor: </span><span className="text-gray-200">{c.threat_actor || "Unattributed"}</span></div>
          <div><span className="text-gray-500">Confidence: </span><span className="text-gray-200">{c.confidence}%</span></div>
          <div><span className="text-gray-500">Started: </span><span className="text-gray-200">{c.start_date?.slice(0, 10) || "n/a"}</span></div>
        </div>
        {c.description && <p className="text-sm text-gray-400 mt-4 leading-relaxed">{c.description}</p>}
      </div>

      <div className="bg-cti-surface border border-cti-border rounded-xl overflow-hidden">
        <div className="px-5 py-3 border-b border-cti-border flex items-center justify-between">
          <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-2">
            <Shield size={13} /> IOCs ({c.iocs?.length ?? 0})
          </span>
        </div>
        <form onSubmit={handleAddIOC} className="px-5 py-3 border-b border-cti-border flex gap-2">
          <input value={iocValue} onChange={(e) => setIocValue(e.target.value)}
            placeholder="Add an existing IOC by value…"
            className="flex-1 bg-cti-bg border border-cti-border rounded-lg px-3 py-1.5 text-xs font-mono text-gray-200 focus:outline-none focus:border-cti-green/50" />
          <button type="submit" className="px-3 py-1.5 rounded-lg bg-cti-green/10 text-cti-green border border-cti-green/20 text-xs hover:bg-cti-green/20">
            Add
          </button>
        </form>
        {err && <p className="px-5 py-2 text-xs text-red-400">{err}</p>}
        {c.iocs?.length > 0 ? (
          <div className="divide-y divide-cti-border">
            {c.iocs.map((i) => (
              <div key={i.id} className="px-5 py-2.5 flex items-center gap-3">
                <span className="text-[10px] text-gray-500 w-12">{i.ioc_type}</span>
                <span className="text-xs font-mono text-gray-300 truncate flex-1">{i.value}</span>
                {i.malware_family && <span className="text-[10px] text-cti-pink">{i.malware_family}</span>}
                <span className="text-[10px] text-cti-amber">{i.threat_score}</span>
                <button onClick={async () => { await removeCampaignIOC(id, i.id); load(); }}
                  className="text-gray-600 hover:text-red-400"><X size={13} /></button>
              </div>
            ))}
          </div>
        ) : <div className="p-6 text-center text-gray-600 text-sm">No IOCs linked yet</div>}
      </div>

      <div className="bg-cti-surface border border-cti-border rounded-xl overflow-hidden">
        <div className="px-5 py-3 border-b border-cti-border text-xs font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-2">
          <Newspaper size={13} /> Articles ({c.articles?.length ?? 0})
        </div>
        {c.articles?.length > 0 ? (
          <div className="divide-y divide-cti-border">
            {c.articles.map((a) => (
              <a key={a.id} href={a.url} target="_blank" rel="noreferrer" className="block px-5 py-2.5 hover:bg-white/[0.02]">
                <div className="text-xs text-gray-200 truncate">{a.title}</div>
                <div className="text-[10px] text-gray-600 mt-0.5">{a.source} · {a.published?.slice(0, 10)}</div>
              </a>
            ))}
          </div>
        ) : <div className="p-6 text-center text-gray-600 text-sm">No articles linked yet</div>}
      </div>
    </div>
  );
}

export default function Campaigns() {
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  async function load() {
    setLoading(true);
    try {
      const r = await getCampaigns();
      setCampaigns(r.campaigns ?? []);
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
      await createCampaign({
        ...form,
        confidence: Number(form.confidence),
        start_date: form.start_date || null,
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
    return <CampaignDetail id={selected} onBack={() => setSelected(null)}
      onDeleted={() => { setSelected(null); load(); }} />;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Crosshair size={22} className="text-cti-green" />
          <h1 className="text-xl font-semibold text-gray-100">Campaigns</h1>
          <span className="text-xs text-gray-500 bg-cti-surface border border-cti-border px-2 py-0.5 rounded-full">
            {campaigns.length} tracked
          </span>
        </div>
        <button onClick={() => setShowForm((v) => !v)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-cti-green/10 text-cti-green border border-cti-green/20 hover:bg-cti-green/20 transition-colors text-sm">
          <Plus size={16} /> New Campaign
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="bg-cti-surface border border-cti-border rounded-xl p-5 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Name *</label>
            <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="e.g. Operation SolarFlare"
              className="w-full bg-cti-bg border border-cti-border rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-cti-green/50" />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Attributed threat actor</label>
            <input value={form.threat_actor} onChange={(e) => setForm({ ...form, threat_actor: e.target.value })}
              className="w-full bg-cti-bg border border-cti-border rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-cti-green/50" />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Status</label>
            <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}
              className="w-full bg-cti-bg border border-cti-border rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-cti-green/50">
              {["active", "suspected", "closed"].map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Start date</label>
            <input type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })}
              className="w-full bg-cti-bg border border-cti-border rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-cti-green/50" />
          </div>
          <div className="md:col-span-2">
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
              {saving ? "Creating…" : "Create Campaign"}
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="p-8 text-center text-gray-500 text-sm">Loading…</div>
      ) : campaigns.length === 0 ? (
        <div className="bg-cti-surface border border-cti-border rounded-xl p-12 text-center text-gray-500 text-sm">
          No campaigns yet, group related IOCs and articles into a named campaign.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {campaigns.map((c) => (
            <button key={c.id} onClick={() => setSelected(c.id)}
              className="text-left bg-cti-surface border border-cti-border rounded-xl p-5 hover:border-cti-green/30 transition-colors">
              <div className="flex items-center justify-between mb-2">
                <span className="text-base font-semibold text-gray-100 truncate">{c.name}</span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded border font-medium flex-shrink-0 ${STATUS_STYLES[c.status] ?? STATUS_STYLES.closed}`}>
                  {c.status}
                </span>
              </div>
              {c.threat_actor && <p className="text-xs text-cti-pink mb-3">{c.threat_actor}</p>}
              <div className="flex items-center gap-4 text-xs text-gray-500">
                <span className="flex items-center gap-1"><Shield size={12} />{c.ioc_count} IOCs</span>
                <span className="flex items-center gap-1"><Newspaper size={12} />{c.article_count} articles</span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
