import { useState, useEffect, useMemo, useCallback } from "react";
import { getIOCGraph } from "../api/client";
import { Share2, RefreshCw } from "lucide-react";

const W = 820;
const H = 580;

function familyColor(family) {
  if (!family) return "#6b7280";
  let h = 0;
  for (const ch of family) h = (h * 31 + ch.charCodeAt(0)) % 360;
  return `hsl(${h}, 65%, 60%)`;
}

// Fruchterman-Reingold style force layout, run once to convergence.
function computeLayout(nodes, edges, iterations = 320) {
  const n = nodes.length;
  const pos = {};
  if (n === 0) return pos;
  nodes.forEach((nd, idx) => {
    const a = (2 * Math.PI * idx) / n;
    pos[nd.id] = {
      x: W / 2 + Math.cos(a) * (W / 4) + (Math.random() - 0.5) * 8,
      y: H / 2 + Math.sin(a) * (H / 4) + (Math.random() - 0.5) * 8,
    };
  });
  const ids = nodes.map((d) => d.id);
  const k = Math.sqrt((W * H) / n) * 0.78;
  let temp = W / 8;

  for (let it = 0; it < iterations; it++) {
    const disp = {};
    ids.forEach((id) => (disp[id] = { x: 0, y: 0 }));

    for (let a = 0; a < n; a++) {
      for (let b = a + 1; b < n; b++) {
        const ia = ids[a], ib = ids[b];
        let dx = pos[ia].x - pos[ib].x;
        let dy = pos[ia].y - pos[ib].y;
        let dist = Math.sqrt(dx * dx + dy * dy) || 0.01;
        const rep = (k * k) / dist;
        const ux = dx / dist, uy = dy / dist;
        disp[ia].x += ux * rep; disp[ia].y += uy * rep;
        disp[ib].x -= ux * rep; disp[ib].y -= uy * rep;
      }
    }
    edges.forEach((e) => {
      const s = pos[e.source], t = pos[e.target];
      if (!s || !t) return;
      let dx = s.x - t.x, dy = s.y - t.y;
      let dist = Math.sqrt(dx * dx + dy * dy) || 0.01;
      const att = (dist * dist) / k;
      const ux = dx / dist, uy = dy / dist;
      disp[e.source].x -= ux * att; disp[e.source].y -= uy * att;
      disp[e.target].x += ux * att; disp[e.target].y += uy * att;
    });
    ids.forEach((id) => {
      const d = disp[id];
      const dl = Math.sqrt(d.x * d.x + d.y * d.y) || 0.01;
      pos[id].x += (d.x / dl) * Math.min(dl, temp);
      pos[id].y += (d.y / dl) * Math.min(dl, temp);
      pos[id].x = Math.max(24, Math.min(W - 24, pos[id].x));
      pos[id].y = Math.max(24, Math.min(H - 24, pos[id].y));
    });
    temp *= 0.969;
  }
  return pos;
}

