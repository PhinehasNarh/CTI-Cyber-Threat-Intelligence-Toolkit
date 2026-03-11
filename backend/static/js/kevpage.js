// KEV Catalog page
function KEVPage() {
  var _s = React.useState, _e = React.useEffect;
  var _1 = _s([]), kevs = _1[0], setKEVs = _1[1];
  var _2 = _s(null), stats = _2[0], setStats = _2[1];
  var _3 = _s(true), loading = _3[0], setLoading = _3[1];
  var _4 = _s(false), syncing = _4[0], setSyncing = _4[1];
  var _5 = _s(''), search = _5[0], setSearch = _5[1];

  var fetchData = async function() {
    try {
      var params = { limit: '100' };
      if (search) params.search = search;
      var results = await Promise.all([API.getKEVs(params), API.getKEVStats()]);
      setKEVs(results[0].cves);
      setStats(results[1]);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  _e(function() { fetchData(); }, []);
  _e(function() {
    var t = setTimeout(function() { fetchData(); }, 300);
    return function() { clearTimeout(t); };
  }, [search]);

  var handleSync = async function() {
    setSyncing(true);
    try { await API.syncKEV(); await fetchData(); }
    finally { setSyncing(false); }
  };

  var sevColor = function(s) {
    if (!s) return '#666';
    var sl = s.toLowerCase();
    if (sl === 'known') return '#ef4444';
    if (sl === 'critical') return '#ef4444';
    if (sl === 'high') return '#fb923c';
    if (sl === 'medium') return '#fbbf24';
    return '#00ff87';
  };

  if (loading) return h('div', { className:'flex items-center justify-center h-64 text-gray-500' }, 'Loading KEV catalog...');

  return h('div', { className:'max-w-5xl' },
    h('div', { className:'flex items-center justify-between mb-6' },
      h('div', null,
        h('h1', { className:'font-display text-2xl font-bold text-white' }, 'KEV Catalog'),
        h('p', { className:'text-sm text-gray-500 mt-1' }, 'CISA Known Exploited Vulnerabilities')
      ),
      h('button', {
        onClick: handleSync, disabled: syncing,
        className:'flex items-center gap-2 px-4 py-2 rounded-lg bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 transition-colors text-sm disabled:opacity-50'
      }, h(Icons.Refresh, { size:16, className: syncing ? 'animate-spin' : '' }),
         syncing ? 'Syncing...' : 'Sync KEV')
    ),

    // Stats
    stats && h('div', { className:'grid grid-cols-2 md:grid-cols-4 gap-3 mb-4' },
      h(StatCard, { label:'Total KEVs', value: stats.total, color:'#ef4444' }),
      Object.entries(stats.by_severity || {}).slice(0,3).map(function(entry) {
        return h(StatCard, { key: entry[0], label: entry[0], value: entry[1], color: sevColor(entry[0]) });
      })
    ),

    // Search
    h('div', { className:'relative mb-4' },
      h('div', { className:'absolute left-3 top-1/2 -translate-y-1/2 text-gray-500' }, h(Icons.Search, { size:16 })),
      h('input', {
        type:'text', placeholder:'Search CVEs, products, descriptions...', value: search,
        onChange: function(e) { setSearch(e.target.value); },
        className:'w-full pl-10 pr-4 py-2.5 rounded-lg bg-cti-surface border border-cti-border text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-red-400/40'
      })
    ),

    // Table
    h('div', { className:'bg-cti-surface rounded-xl border border-cti-border overflow-hidden' },
      h('table', { className:'w-full text-sm' },
        h('thead', null,
          h('tr', { className:'border-b border-cti-border text-left' },
            ['CVE ID','Description','Affected Product','Ransomware Use','Date Added'].map(function(col) {
              return h('th', { key:col, className:'px-4 py-3 text-xs text-gray-500 font-medium' }, col);
            })
          )
        ),
        h('tbody', { className:'divide-y divide-cti-border' },
          kevs.map(function(c) {
            return h('tr', { key:c.id, className:'hover:bg-white/[0.02] transition-colors' },
              h('td', { className:'px-4 py-2.5' },
                h('span', { className:'text-cti-blue font-mono text-xs font-semibold' }, c.cve_id)
              ),
              h('td', { className:'px-4 py-2.5 text-xs text-gray-400 max-w-[300px] truncate' }, c.description || '\u2014'),
              h('td', { className:'px-4 py-2.5 text-xs text-gray-300' }, c.affected_products || '\u2014'),
              h('td', { className:'px-4 py-2.5' },
                h('span', {
                  className:'text-[10px] px-2 py-0.5 rounded-full border',
                  style: { color: sevColor(c.severity), borderColor: sevColor(c.severity)+'44', background: sevColor(c.severity)+'11' }
                }, c.severity || 'Unknown')
              ),
              h('td', { className:'px-4 py-2.5 text-xs text-gray-500' },
                c.published_date ? new Date(c.published_date).toLocaleDateString() : '\u2014')
            );
          })
        )
      ),
      kevs.length === 0 && h('div', { className:'p-12 text-center text-gray-500 text-sm' },
        'No KEVs loaded. Click "Sync KEV" to fetch the CISA catalog.')
    )
  );
}
