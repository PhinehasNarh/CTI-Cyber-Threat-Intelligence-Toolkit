import { useState, useEffect, useCallback } from "react";
import {
  getAssets, addAsset, deleteAsset, getIntegrationStatus, pushToMisp,
} from "../api/client";
import { Radar, Plus, Trash2, ServerCog, AlertTriangle, CheckCircle, XCircle, Send } from "lucide-react";

function AssetWatch() {
  const [data, setData] = useState({ assets: [], reachable: true });
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ ip: "", label: "" });
  const [err, setErr] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try { setData(await getAssets()); } finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  async function add(e) {
    e.preventDefault();
    setErr("");
    if (!form.ip.trim()) return;
    try { await addAsset(form); setForm({ ip: "", label: "" }); await load(); }
    catch (e) { setErr(e.message); }
  }

  return (
    <div className="bg-cti-surface border border-cti-border rounded-xl overflow-hidden">
      <div className="px-5 py-3 border-b border-cti-border text-xs font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-2">
        <Radar size={13} className="text-cti-green" /> Shodan Asset Watch (#12)
      </div>
      <form onSubmit={add} className="px-5 py-3 border-b border-cti-border flex flex-wrap gap-2 items-end">
        <input value={form.ip} onChange={(e) => setForm({ ...form, ip: e.target.value })}
          placeholder="IP to monitor (e.g. 1.1.1.1)"
          className="flex-1 min-w-[160px] bg-cti-bg border border-cti-border rounded-lg px-3 py-1.5 text-xs font-mono text-gray-200 focus:outline-none focus:border-cti-green/50" />
        <input value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })}
          placeholder="label (optional)"
          className="flex-1 min-w-[120px] bg-cti-bg border border-cti-border rounded-lg px-3 py-1.5 text-xs text-gray-200 focus:outline-none focus:border-cti-green/50" />
        <button type="submit" className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-cti-green/10 text-cti-green border border-cti-green/20 text-xs hover:bg-cti-green/20">
          <Plus size={13} /> Pin
        </button>
      </form>
      {err && <p className="px-5 py-2 text-xs text-red-400">{err}</p>}
      {!data.reachable && (
        <p className="px-5 py-2 text-xs text-orange-400 flex items-center gap-1.5"><AlertTriangle size={12} /> Shodan InternetDB unreachable for some assets; showing last snapshot.</p>
      )}
      {loading ? (
        <div className="p-6 text-center text-gray-500 text-sm">Querying InternetDB…</div>
      ) : data.assets.length === 0 ? (
        <div className="p-8 text-center text-gray-500 text-sm">No assets pinned. Add an IP to track its open ports and known vulns (free, no key).</div>
      ) : (
        <div className="divide-y divide-cti-border">
          {data.assets.map((a) => (
            <div key={a.id} className="px-5 py-3">
              <div className="flex items-center gap-3">
                <span className="text-sm font-mono text-gray-200">{a.ip}</span>
                {a.label && <span className="text-[10px] text-gray-500">{a.label}</span>}
                {a.new_ports?.length > 0 && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-cti-amber/10 border border-cti-amber/20 text-cti-amber">
                    new ports: {a.new_ports.join(", ")}
                  </span>
                )}
                <button onClick={async () => { await deleteAsset(a.id); load(); }}
                  className="ml-auto text-gray-600 hover:text-red-400"><Trash2 size={13} /></button>
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1.5 text-[11px] text-gray-500">
                <span>ports: {a.ports?.length ? a.ports.join(", ") : "none"}</span>
                {a.vulns?.length > 0 && <span className="text-red-400">vulns: {a.vulns.slice(0, 5).join(", ")}{a.vulns.length > 5 ? "…" : ""}</span>}
                {a.tags?.length > 0 && <span>tags: {a.tags.join(", ")}</span>}
                {a.hostnames?.length > 0 && <span>hosts: {a.hostnames.slice(0, 2).join(", ")}</span>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function IntegrationStatus() {
  const [items, setItems] = useState([]);
  const [pushMsg, setPushMsg] = useState("");

  useEffect(() => { getIntegrationStatus().then((r) => setItems(r.integrations ?? [])).catch(() => {}); }, []);

  async function tryPush() {
    setPushMsg("");
    try { const r = await pushToMisp(75); setPushMsg(`Pushed ${r.pushed} IOCs to ${r.misp_url}.`); }
    catch (e) { setPushMsg(e.message); }
  }

  return (
    <div className="bg-cti-surface border border-cti-border rounded-xl overflow-hidden">
      <div className="px-5 py-3 border-b border-cti-border text-xs font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-2">
        <ServerCog size={13} className="text-cti-blue" /> Threat Sharing & Monitoring (#9, #10)
      </div>
      <div className="divide-y divide-cti-border">
        {items.map((it) => (
          <div key={it.key} className="px-5 py-3 flex items-center gap-3">
            {it.configured
              ? <CheckCircle size={15} className="text-cti-green flex-shrink-0" />
              : <XCircle size={15} className="text-gray-600 flex-shrink-0" />}
            <div className="flex-1 min-w-0">
              <div className="text-sm text-gray-200">{it.name} <span className="text-[10px] text-gray-600">{it.category}</span></div>
              <div className="text-[11px] text-gray-500">{it.configured ? "Configured" : it.hint}</div>
            </div>
            {it.key === "misp" && (
              <button onClick={tryPush}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-cti-blue/10 text-cti-blue border border-cti-blue/20 text-[11px] hover:bg-cti-blue/20">
                <Send size={11} /> Push high-conf IOCs
              </button>
            )}
          </div>
        ))}
      </div>
      {pushMsg && <p className="px-5 py-2 text-[11px] text-cti-amber">{pushMsg}</p>}
    </div>
  );
}

export default function Integrations() {
  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center gap-3">
        <ServerCog size={22} className="text-cti-green" />
        <h1 className="text-xl font-semibold text-gray-100">Integrations</h1>
      </div>
      <AssetWatch />
      <IntegrationStatus />
    </div>
  );
}
