// Shared UI components — no JSX, using React.createElement (aliased as h)
const h = React.createElement;

// ── SVG Icons (inline, no lucide dependency) ─────────────────────────
function Icon({ d, size = 18, className = '' }) {
  return h('svg', {
    width: size, height: size, viewBox: '0 0 24 24',
    fill: 'none', stroke: 'currentColor', strokeWidth: 2,
    strokeLinecap: 'round', strokeLinejoin: 'round',
    className
  }, h('path', { d }));
}

const Icons = {
  Dashboard:  (p) => Icon({ d: 'M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z M9 22V12h6v10', ...p }),
  Newspaper:  (p) => Icon({ d: 'M4 22h16a2 2 0 002-2V4a2 2 0 00-2-2H8a2 2 0 00-2 2v16a2 2 0 01-2 2zm0 0a2 2 0 01-2-2v-9c0-1.1.9-2 2-2h2 M18 14h-8 M15 18h-5 M10 6h8v4h-8z', ...p }),
  Shield:     (p) => Icon({ d: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z', ...p }),
  Refresh:    (p) => Icon({ d: 'M23 4v6h-6 M1 20v-6h6 M3.51 9a9 9 0 0114.85-3.36L23 10 M1 14l4.64 4.36A9 9 0 0020.49 15', ...p }),
  Search:     (p) => Icon({ d: 'M11 19a8 8 0 100-16 8 8 0 000 16z M21 21l-4.35-4.35', ...p }),
  Star:       (p) => Icon({ d: 'M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z', ...p }),
  ExternalLink:(p)=> Icon({ d: 'M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6 M15 3h6v6 M10 14L21 3', ...p }),
  Filter:     (p) => Icon({ d: 'M22 3H2l8 9.46V19l4 2v-8.54L22 3z', ...p }),
  Activity:   (p) => Icon({ d: 'M22 12h-4l-3 9L9 3l-3 9H2', ...p }),
  XCircle:    (p) => Icon({ d: 'M12 22a10 10 0 100-20 10 10 0 000 20z M15 9l-6 6 M9 9l6 6', ...p }),
  AlertTri:   (p) => Icon({ d: 'M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z M12 9v4 M12 17h.01', ...p }),
  Globe:      (p) => Icon({ d: 'M12 22a10 10 0 100-20 10 10 0 000 20z M2 12h20 M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z', ...p }),
  Server:     (p) => Icon({ d: 'M2 2h20v8H2z M2 14h20v8H2z M6 6h.01 M6 18h.01', ...p }),
  Settings:   (p) => Icon({ d: 'M12 15a3 3 0 100-6 3 3 0 000 6z M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z', ...p }),
  Zap:        (p) => Icon({ d: 'M13 2L3 14h9l-1 10 10-12h-9l1-10z', ...p }),
  Database:   (p) => Icon({ d: 'M12 2C6.48 2 2 4.02 2 6.5v11C2 19.98 6.48 22 12 22s10-2.02 10-4.5v-11C22 4.02 17.52 2 12 2z M2 6.5C2 8.98 6.48 11 12 11s10-2.02 10-4.5 M2 12c0 2.48 4.48 4.5 10 4.5s10-2.02 10-4.5', ...p }),
};


// ── Stat Card ────────────────────────────────────────────────────────
function StatCard({ label, value, color = '#00ff87' }) {
  return h('div', { className: 'bg-cti-surface rounded-xl border border-cti-border p-4' },
    h('div', { className: 'text-[11px] text-gray-500 uppercase tracking-wider mb-1' }, label),
    h('div', { className: 'text-2xl font-display font-bold', style: { color } },
      typeof value === 'number' ? value.toLocaleString() : value
    )
  );
}


// ── Simple client-side router ────────────────────────────────────────
function useRouter() {
  const [path, setPath] = React.useState(window.location.hash.slice(1) || '/');

  React.useEffect(() => {
    const handler = () => setPath(window.location.hash.slice(1) || '/');
    window.addEventListener('hashchange', handler);
    return () => window.removeEventListener('hashchange', handler);
  }, []);

  const navigate = (to) => { window.location.hash = to; };
  return { path, navigate };
}


// ── Nav Link ─────────────────────────────────────────────────────────
function NavItem({ to, icon, label, currentPath, navigate }) {
  const isActive = currentPath === to;
  return h('a', {
    href: '#' + to,
    onClick: (e) => { e.preventDefault(); navigate(to); },
    className: `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
      isActive
        ? 'bg-cti-green/10 text-cti-green border border-cti-green/20'
        : 'text-gray-400 hover:bg-white/5 hover:text-gray-200 border border-transparent'
    }`
  },
    h(icon, { size: 18 }),
    label
  );
}
