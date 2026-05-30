import { useState } from "react";
import { searchCTLogs } from "../api/client";
import { ScrollText, Search, AlertTriangle, ShieldCheck } from "lucide-react";

function daysAgo(iso) {
  if (!iso) return null;
  const d = (Date.now() - new Date(iso).getTime()) / 86400000;
  return Math.floor(d);
}

export default function CTLogs() {
  const [domain, setDomain] = useState("");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  async function run(e) {
    e.preventDefault();
    if (!domain.trim()) return;
    setLoading(true);
    setData(null);
    try { setData(await searchCTLogs(domain.trim())); }
    catch (err) { setData({ available: false, error: err.message, certs: [] }); }
    finally { setLoading(false); }
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center gap-3">
        <ScrollText size={22} className="text-cti-green" />
        <h1 className="text-xl font-semibold text-gray-100">Certificate Transparency Watcher</h1>
      </div>
      <p className="text-xs text-gray-500">
        Monitor newly issued TLS certificates under a domain via crt.sh (free, no key). New subdomains/certs often precede phishing infrastructure going live.
      </p>

      <form onSubmit={run} className="flex gap-2">
        <div className="flex-1 relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input value={domain} onChange={(e) => setDomain(e.target.value)}
            placeholder="example.com"
            className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-cti-surface border border-cti-border text-sm text-gray-200 font-mono focus:outline-none focus:border-cti-green/40" />
        </div>
        <button type="submit" disabled={loading || !domain.trim()}
          className="px-6 py-2.5 rounded-lg bg-cti-green/10 text-cti-green border border-cti-green/20 hover:bg-cti-green/20 text-sm font-semibold disabled:opacity-50">
          {loading ? "Querying crt.sh…" : "Search"}
        </button>
      </form>

      {data && !data.available && (
        <div className="flex items-center gap-2 text-sm text-orange-400 bg-orange-400/5 border border-orange-400/20 rounded-lg p-4">
          <AlertTriangle size={16} /> {data.error}
        </div>
      )}

      {data && data.available && (
        <div className="bg-cti-surface border border-cti-border rounded-xl overflow-hidden">
          <div className="px-5 py-3 border-b border-cti-border flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-2">
              <ShieldCheck size={13} className="text-cti-green" /> Certificates for {data.domain}
            </span>
            <span className="text-[10px] text-gray-500">{data.total} unique</span>
          </div>
          {data.certs.length === 0 ? (
            <div className="p-10 text-center text-gray-500 text-sm">No active certificates found.</div>
          ) : (
            <div className="divide-y divide-cti-border max-h-[65vh] overflow-y-auto">
              {data.certs.map((c, i) => {
                const age = daysAgo(c.not_before);
                const fresh = age != null && age <= 7;
                return (
                  <div key={i} className="px-5 py-3">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono text-gray-200 break-all flex-1">{c.common_name || c.name_value?.split("\n")[0]}</span>
                      {fresh && <span className="text-[10px] px-1.5 py-0.5 rounded bg-cti-amber/10 border border-cti-amber/20 text-cti-amber flex-shrink-0">new · {age}d</span>}
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-0.5 mt-1 text-[11px] text-gray-600">
                      <span>issuer: {c.issuer || "?"}</span>
                      <span>issued: {c.not_before?.slice(0, 10)}</span>
                      <span>expires: {c.not_after?.slice(0, 10)}</span>
                    </div>
                    {c.name_value && c.name_value.includes("\n") && (
                      <div className="text-[10px] text-gray-500 mt-1 font-mono">
                        SANs: {c.name_value.split("\n").slice(0, 6).join(", ")}{c.name_value.split("\n").length > 6 ? "…" : ""}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