export default function CorrelationGraph() {
  const [data, setData] = useState({ nodes: [], edges: [] });
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try { setData(await getIOCGraph(80)); setSelected(null); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const pos = useMemo(() => computeLayout(data.nodes, data.edges), [data]);

  const neighbors = useMemo(() => {
    if (selected == null) return new Set();
    const s = new Set();
    data.edges.forEach((e) => {
      if (e.source === selected) s.add(e.target);
      if (e.target === selected) s.add(e.source);
    });
    return s;
  }, [selected, data.edges]);

  const nodeById = useMemo(
    () => Object.fromEntries(data.nodes.map((n) => [n.id, n])), [data.nodes]
  );
  const selectedNode = selected != null ? nodeById[selected] : null;

  function isActive(id) {
    return selected == null || id === selected || neighbors.has(id);
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Share2 size={22} className="text-cti-green" />
          <h1 className="text-xl font-semibold text-gray-100">IOC Correlation Graph</h1>
          <span className="text-xs text-gray-500 bg-cti-surface border border-cti-border px-2 py-0.5 rounded-full">
            {data.node_count ?? 0} nodes · {data.edge_count ?? 0} links
          </span>
        </div>
        <button onClick={load}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-cti-purple/10 text-cti-purple border border-cti-purple/20 hover:bg-cti-purple/20 transition-colors text-sm">
          <RefreshCw size={15} className={loading ? "animate-spin" : ""} /> Recompute
        </button>
      </div>

      <p className="text-xs text-gray-500">
        IOCs linked by shared malware family (gray) or shared campaign (blue). Click a node to isolate its neighbours.
      </p>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-5">
        <div className="lg:col-span-3 bg-cti-surface border border-cti-border rounded-xl overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center" style={{ height: H }}>
              <span className="text-gray-500 text-sm">Computing layout…</span>
            </div>
          ) : data.nodes.length === 0 ? (
            <div className="flex items-center justify-center text-center px-8" style={{ height: H }}>
              <span className="text-gray-500 text-sm">
                No correlations found yet. IOCs link up once feeds bring in shared malware families,
                or once you group them into campaigns.
              </span>
            </div>
          ) : (
            <svg viewBox={`0 0 ${W} ${H}`} className="w-full" onClick={() => setSelected(null)}>
              {data.edges.map((e, i) => {
                const s = pos[e.source], t = pos[e.target];
                if (!s || !t) return null;
                const active = selected == null ||
                  e.source === selected || e.target === selected;
                return (
                  <line key={i} x1={s.x} y1={s.y} x2={t.x} y2={t.y}
                    stroke={e.kind === "campaign" ? "#00d4ff" : "#3a3a4a"}
                    strokeWidth={e.kind === "campaign" ? 1.4 : 0.8}
                    strokeOpacity={active ? 0.7 : 0.08} />
                );
              })}
              {data.nodes.map((nd) => {
                const p = pos[nd.id];
                if (!p) return null;
                const r = 5 + (nd.score || 0) / 11;
                const active = isActive(nd.id);
                const isSel = nd.id === selected;
                return (
                  <g key={nd.id} style={{ cursor: "pointer" }}
                    onClick={(ev) => { ev.stopPropagation(); setSelected(nd.id); }}>
                    <circle cx={p.x} cy={p.y} r={r}
                      fill={familyColor(nd.family)}
                      fillOpacity={active ? 0.9 : 0.18}
                      stroke={isSel ? "#fff" : "#0a0a0f"}
                      strokeWidth={isSel ? 2 : 1} />
                    {(isSel || (selected != null && neighbors.has(nd.id))) && (
                      <text x={p.x + r + 3} y={p.y + 3} fontSize="9" fill="#cbd5e1"
                        className="font-mono pointer-events-none">{nd.label}</text>
                    )}
                  </g>
                );
              })}
            </svg>
          )}
        </div>

        <div className="bg-cti-surface border border-cti-border rounded-xl p-4">
          {selectedNode ? (
            <div className="space-y-3">
              <div className="text-[10px] text-gray-500 uppercase tracking-wider">Selected IOC</div>
              <div className="font-mono text-xs text-gray-200 break-all">{selectedNode.label}</div>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full" style={{ background: familyColor(selectedNode.family) }} />
                <span className="text-xs text-cti-pink">{selectedNode.family || "no family"}</span>
              </div>
              <div className="text-xs text-gray-500">type: <span className="text-gray-300">{selectedNode.ioc_type}</span></div>
              <div className="text-xs text-gray-500">score: <span className="text-cti-amber">{selectedNode.score}</span></div>
              <div className="text-xs text-gray-500">{neighbors.size} connected IOC{neighbors.size === 1 ? "" : "s"}</div>
            </div>
          ) : (
            <div className="text-sm text-gray-500">
              Click any node to inspect it and isolate its connections. Node size reflects threat score; colour groups malware families.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
