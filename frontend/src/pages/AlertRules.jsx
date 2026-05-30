import { useState, useEffect } from "react";
import {
  getAlertRules, createAlertRule, toggleAlertRule, deleteAlertRule, getAlertHits,
} from "../api/client";
import { Bell, Plus, Trash2, ToggleLeft, ToggleRight, AlertTriangle, CheckCircle } from "lucide-react";

const SEV_STYLES = {
  critical: "text-red-400 bg-red-400/10 border-red-400/30",
  high:     "text-orange-400 bg-orange-400/10 border-orange-400/30",
  medium:   "text-yellow-400 bg-yellow-400/10 border-yellow-400/30",
  low:      "text-gray-400 bg-gray-400/10 border-gray-400/20",
};

const IOC_TYPES = ["hash", "ip", "domain", "url"];
const SOURCES   = ["malwarebazaar", "urlhaus", "threatfox", "manual"];

const EMPTY_FORM = {
  name: "",
  severity: "high",
  ioc_types: [],
  sources: [],
  keywords: "",
  min_confidence: 0,
  min_score: 0,
  webhook_url: "",
};

function Toggle({ checked, onToggle }) {
  return checked
    ? <ToggleRight size={20} className="text-cti-green cursor-pointer" onClick={onToggle} />
    : <ToggleLeft  size={20} className="text-gray-500 cursor-pointer"   onClick={onToggle} />;
}

function MultiCheck({ options, selected, onChange }) {
  const toggle = (v) =>
    onChange(selected.includes(v) ? selected.filter((x) => x !== v) : [...selected, v]);
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((o) => (
        <button
          key={o}
          type="button"
          onClick={() => toggle(o)}
          className={`text-xs px-2 py-0.5 rounded border transition-colors ${
            selected.includes(o)
              ? "bg-cti-green/20 border-cti-green/50 text-cti-green"
              : "border-cti-border text-gray-400 hover:border-gray-500"
          }`}
        >
          {o}
        </button>
      ))}
    </div>
  );
}

