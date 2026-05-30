import { useState, useEffect, useCallback } from "react";
import {
  getApiKeys, createApiKey, toggleApiKey, deleteApiKey,
} from "../api/client";
import { KeyRound, Plus, Trash2, ToggleLeft, ToggleRight, Copy, Check, Terminal } from "lucide-react";

export default function ApiKeys() {
  const [keys, setKeys] = useState([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [ingest, setIngest] = useState(false);
  const [created, setCreated] = useState(null);   // freshly created key (shown once)
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try { const r = await getApiKeys(); setKeys(r.keys ?? []); } finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  async function handleCreate(e) {
    e.preventDefault();
    if (!name.trim()) return;
    const scopes = ["read", ...(ingest ? ["ingest"] : [])];
    const k = await createApiKey({ name, scopes });
    setCreated(k);
    setName(""); setIngest(false);
    await load();
  }

  const origin = window.location.origin;

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center gap-3">
        <KeyRound size={22} className="text-cti-green" />
        <h1 className="text-xl font-semibold text-gray-100">API Keys</h1>
      </div>
      <p className="text-xs text-gray-500">
        Authenticate to the public REST API (<code className="text-cti-amber">/api/v1</code>). 60 requests/min per key. Read keys can query; ingest keys can also push IOCs via the webhook sink.
      </p>

      {created && (
        <div className="bg-cti-green/5 border border-cti-green/30 rounded-xl p-4">
          <div className="text-xs text-cti-green mb-2">New key created. Copy it now, it will not be shown again.</div>
          <div className="flex items-center gap-2">
            <code className="flex-1 text-sm text-gray-200 font-mono break-all bg-cti-bg rounded-lg px-3 py-2">{created.key}</code>
            <button onClick={() => { navigator.clipboard.writeText(created.key); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
              className="px-3 py-2 rounded-lg bg-cti-green/10 text-cti-green border border-cti-green/20 text-xs">
              {copied ? <Check size={14} /> : <Copy size={14} />}
            </button>
          </div>
        </div>
      )}

      <form onSubmit={handleCreate} className="bg-cti-surface border border-cti-border rounded-xl p-5 flex flex-wrap items-end gap-4">
        <div className="flex-1 min-w-[180px]">
          <label className="block text-xs text-gray-500 mb-1">Key name *</label>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Splunk integration"
            className="w-full bg-cti-bg border border-cti-border rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-cti-green/50" />
        </div>
        <label className="flex items-center gap-2 text-xs text-gray-400 cursor-pointer pb-2">
          <input type="checkbox" checked={ingest} onChange={(e) => setIngest(e.target.checked)} className="accent-cti-green" />
          allow ingest (webhook writes)
        </label>
        <button type="submit"
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-cti-green/20 border border-cti-green/40 text-cti-green text-sm font-medium hover:bg-cti-green/30">
          <Plus size={15} /> Create Key
        </button>
      </form>

      <div className="bg-cti-surface border border-cti-border rounded-xl overflow-hidden">
        <div className="px-5 py-3 border-b border-cti-border text-xs font-semibold text-gray-400 uppercase tracking-wider">Keys</div>
        {loading ? (
          <div className="p-8 text-center text-gray-500 text-sm">Loading…</div>
        ) : keys.length === 0 ? (
          <div className="p-8 text-center text-gray-500 text-sm">No API keys yet.</div>
        ) : (
          <div className="divide-y divide-cti-border">
            {keys.map((k) => (
              <div key={k.id} className="px-5 py-3 flex items-center gap-3">
                <button onClick={async () => { await toggleApiKey(k.id, !k.is_active); load(); }}>
                  {k.is_active ? <ToggleRight size={20} className="text-cti-green" /> : <ToggleLeft size={20} className="text-gray-500" />}
                </button>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-200">{k.name}</span>
                    {k.scopes.map((s) => (
                      <span key={s} className="text-[10px] px-1.5 py-0.5 rounded bg-cti-blue/10 border border-cti-blue/20 text-cti-blue">{s}</span>
                    ))}
                  </div>
                  <div className="text-[11px] text-gray-600 mt-0.5 font-mono">{k.key} · {k.request_count} reqs{k.last_used ? ` · last ${k.last_used.slice(0, 10)}` : ""}</div>
                </div>
                <button onClick={async () => { if (confirm("Delete this key?")) { await deleteApiKey(k.id); load(); } }}
                  className="text-gray-600 hover:text-red-400"><Trash2 size={15} /></button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Usage */}
      <div className="bg-cti-surface border border-cti-border rounded-xl p-5">
        <h3 className="text-sm font-semibold text-gray-300 mb-3 flex items-center gap-2"><Terminal size={15} /> Usage</h3>
        <pre className="text-[11px] text-gray-400 bg-cti-bg rounded-lg p-3 overflow-x-auto whitespace-pre-wrap">{`# Query IOCs
curl -H "X-API-Key: <key>" "${origin}/api/v1/iocs?type=ip&since=24h&min_score=50"

# Ingest via webhook (needs 'ingest' scope)
curl -X POST -H "X-API-Key: <key>" -H "Content-Type: application/json" \\
  -d '{"iocs":[{"value":"1.2.3.4","confidence":80}]}' \\
  ${origin}/api/v1/iocs`}</pre>
      </div>
    </div>
  );
}
