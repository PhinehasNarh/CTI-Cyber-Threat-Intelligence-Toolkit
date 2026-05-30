import { useState, useEffect, useCallback } from "react";
import {
  getRetention, createRetention, toggleRetention, deleteRetention, runRetention,
} from "../api/client";
import { Archive, Plus, Trash2, ToggleLeft, ToggleRight, Database, AlertTriangle } from "lucide-react";

const EMPTY = { entity_type: "article", source: "", max_age_days: 90, is_active: false };

export default function Retention() {
  const [data, setData] = useState({ policies: [], storage: {} });
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try { setData(await getRetention()); } finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  async function handleCreate(e) {
    e.preventDefault();
    setErr(""); setSaving(true);
    try {
      await createRetention({ ...form, max_age_days: Number(form.max_age_days) });
      setForm(EMPTY);
      await load();
    } catch (e) { setErr(e.message); } finally { setSaving(false); }
  }

  async function handleRun(p) {
    if (p.would_purge === 0) { alert("Nothing to purge for this policy right now."); return; }
    if (!confirm(`Permanently delete ${p.would_purge} ${p.entity_type}(s) older than ${p.max_age_days} days? This cannot be undone.`)) return;
    setBusyId(p.id);
    try { await runRetention(p.id); await load(); } finally { setBusyId(null); }
  }

  const storage = data.storage || {};

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center gap-3">
        <Archive size={22} className="text-cti-green" />
        <h1 className="text-xl font-semibold text-gray-100">Data Retention</h1>
      </div>

      {/* Storage overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-cti-surface border border-cti-border rounded-lg p-4">
          <Database size={16} className="text-cti-blue mb-2" />
          <div className="text-xl font-display font-bold text-gray-100">{storage.articles ?? 0}</div>
          <div className="text-[10px] text-gray-500 uppercase tracking-wider">Articles stored</div>
        </div>
        <div className="bg-cti-surface border border-cti-border rounded-lg p-4">
          <Database size={16} className="text-cti-green mb-2" />
          <div className="text-xl font-display font-bold text-gray-100">{storage.iocs ?? 0}</div>
          <div className="text-[10px] text-gray-500 uppercase tracking-wider">IOCs stored</div>
        </div>
        <div className="bg-cti-surface border border-cti-border rounded-lg p-4">
          <div className="text-xs text-gray-300 mt-1">{storage.oldest_article?.slice(0, 10) || "n/a"}</div>
          <div className="text-[10px] text-gray-500 uppercase tracking-wider">Oldest article</div>
        </div>
        <div className="bg-cti-surface border border-cti-border rounded-lg p-4">
          <div className="text-xs text-gray-300 mt-1">{storage.oldest_ioc?.slice(0, 10) || "n/a"}</div>
          <div className="text-[10px] text-gray-500 uppercase tracking-wider">Oldest IOC</div>
        </div>
      </div>

      {/* New policy */}
      <form onSubmit={handleCreate} className="bg-cti-surface border border-cti-border rounded-xl p-5 flex flex-wrap items-end gap-4">
        <div>
          <label className="block text-xs text-gray-500 mb-1">Applies to</label>
          <select value={form.entity_type} onChange={(e) => setForm({ ...form, entity_type: e.target.value })}
            className="bg-cti-bg border border-cti-border rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-cti-green/50">
            <option value="article">Articles</option>
            <option value="ioc">IOCs</option>
          </select>
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Source (blank = all)</label>
          <input value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })}
            placeholder="e.g. urlhaus"
            className="bg-cti-bg border border-cti-border rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-cti-green/50" />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Keep for (days)</label>
          <input type="number" min="1" value={form.max_age_days} onChange={(e) => setForm({ ...form, max_age_days: e.target.value })}
            className="w-28 bg-cti-bg border border-cti-border rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-cti-green/50" />
        </div>
        <button type="submit" disabled={saving}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-cti-green/20 border border-cti-green/40 text-cti-green text-sm font-medium hover:bg-cti-green/30 transition-colors disabled:opacity-50">
          <Plus size={15} /> {saving ? "Adding…" : "Add Policy"}
        </button>
        {err && <p className="text-xs text-red-400 w-full">{err}</p>}
      </form>

      {/* Policy list */}
      <div className="bg-cti-surface border border-cti-border rounded-xl overflow-hidden">
        <div className="px-5 py-3 border-b border-cti-border text-xs font-semibold text-gray-400 uppercase tracking-wider">
          Policies
        </div>
        {loading ? (
          <div className="p-8 text-center text-gray-500 text-sm">Loading…</div>
        ) : data.policies.length === 0 ? (
          <div className="p-10 text-center text-gray-500 text-sm">
            No retention policies. Add one above; new policies start inactive and only purge when you run them or activate the daily sweep.
          </div>
        ) : (
          <div className="divide-y divide-cti-border">
            {data.policies.map((p) => (
              <div key={p.id} className="px-5 py-3 flex items-center gap-4">
                <button onClick={async () => { await toggleRetention(p.id, !p.is_active); load(); }}>
                  {p.is_active
                    ? <ToggleRight size={20} className="text-cti-green" />
                    : <ToggleLeft size={20} className="text-gray-500" />}
                </button>
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-gray-200">
                    Keep {p.entity_type}s {p.source ? <>from <span className="text-cti-blue">{p.source}</span> </> : "(all sources) "}
                    for <span className="text-cti-amber">{p.max_age_days} days</span>
                  </div>
                  <div className="text-[11px] text-gray-500 mt-0.5">
                    {p.would_purge > 0
                      ? <span className="text-orange-400">{p.would_purge} row(s) currently eligible to purge</span>
                      : "nothing currently eligible"}
                    {p.last_run && <span> · last run {p.last_run.slice(0, 10)} (purged {p.last_purged})</span>}
                  </div>
                </div>
                <button onClick={() => handleRun(p)} disabled={busyId === p.id}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 text-xs disabled:opacity-50">
                  <AlertTriangle size={13} /> {busyId === p.id ? "Purging…" : "Run now"}
                </button>
                <button onClick={async () => { if (confirm("Delete this policy?")) { await deleteRetention(p.id); load(); } }}
                  className="text-gray-600 hover:text-red-400">
                  <Trash2 size={15} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
      <p className="text-[11px] text-gray-600">
        Active policies are also applied automatically by a daily background sweep. Archive-to-cold-storage (S3/MinIO) is not yet implemented; "Run now" deletes permanently.
      </p>
    </div>
  );
}