export default function AlertRules() {
  const [rules, setRules]   = useState([]);
  const [hits, setHits]     = useState([]);
  const [count, setCount]   = useState(0);
  const [loading, setLoading] = useState(true);
  const [form, setForm]     = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [err, setErr]       = useState("");

  async function load() {
    setLoading(true);
    try {
      const [r, h] = await Promise.all([getAlertRules(), getAlertHits(50)]);
      setRules(r.rules ?? []);
      setHits(h.hits ?? []);
      setCount(h.count ?? 0);
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
      await createAlertRule({
        ...form,
        keywords: form.keywords ? form.keywords.split(",").map((s) => s.trim()).filter(Boolean) : [],
        min_confidence: Number(form.min_confidence),
        min_score: Number(form.min_score),
      });
      setForm(EMPTY_FORM);
      await load();
    } catch (e) {
      setErr(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleToggle(id, cur) {
    await toggleAlertRule(id, !cur);
    setRules((prev) => prev.map((r) => r.id === id ? { ...r, is_active: !cur } : r));
  }

  async function handleDelete(id) {
    if (!confirm("Delete this alert rule?")) return;
    await deleteAlertRule(id);
    setRules((prev) => prev.filter((r) => r.id !== id));
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Bell size={22} className="text-cti-green" />
        <h1 className="text-xl font-semibold text-gray-100">Alert Rules</h1>
        <span className="text-xs text-gray-500 bg-cti-surface border border-cti-border px-2 py-0.5 rounded-full">
          {rules.length} rules · {count} hits
        </span>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Rule builder */}
        <div className="xl:col-span-1 bg-cti-surface border border-cti-border rounded-xl p-5">
          <h2 className="text-sm font-semibold text-gray-300 mb-4 flex items-center gap-2">
            <Plus size={14} /> New Rule
          </h2>
          <form onSubmit={handleCreate} className="space-y-4">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Rule name *</label>
              <input
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full bg-cti-bg border border-cti-border rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-cti-green/50"
                placeholder="e.g. High-score IPs"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Severity</label>
              <select
                value={form.severity}
                onChange={(e) => setForm({ ...form, severity: e.target.value })}
                className="w-full bg-cti-bg border border-cti-border rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-cti-green/50"
              >
                {["critical", "high", "medium", "low"].map((s) => (
                  <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">IOC types (any if empty)</label>
              <MultiCheck options={IOC_TYPES} selected={form.ioc_types}
                onChange={(v) => setForm({ ...form, ioc_types: v })} />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Sources (any if empty)</label>
              <MultiCheck options={SOURCES} selected={form.sources}
                onChange={(v) => setForm({ ...form, sources: v })} />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Keywords (comma-separated)</label>
              <input
                value={form.keywords}
                onChange={(e) => setForm({ ...form, keywords: e.target.value })}
                className="w-full bg-cti-bg border border-cti-border rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-cti-green/50"
                placeholder="ransomware, cobalt strike"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Min confidence</label>
                <input type="number" min="0" max="100"
                  value={form.min_confidence}
                  onChange={(e) => setForm({ ...form, min_confidence: e.target.value })}
                  className="w-full bg-cti-bg border border-cti-border rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-cti-green/50"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Min score</label>
                <input type="number" min="0" max="100"
                  value={form.min_score}
                  onChange={(e) => setForm({ ...form, min_score: e.target.value })}
                  className="w-full bg-cti-bg border border-cti-border rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-cti-green/50"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Webhook URL (optional)</label>
              <input
                value={form.webhook_url}
                onChange={(e) => setForm({ ...form, webhook_url: e.target.value })}
                className="w-full bg-cti-bg border border-cti-border rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-cti-green/50"
                placeholder="https://hooks.slack.com/..."
              />
            </div>
            {err && <p className="text-xs text-red-400">{err}</p>}
            <button
              type="submit" disabled={saving}
              className="w-full py-2 rounded-lg bg-cti-green/20 border border-cti-green/40 text-cti-green text-sm font-medium hover:bg-cti-green/30 transition-colors disabled:opacity-50"
            >
              {saving ? "Creating…" : "Create Rule"}
            </button>
          </form>
        </div>

        {/* Rules list + hits */}
        <div className="xl:col-span-2 space-y-6">
          {/* Rules list */}
          <div className="bg-cti-surface border border-cti-border rounded-xl overflow-hidden">
            <div className="px-5 py-3 border-b border-cti-border text-xs font-semibold text-gray-400 uppercase tracking-wider">
              Configured Rules
            </div>
            {loading ? (
              <div className="p-8 text-center text-gray-500 text-sm">Loading…</div>
            ) : rules.length === 0 ? (
              <div className="p-8 text-center text-gray-500 text-sm">No rules yet — create one on the left.</div>
            ) : (
              <div className="divide-y divide-cti-border">
                {rules.map((r) => (
                  <div key={r.id} className="px-5 py-4 flex items-start gap-4">
                    <Toggle checked={r.is_active} onToggle={() => handleToggle(r.id, r.is_active)} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium text-gray-200">{r.name}</span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded border font-medium ${SEV_STYLES[r.severity] ?? SEV_STYLES.low}`}>
                          {r.severity}
                        </span>
                        {r.hit_count > 0 && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-cti-green/10 border border-cti-green/20 text-cti-green">
                            {r.hit_count} hits
                          </span>
                        )}
                      </div>
                      <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-gray-500">
                        {r.ioc_types?.length > 0 && <span>types: {r.ioc_types.join(", ")}</span>}
                        {r.sources?.length > 0 && <span>sources: {r.sources.join(", ")}</span>}
                        {r.keywords?.length > 0 && <span>keywords: {r.keywords.join(", ")}</span>}
                        {r.min_score > 0 && <span>min score: {r.min_score}</span>}
                        {r.webhook_url && <span className="text-cti-blue truncate max-w-xs">{r.webhook_url}</span>}
                      </div>
                    </div>
                    <button onClick={() => handleDelete(r.id)}
                      className="text-gray-600 hover:text-red-400 transition-colors flex-shrink-0">
                      <Trash2 size={15} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Recent hits */}
          <div className="bg-cti-surface border border-cti-border rounded-xl overflow-hidden">
            <div className="px-5 py-3 border-b border-cti-border text-xs font-semibold text-gray-400 uppercase tracking-wider">
              Recent Hits
            </div>
            {hits.length === 0 ? (
              <div className="p-8 text-center text-gray-500 text-sm flex flex-col items-center gap-2">
                <CheckCircle size={24} className="text-gray-600" />
                No hits yet
              </div>
            ) : (
              <div className="divide-y divide-cti-border">
                {hits.map((h) => (
                  <div key={h.id} className="px-5 py-3 flex items-center gap-3">
                    <AlertTriangle size={14} className={
                      h.severity === "critical" ? "text-red-400" :
                      h.severity === "high"     ? "text-orange-400" :
                      h.severity === "medium"   ? "text-yellow-400" : "text-gray-400"
                    } />
                    <span className={`text-[10px] px-1.5 py-0.5 rounded border font-medium flex-shrink-0 ${SEV_STYLES[h.severity] ?? SEV_STYLES.low}`}>
                      {h.severity}
                    </span>
                    <span className="text-xs text-gray-400 flex-shrink-0 w-14">{h.ioc_type}</span>
                    <span className="text-xs text-gray-200 font-mono truncate flex-1">{h.ioc_value}</span>
                    <span className="text-xs text-gray-500 flex-shrink-0">{h.rule_name}</span>
                    <span className="text-xs text-gray-600 flex-shrink-0">{h.hit_at?.slice(0, 10)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
