import { useState, useEffect, useCallback } from "react";
import {
  getTriageQueue, getTriageSummary, updateIOC, updateArticleParams,
} from "../api/client";
import { ClipboardList, Shield, Newspaper, User, Tag, StickyNote, Check } from "lucide-react";

const STATUSES = ["new", "in_review", "resolved", "false_positive"];

const STATUS_STYLES = {
  new:             { label: "New",       color: "#00d4ff" },
  in_review:       { label: "In Review", color: "#fbbf24" },
  resolved:        { label: "Resolved",  color: "#00ff87" },
  false_positive:  { label: "False +",   color: "#6b7280" },
};

function StatusPills({ value, onChange }) {
  return (
    <div className="flex gap-1">
      {STATUSES.map((s) => {
        const st = STATUS_STYLES[s];
        const active = value === s;
        return (
          <button key={s} onClick={() => onChange(s)}
            className="text-[10px] px-1.5 py-0.5 rounded border font-medium transition-colors"
            style={active
              ? { color: st.color, borderColor: st.color + "55", background: st.color + "18" }
              : { color: "#6b7280", borderColor: "transparent" }}>
            {st.label}
          </button>
        );
      })}
    </div>
  );
}

function TriageRow({ item, onPatch }) {
  const [assignee, setAssignee] = useState(item.assignee || "");
  const [tags, setTags] = useState((item.analyst_tags || []).join(", "));
  const [notes, setNotes] = useState(item.analyst_notes || "");
  const [expanded, setExpanded] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);

  const flash = () => { setSavedFlash(true); setTimeout(() => setSavedFlash(false), 1200); };

  const Icon = item.kind === "ioc" ? Shield : Newspaper;
  const accent = item.kind === "ioc" ? "#a78bfa" : "#00d4ff";

  async function patch(params) {
    await onPatch(item, params);
    flash();
  }

  return (
    <div className="px-5 py-3">
      <div className="flex items-center gap-3">
        <Icon size={15} style={{ color: accent }} className="flex-shrink-0" />
        <span className="text-[10px] px-1.5 py-0.5 rounded border flex-shrink-0"
          style={{ color: accent, borderColor: accent + "33", background: accent + "11" }}>
          {item.kind}
        </span>
        {item.url ? (
          <a href={item.url} target="_blank" rel="noreferrer"
            className="text-xs text-gray-200 truncate flex-1 hover:text-cti-blue">{item.title}</a>
        ) : (
          <span className="text-xs font-mono text-gray-200 truncate flex-1">{item.title}</span>
        )}
        <span className="text-[10px] text-gray-600 flex-shrink-0">{item.subtitle}</span>
        <span className="text-[10px] text-cti-amber flex-shrink-0 w-10 text-right">{item.score}</span>
        <StatusPills value={item.triage_status} onChange={(s) => patch({ triage_status: s })} />
        <button onClick={() => setExpanded((v) => !v)}
          className="text-gray-600 hover:text-gray-300 flex-shrink-0">
          {savedFlash ? <Check size={14} className="text-cti-green" /> : <StickyNote size={14} />}
        </button>
      </div>

      {expanded && (
        <div className="mt-3 ml-8 grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label className="block text-[10px] text-gray-500 uppercase tracking-wider mb-1 flex items-center gap-1">
              <User size={10} /> Assignee
            </label>
            <input value={assignee} onChange={(e) => setAssignee(e.target.value)}
              onBlur={() => assignee !== (item.assignee || "") && patch({ assignee })}
              placeholder="analyst name"
              className="w-full bg-cti-bg border border-cti-border rounded-lg px-2.5 py-1.5 text-xs text-gray-200 focus:outline-none focus:border-cti-green/50" />
          </div>
          <div>
            <label className="block text-[10px] text-gray-500 uppercase tracking-wider mb-1 flex items-center gap-1">
              <Tag size={10} /> Tags (comma-separated)
            </label>
            <input value={tags} onChange={(e) => setTags(e.target.value)}
              onBlur={() => tags !== (item.analyst_tags || []).join(", ") && patch({ analyst_tags: tags })}
              placeholder="#priority, #confirmed"
              className="w-full bg-cti-bg border border-cti-border rounded-lg px-2.5 py-1.5 text-xs text-gray-200 focus:outline-none focus:border-cti-green/50" />
          </div>
          <div>
            <label className="block text-[10px] text-gray-500 uppercase tracking-wider mb-1 flex items-center gap-1">
              <StickyNote size={10} /> Notes
            </label>
            <input value={notes} onChange={(e) => setNotes(e.target.value)}
              onBlur={() => notes !== (item.analyst_notes || "") && patch({ analyst_notes: notes })}
              placeholder="analyst note…"
              className="w-full bg-cti-bg border border-cti-border rounded-lg px-2.5 py-1.5 text-xs text-gray-200 focus:outline-none focus:border-cti-green/50" />
          </div>
        </div>
      )}

      {!expanded && (item.assignee || item.analyst_tags?.length > 0) && (
        <div className="mt-1.5 ml-8 flex items-center gap-3 text-[10px] text-gray-500">
          {item.assignee && <span className="flex items-center gap-1"><User size={10} />{item.assignee}</span>}
          {item.analyst_tags?.map((t) => (
            <span key={t} className="px-1.5 py-0.5 rounded bg-cti-green/10 border border-cti-green/20 text-cti-green">{t}</span>
          ))}
        </div>
      )}
    </div>
  );
}

