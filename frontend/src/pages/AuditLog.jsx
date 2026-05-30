import { useState, useEffect, useCallback } from "react";
import { getAuditLog } from "../api/client";
import { ScrollText, Plus, Pencil, Trash2, Activity } from "lucide-react";

const ACTION_STYLES = {
  create: { color: "#00ff87", icon: Plus },
  update: { color: "#00d4ff", icon: Pencil },
  delete: { color: "#ef4444", icon: Trash2 },
};

function actionStyle(action) {
  return ACTION_STYLES[action] || { color: "#9ca3af", icon: Activity };
}

function relativeTime(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return d.toLocaleDateString();
}

export default function AuditLog() {
  const [data, setData] = useState({ entries: [], total: 0, by_entity: {} });
  const [loading, setLoading] = useState(true);
  const [entityFilter, setEntityFilter] = useState("");
  const [actionFilter, setActionFilter] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = { limit: 200 };
      if (entityFilter) params.entity_type = entityFilter;
      if (actionFilter) params.action = actionFilter;
      setData(await getAuditLog(params));
    } finally {
      setLoading(false);
    }
  }, [entityFilter, actionFilter]);

  useEffect(() => { load(); }, [load]);

  const entityTypes = Object.keys(data.by_entity || {});

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <ScrollText size={22} className="text-cti-green" />
        <h1 className="text-xl font-semibold text-gray-100">Audit Log</h1>
        <span className="text-xs text-gray-500 bg-cti-surface border border-cti-border px-2 py-0.5 rounded-full">
          {data.total} events
        </span>
      </div>

      <div className="flex flex-wrap gap-2">
        <div className="flex gap-1">
          {["", "create", "update", "delete"].map((a) => (
            <button key={a} onClick={() => setActionFilter(a)}
              className={`px-3 py-1.5 rounded-lg text-xs border transition-colors ${
                actionFilter === a ? "bg-cti-blue/10 text-cti-blue border-cti-blue/20"
                  : "text-gray-500 border-transparent hover:text-gray-300"}`}>
              {a || "All actions"}
            </button>
          ))}
        </div>
        {entityTypes.length > 0 && (
          <div className="flex gap-1">
            <button onClick={() => setEntityFilter("")}
              className={`px-3 py-1.5 rounded-lg text-xs border transition-colors ${
                entityFilter === "" ? "bg-cti-green/10 text-cti-green border-cti-green/20"
                  : "text-gray-500 border-transparent hover:text-gray-300"}`}>
              All types
            </button>
            {entityTypes.map((t) => (
              <button key={t} onClick={() => setEntityFilter(t)}
                className={`px-3 py-1.5 rounded-lg text-xs border transition-colors ${
                  entityFilter === t ? "bg-cti-green/10 text-cti-green border-cti-green/20"
                    : "text-gray-500 border-transparent hover:text-gray-300"}`}>
                {t} ({data.by_entity[t]})
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="bg-cti-surface border border-cti-border rounded-xl overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-500 text-sm">Loading…</div>
        ) : data.entries.length === 0 ? (
          <div className="p-12 text-center text-gray-500 text-sm">
            No audit events yet. Analyst actions (creating actors, campaigns, alert rules, etc.) are recorded here.
          </div>
        ) : (
          <div className="divide-y divide-cti-border">
            {data.entries.map((e) => {
              const { color, icon: Icon } = actionStyle(e.action);
              return (
                <div key={e.id} className="px-5 py-3 flex items-center gap-3">
                  <Icon size={15} style={{ color }} className="flex-shrink-0" />
                  <span className="text-[10px] px-1.5 py-0.5 rounded border font-medium flex-shrink-0"
                    style={{ color, borderColor: color + "33", background: color + "11" }}>
                    {e.action}
                  </span>
                  <span className="text-[10px] text-gray-500 w-20 flex-shrink-0">{e.entity_type}</span>
                  <span className="text-xs text-gray-200 truncate flex-1">{e.summary}</span>
                  <span className="text-xs text-gray-600 flex-shrink-0">{e.actor}</span>
                  <span className="text-[10px] text-gray-600 flex-shrink-0 w-20 text-right" title={e.created_at}>
                    {relativeTime(e.created_at)}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
