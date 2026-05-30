import { useState, useRef, useEffect } from "react";
import { Link } from "react-router-dom";
import { askChat } from "../api/client";
import { MessageSquare, Send, Shield, Newspaper, Sparkles } from "lucide-react";

const SUGGESTIONS = [
  "Show me critical IP IOCs from the last 7 days",
  "How many ransomware articles this week?",
  "Show domains about phishing",
  "Articles mentioning lockbit",
];

export default function Chatbot() {
  const [messages, setMessages] = useState([
    { role: "bot", text: "Ask me about your collected intelligence, e.g. \"show me high-score domains from the last 48 hours\" or \"how many phishing articles this week\"." },
  ]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const endRef = useRef(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  async function send(text) {
    const q = (text ?? input).trim();
    if (!q || busy) return;
    setInput("");
    setMessages((m) => [...m, { role: "user", text: q }]);
    setBusy(true);
    try {
      const res = await askChat(q);
      setMessages((m) => [...m, { role: "bot", text: res.answer, interpreted: res.interpreted, results: res.results }]);
    } catch (e) {
      setMessages((m) => [...m, { role: "bot", text: `Error: ${e.message}` }]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="max-w-3xl mx-auto flex flex-col h-[calc(100vh-3rem)]">
      <div className="flex items-center gap-3 mb-4">
        <MessageSquare size={22} className="text-cti-green" />
        <h1 className="text-xl font-semibold text-gray-100">Threat Intel Assistant</h1>
        <span className="text-[10px] text-gray-600 bg-cti-surface border border-cti-border px-2 py-0.5 rounded-full">rule-based · offline</span>
      </div>

      <div className="flex-1 overflow-y-auto space-y-4 pr-1">
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[85%] rounded-xl px-4 py-3 ${
              m.role === "user"
                ? "bg-cti-green/15 border border-cti-green/30 text-gray-100"
                : "bg-cti-surface border border-cti-border text-gray-200"}`}>
              {m.role === "bot" && m.interpreted && (
                <div className="text-[10px] text-cti-amber mb-1.5 flex items-center gap-1">
                  <Sparkles size={10} /> interpreted as: {m.interpreted}
                </div>
              )}
              <p className="text-sm">{m.text}</p>
              {m.results?.length > 0 && (
                <div className="mt-3 space-y-1.5 border-t border-cti-border pt-2">
                  {m.results.map((r) => (
                    <div key={`${r.kind}-${r.id}`} className="flex items-center gap-2 text-xs">
                      {r.kind === "ioc"
                        ? <Shield size={12} className="text-cti-green flex-shrink-0" />
                        : <Newspaper size={12} className="text-cti-blue flex-shrink-0" />}
                      {r.kind === "article" ? (
                        <Link to={`/read/${r.id}`} className="text-gray-300 hover:text-cti-blue truncate flex-1">{r.primary}</Link>
                      ) : (
                        <span className="font-mono text-gray-300 truncate flex-1">{r.primary}</span>
                      )}
                      <span className="text-gray-600 flex-shrink-0">{r.secondary}</span>
                      {r.score != null && <span className="text-cti-amber flex-shrink-0">{r.score}</span>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
        <div ref={endRef} />
      </div>

      {/* Suggestions */}
      <div className="flex flex-wrap gap-2 my-3">
        {SUGGESTIONS.map((s) => (
          <button key={s} onClick={() => send(s)} disabled={busy}
            className="text-[11px] px-2.5 py-1 rounded-full bg-cti-surface border border-cti-border text-gray-400 hover:text-cti-green hover:border-cti-green/30 disabled:opacity-50">
            {s}
          </button>
        ))}
      </div>

      <form onSubmit={(e) => { e.preventDefault(); send(); }} className="flex gap-2">
        <input value={input} onChange={(e) => setInput(e.target.value)} disabled={busy}
          placeholder="Ask about IOCs or articles…"
          className="flex-1 bg-cti-surface border border-cti-border rounded-lg px-4 py-2.5 text-sm text-gray-200 focus:outline-none focus:border-cti-green/40" />
        <button type="submit" disabled={busy || !input.trim()}
          className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-cti-green/10 text-cti-green border border-cti-green/20 hover:bg-cti-green/20 text-sm disabled:opacity-50">
          <Send size={15} /> {busy ? "…" : "Ask"}
        </button>
      </form>
    </div>
  );
}
