// Error boundary to catch render crashes
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, info) {
    console.error('CTI App Error:', error, info);
  }
  render() {
    if (this.state.hasError) {
      return h('div', { style: { padding: 40, color: '#ff6b6b', fontFamily: 'monospace' } },
        h('h2', null, 'Something went wrong'),
        h('pre', { style: { color: '#aaa', fontSize: 12, marginTop: 10 } },
          this.state.error && this.state.error.toString())
      );
    }
    return this.props.children;
  }
}

// Sidebar section header
function SidebarSection(props) {
  return h('div', { className: 'pt-5 pb-1.5 px-3' },
    h('span', { className: 'text-[10px] font-semibold uppercase tracking-[2px] text-gray-600' }, props.label)
  );
}

// Sidebar action button (Poll, Sync, etc.)
function SidebarAction(props) {
  var _s = React.useState(false);
  var busy = _s[0], setBusy = _s[1];

  var handleClick = async function() {
    if (busy) return;
    setBusy(true);
    try { await props.action(); }
    catch(e) { console.error(e); }
    finally { setBusy(false); }
  };

  return h('button', {
    onClick: handleClick,
    disabled: busy,
    className: 'w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ' +
      'text-gray-400 hover:bg-white/5 hover:text-gray-200 border border-transparent disabled:opacity-50'
  },
    h(props.icon, { size: 16, className: busy ? 'animate-spin' : '' }),
    busy ? props.busyLabel : props.label
  );
}

// Main App
function App() {
  var router = useRouter();
  var path = router.path;
  var navigate = router.navigate;

  // Determine which page to render
  var PageComponent;
  switch (path) {
    case '/feed':    PageComponent = NewsFeedPage;    break;
    case '/iocs':    PageComponent = IOCExplorerPage;  break;
    case '/kev':     PageComponent = KEVPage;          break;
    case '/ip':      PageComponent = IPIntelPage;      break;
    case '/domain':  PageComponent = DomainRepPage;    break;
    case '/settings':PageComponent = SettingsPage;     break;
    default:         PageComponent = DashboardPage;    break;
  }

  return h('div', { className: 'flex h-screen overflow-hidden' },

    // ── Sidebar ──────────────────────────────────────────────────────
    h('aside', { className: 'w-56 flex-shrink-0 bg-cti-surface border-r border-cti-border flex flex-col' },

      // Logo / Branding
      h('div', { className: 'p-5 border-b border-cti-border' },
        h('div', { className: 'flex items-center gap-2 mb-1' },
          h('div', { className: 'w-2.5 h-2.5 rounded-full bg-cti-green shadow-[0_0_12px_#00ff8766] animate-pulse-dot' }),
          h('span', { className: 'text-[10px] text-gray-500 tracking-[3px] uppercase' }, 'Active')
        ),
        h('h1', { className: 'font-display text-lg font-bold', style: {
          background: 'linear-gradient(to right, #00ff87, #00d4ff)',
          WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent'
        }}, 'CTI Platform')
      ),

      // Scrollable nav area
      h('nav', { className: 'flex-1 overflow-y-auto px-3 pb-3' },

        // OVERVIEW
        h(SidebarSection, { label: 'Overview' }),
        h(NavItem, { to:'/', icon:Icons.Dashboard, label:'Dashboard', currentPath:path, navigate: navigate }),

        // FEEDS
        h(SidebarSection, { label: 'Feeds' }),
        h(NavItem, { to:'/feed', icon:Icons.Newspaper, label:'News Feed', currentPath:path, navigate: navigate }),
        h(NavItem, { to:'/iocs', icon:Icons.Shield, label:'IOC Explorer', currentPath:path, navigate: navigate }),

        // THREAT INTEL
        h(SidebarSection, { label: 'Threat Intel' }),
        h(NavItem, { to:'/kev', icon:Icons.AlertTri, label:'KEV Catalog', currentPath:path, navigate: navigate }),

        // REPUTATION
        h(SidebarSection, { label: 'Reputation' }),
        h(NavItem, { to:'/ip', icon:Icons.Server, label:'IP Intelligence', currentPath:path, navigate: navigate }),
        h(NavItem, { to:'/domain', icon:Icons.Globe, label:'Domain Rep', currentPath:path, navigate: navigate }),

        // ACTIONS
        h(SidebarSection, { label: 'Actions' }),
        h(SidebarAction, {
          icon: Icons.Refresh,
          label: 'Poll Feeds',
          busyLabel: 'Polling...',
          action: function() { return Promise.all([API.pollFeeds(), API.pollIOCs()]); }
        }),
        h(SidebarAction, {
          icon: Icons.Zap,
          label: 'Sync KEV',
          busyLabel: 'Syncing...',
          action: function() { return API.syncKEV(); }
        }),

        // SYSTEM
        h(SidebarSection, { label: 'System' }),
        h(NavItem, { to:'/settings', icon:Icons.Settings, label:'Settings', currentPath:path, navigate: navigate })
      ),

      // Footer
      h('div', { className: 'p-4 border-t border-cti-border' },
        h('div', { className: 'flex items-center gap-2 text-gray-500 text-xs' },
          h(Icons.Activity, { size: 14 }),
          h('span', null, 'v0.2.0')
        )
      )
    ),

    // ── Main content ─────────────────────────────────────────────────
    h('main', { className: 'flex-1 overflow-y-auto bg-cti-bg p-6' },
      h(ErrorBoundary, null, h(PageComponent))
    )
  );
}

// Mount the app
try {
  ReactDOM.createRoot(document.getElementById('root')).render(
    h(ErrorBoundary, null, h(App))
  );
  console.log('CTI Platform v0.2.0 mounted successfully');
} catch (e) {
  console.error('Failed to mount CTI app:', e);
  document.getElementById('root').innerHTML =
    '<div style="padding:40px;color:#ff6b6b;font-family:monospace">' +
    '<h2>Startup Error</h2><pre>' + e.toString() + '</pre></div>';
}