export default function TriageQueue() {
  const [items, setItems] = useState([]);
  const [summary, setSummary] = useState({ by_status: {}, by_assignee: {}, open: 0 });
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("");
  const [kindFilter, setKindFilter] = useState("all");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = { kind: kindFilter, limit: 100 };
      if (statusFilter) params.status = statusFilter;
      const [q, s] = await Promise.all([getTriageQueue(params), getTriageSummary()]);
      setItems(q.items ?? []);
      setSummary(s);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, kindFilter]);

  useEffect(() => { load(); }, [load]);

  async function handlePatch(item, params) {
    if (item.kind === "ioc") await updateIOC(item.id, params);
    else await updateArticleParams(item.id, params);
    // Optimistic local update; refresh summary counts
    setItems((prev) => prev.map((it) =>
      it.kind === item.kind && it.id === item.id ? { ...it, ...params, analyst_tags: params.analyst_tags !== undefined ? params.analyst_tags.split(",").map((x) => x.trim()).filter(Boolean) : it.analyst_tags } : it));
    getTriageSummary().then(setSummary);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <ClipboardList size={22} className="text-cti-green" />
        <h1 className="text-xl font-semibold text-gray-100">Triage Queue</h1>
        <span className="text-xs text-gray-500 bg-cti-surface border border-cti-border px-2 py-0.5 rounded-full">
          {summary.open} open
        </span>
      </div>

      {/* Status summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {STATUSES.map((s) => {
          const st = STATUS_STYLES[s];
          return (
            <button key={s} onClick={() => setStatusFilter(statusFilter === s ? "" : s)}
              className="bg-cti-surface border rounded-lg p-3 text-left transition-colors"
              style={{ borderColor: statusFilter === s ? st.color + "55" : "" }}>
              <div className="text-xl font-display font-bold" style={{ color: st.color }}>
                {summary.by_status?.[s] ?? 0}
              </div>
              <div className="text-[10px] text-gray-500 uppercase tracking-wider">{st.label}</div>
            </button>
          );
        })}
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap gap-2">
        <div className="flex gap-1">
          {["all", "ioc", "article"].map((k) => (
            <button key={k} onClick={() => setKindFilter(k)}
              className={`px-3 py-1.5 rounded-lg text-xs border transition-colors ${
                kindFilter === k ? "bg-cti-blue/10 text-cti-blue border-cti-blue/20"
                  : "text-gray-500 border-transparent hover:text-gray-300"}`}>
              {k === "all" ? "All items" : k === "ioc" ? "IOCs" : "Articles"}
            </button>
          ))}
        </div>
        {statusFilter && (
          <button onClick={() => setStatusFilter("")}
            className="px-3 py-1.5 rounded-lg text-xs border border-cti-border text-gray-400 hover:text-gray-200">
            Clear status: {STATUS_STYLES[statusFilter].label} ✕
          </button>
        )}
        {Object.keys(summary.by_assignee || {}).length > 0 && (
          <div className="flex items-center gap-2 text-xs text-gray-500 ml-auto">
            <User size={12} />
            {Object.entries(summary.by_assignee).map(([who, c]) => (
              <span key={who} className="px-2 py-0.5 rounded bg-cti-surface border border-cti-border">{who}: {c}</span>
            ))}
          </div>
        )}
      </div>

      {/* Queue */}
      <div className="bg-cti-surface border border-cti-border rounded-xl overflow-hidden">
        <div className="px-5 py-3 border-b border-cti-border text-xs text-gray-500">
          Click the note icon on any row to assign, tag, and annotate. Status changes save instantly.
        </div>
        {loading ? (
          <div className="p-8 text-center text-gray-500 text-sm">Loading…</div>
        ) : items.length === 0 ? (
          <div className="p-12 text-center text-gray-500 text-sm">
            Nothing in the queue for this filter. Poll the feeds to populate items to triage.
          </div>
        ) : (
          <div className="divide-y divide-cti-border">
            {items.map((it) => (
              <TriageRow key={`${it.kind}-${it.id}`} item={it} onPatch={handlePatch} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
