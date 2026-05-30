import { useState, useEffect } from "react";
import {
  NotebookPen, Plus, Trash2, FileDown, Printer, Shield, Newspaper, StickyNote,
} from "lucide-react";

const STORAGE_KEY = "cti-workbench";
const KINDS = [
  { value: "ioc", label: "IOC", icon: Shield, color: "#00ff87" },
  { value: "article", label: "Article", icon: Newspaper, color: "#00d4ff" },
  { value: "note", label: "Note", icon: StickyNote, color: "#fbbf24" },
];

function loadState() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || null; } catch { return null; }
}

const DEFAULT = { title: "Untitled Investigation", narrative: "", items: [] };

export default function Workbench() {
  const [state, setState] = useState(() => loadState() || DEFAULT);
  const [draft, setDraft] = useState({ kind: "ioc", value: "", note: "" });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  function addItem(e) {
    e.preventDefault();
    if (!draft.value.trim()) return;
    setState((s) => ({
      ...s,
      items: [...s.items, { id: Date.now(), ...draft, value: draft.value.trim(), note: draft.note.trim() }],
    }));
    setDraft({ kind: draft.kind, value: "", note: "" });
  }

  function removeItem(id) {
    setState((s) => ({ ...s, items: s.items.filter((i) => i.id !== id) }));
  }

  function buildMarkdown() {
    const lines = [`# ${state.title}`, "", state.narrative || "_No narrative written._", "", "## Evidence", ""];
    if (state.items.length === 0) lines.push("_No evidence pinned._");
    for (const it of state.items) {
      lines.push(`- **[${it.kind}]** \`${it.value}\`${it.note ? ` , ${it.note}` : ""}`);
    }
    lines.push("", `_Exported ${new Date().toLocaleString()} from CTI Platform._`);
    return lines.join("\n");
  }

  function exportMarkdown() {
    const blob = new Blob([buildMarkdown()], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${state.title.replace(/[^a-z0-9]+/gi, "_").toLowerCase()}.md`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function clearAll() {
    if (confirm("Clear the workbench? This wipes the title, narrative, and all pinned evidence.")) {
      setState(DEFAULT);
    }
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <NotebookPen size={22} className="text-cti-green" />
          <h1 className="text-xl font-semibold text-gray-100">Analyst Workbench</h1>
        </div>
        <div className="flex gap-2">
          <button onClick={exportMarkdown}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cti-blue/10 text-cti-blue border border-cti-blue/20 hover:bg-cti-blue/20 text-xs">
            <FileDown size={13} /> Export .md
          </button>
          <button onClick={() => window.print()}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cti-green/10 text-cti-green border border-cti-green/20 hover:bg-cti-green/20 text-xs">
            <Printer size={13} /> Print
          </button>
          <button onClick={clearAll}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-gray-500 border border-cti-border hover:text-red-400 text-xs">
            <Trash2 size={13} /> Clear
          </button>
        </div>
      </div>

      <p className="text-[11px] text-gray-600 print:hidden">
        Autosaved locally in your browser. Build a narrative, pin evidence, and export a structured report.
      </p>

      <input value={state.title} onChange={(e) => setState({ ...state, title: e.target.value })}
        className="w-full bg-transparent font-display text-2xl font-bold text-white focus:outline-none border-b border-cti-border pb-2" />

      <textarea value={state.narrative} onChange={(e) => setState({ ...state, narrative: e.target.value })}
        rows={8} placeholder="Write your investigation narrative here…"
        className="w-full bg-cti-surface border border-cti-border rounded-xl px-4 py-3 text-sm text-gray-200 leading-relaxed focus:outline-none focus:border-cti-green/40" />

      {/* Evidence */}
      <div className="bg-cti-surface border border-cti-border rounded-xl overflow-hidden">
        <div className="px-5 py-3 border-b border-cti-border text-xs font-semibold text-gray-400 uppercase tracking-wider">
          Pinned Evidence ({state.items.length})
        </div>
        <form onSubmit={addItem} className="px-5 py-3 border-b border-cti-border flex flex-wrap gap-2 print:hidden">
          <select value={draft.kind} onChange={(e) => setDraft({ ...draft, kind: e.target.value })}
            className="bg-cti-bg border border-cti-border rounded-lg px-2.5 py-1.5 text-xs text-gray-200 focus:outline-none">
            {KINDS.map((k) => <option key={k.value} value={k.value}>{k.label}</option>)}
          </select>
          <input value={draft.value} onChange={(e) => setDraft({ ...draft, value: e.target.value })}
            placeholder="value / title / note text"
            className="flex-1 min-w-[160px] bg-cti-bg border border-cti-border rounded-lg px-3 py-1.5 text-xs text-gray-200 focus:outline-none focus:border-cti-green/50" />
          <input value={draft.note} onChange={(e) => setDraft({ ...draft, note: e.target.value })}
            placeholder="annotation (optional)"
            className="flex-1 min-w-[140px] bg-cti-bg border border-cti-border rounded-lg px-3 py-1.5 text-xs text-gray-200 focus:outline-none focus:border-cti-green/50" />
          <button type="submit" className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-cti-green/10 text-cti-green border border-cti-green/20 text-xs hover:bg-cti-green/20">
            <Plus size={13} /> Pin
          </button>
        </form>
        {state.items.length === 0 ? (
          <div className="p-8 text-center text-gray-600 text-sm">No evidence pinned yet.</div>
        ) : (
          <div className="divide-y divide-cti-border">
            {state.items.map((it) => {
              const k = KINDS.find((x) => x.value === it.kind) || KINDS[2];
              return (
                <div key={it.id} className="px-5 py-2.5 flex items-center gap-3">
                  <k.icon size={14} style={{ color: k.color }} className="flex-shrink-0" />
                  <span className="text-[10px] uppercase text-gray-500 w-12 flex-shrink-0">{k.label}</span>
                  <span className="text-xs font-mono text-gray-200 truncate flex-1">{it.value}</span>
                  {it.note && <span className="text-xs text-gray-500 truncate max-w-[40%]">{it.note}</span>}
                  <button onClick={() => removeItem(it.id)} className="text-gray-600 hover:text-red-400 print:hidden">
                    <Trash2 size={13} />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
