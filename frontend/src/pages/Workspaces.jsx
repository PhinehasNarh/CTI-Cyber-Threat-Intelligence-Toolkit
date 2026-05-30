import { useState, useEffect, useCallback } from "react";
import { getWorkspaces, createWorkspace, deleteWorkspace, activeWorkspace } from "../api/client";
import { Building2, Plus, Trash2, Shield, Newspaper, Check } from "lucide-react";

export default function Workspaces() {
  const [workspaces, setWorkspaces] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ name: "", description: "" });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const current = activeWorkspace();

  const load = useCallback(async () => {
    setLoading(true);
    try { const r = await getWorkspaces(); setWorkspaces(r.workspaces ?? []); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  async function handleCreate(e) {
    e.preventDefault();
    setErr("");
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      await createWorkspace(form);
      setForm({ name: "", description: "" });
      await load();
    } catch (e) { setErr(e.message); } finally { setSaving(false); }
  }

  function switchTo(id) {
    localStorage.setItem("cti-workspace", String(id));
    window.location.reload();
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center gap-3">
        <Building2 size={22} className="text-cti-green" />
        <h1 className="text-xl font-semibold text-gray-100">Workspaces</h1>
      </div>
      <p className="text-xs text-gray-500">
        Workspaces segregate IOC and article data by team. Feed ingestion populates the Default workspace; switch the active workspace from the sidebar. (Per-workspace feeds and access control are not yet implemented.)
      </p>

      <form onSubmit={handleCreate} className="bg-cti-surface border border-cti-border rounded-xl p-5 flex flex-wrap items-end gap-3">
        <div className="flex-1 min-w-[180px]">
          <label className="block text-xs text-gray-500 mb-1">Name *</label>
          <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="e.g. Red Team"
            className="w-full bg-cti-bg border border-cti-border rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-cti-green/50" />
        </div>
        <div className="flex-1 min-w-[180px]">
          <label className="block text-xs text-gray-500 mb-1">Description</label>
          <input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
            className="w-full bg-cti-bg border border-cti-border rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-cti-green/50" />
        </div>
        <button type="submit" disabled={saving}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-cti-green/20 border border-cti-green/40 text-cti-green text-sm font-medium hover:bg-cti-green/30 disabled:opacity-50">
          <Plus size={15} /> {saving ? "Creating…" : "Create"}
        </button>
        {err && <p className="text-xs text-red-400 w-full">{err}</p>}
      </form>

      {loading ? (
        <div className="p-8 text-center text-gray-500 text-sm">Loading…</div>
      ) : (
        <div className="space-y-3">
          {workspaces.map((w) => {
            const isCurrent = String(w.id) === current;
            return (
              <div key={w.id} className="bg-cti-surface border border-cti-border rounded-xl p-4 flex items-center gap-4">
                <Building2 size={18} className={isCurrent ? "text-cti-green" : "text-gray-500"} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-gray-100">{w.name}</span>
                    {w.is_default && <span className="text-[10px] px-1.5 py-0.5 rounded bg-cti-border text-gray-400">default</span>}
                    {isCurrent && <span className="text-[10px] px-1.5 py-0.5 rounded bg-cti-green/10 border border-cti-green/20 text-cti-green flex items-center gap-1"><Check size={10} /> active</span>}
                  </div>
                  {w.description && <p className="text-xs text-gray-500 mt-0.5">{w.description}</p>}
                  <div className="flex items-center gap-4 text-[11px] text-gray-600 mt-1">
                    <span className="flex items-center gap-1"><Shield size={11} />{w.ioc_count} IOCs</span>
                    <span className="flex items-center gap-1"><Newspaper size={11} />{w.article_count} articles</span>
                  </div>
                </div>
                {!isCurrent && (
                  <button onClick={() => switchTo(w.id)}
                    className="px-3 py-1.5 rounded-lg bg-cti-green/10 text-cti-green border border-cti-green/20 hover:bg-cti-green/20 text-xs">
                    Switch
                  </button>
                )}
                {!w.is_default && (
                  <button onClick={async () => { if (confirm(`Delete workspace "${w.name}"? Its data moves back to Default.`)) { await deleteWorkspace(w.id); load(); } }}
                    className="text-gray-600 hover:text-red-400"><Trash2 size={15} /></button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
