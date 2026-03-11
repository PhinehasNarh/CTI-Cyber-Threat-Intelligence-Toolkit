// IOC Explorer page component
const TYPE_COLORS = { hash:'#a78bfa', ip:'#00d4ff', domain:'#00ff87', url:'#f472b6', unknown:'#666' };

function EnrichmentCard({ enrichment }) {
  const { source, ...rest } = enrichment;
  return h('div', { className:'bg-cti-bg rounded-lg border border-cti-border p-3' },
    h('div', { className:'text-xs font-semibold text-cti-amber mb-2 uppercase tracking-wider' },
      source.replace(/_/g, ' ')),
    h('div', { className:'space-y-1' },
      Object.entries(rest).map(([key, val]) => {
        if (val === null || val === undefined) return null;
        const display = Array.isArray(val) ? (val.length > 0 ? val.join(', ') : 'none') : String(val);
        return h('div', { key, className:'flex items-start gap-2 text-xs' },
          h('span', { className:'text-gray-500 min-w-[100px]' }, key.replace(/_/g, ' ')),
          h('span', { className:'text-gray-300 break-all' }, display)
        );
      })
    )
  );
}

function IOCExplorerPage() {
  const [iocs, setIOCs] = React.useState([]);
  const [stats, setStats] = React.useState(null);
  const [loading, setLoading] = React.useState(true);
  const [polling, setPolling] = React.useState(false);
  const [lookupValue, setLookupValue] = React.useState('');
  const [lookupResult, setLookupResult] = React.useState(null);
  const [lookupLoading, setLookupLoading] = React.useState(false);
  const [typeFilter, setTypeFilter] = React.useState('');
  const [search, setSearch] = React.useState('');

  const fetchData = async () => {
    try {
      const params = { limit:'100' };
      if (typeFilter) params.ioc_type = typeFilter;
      if (search) params.search = search;
      const [iocData, statsData] = await Promise.all([API.getIOCs(params), API.getIOCStats()]);
      setIOCs(iocData.iocs);
      setStats(statsData);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  React.useEffect(() => { fetchData(); }, []);
  React.useEffect(() => {
    const t = setTimeout(() => fetchData(), 300);
    return () => clearTimeout(t);
  }, [typeFilter, search]);

  const handleLookup = async (e) => {
    e.preventDefault();
    if (!lookupValue.trim()) return;
    setLookupLoading(true); setLookupResult(null);
    try { setLookupResult(await API.lookupIOC(lookupValue.trim())); }
    catch (err) { setLookupResult({ error: err.message }); }
    finally { setLookupLoading(false); }
  };

  const handlePoll = async () => {
    setPolling(true);
    try { await API.pollIOCs(); await fetchData(); }
    finally { setPolling(false); }
  };

  if (loading) return h('div', { className:'flex items-center justify-center h-64 text-gray-500' }, 'Loading IOCs...');

  return h('div', { className:'max-w-5xl' },
    // Header
    h('div', { className:'flex items-center justify-between mb-6' },
      h('div', null,
        h('h1', { className:'font-display text-2xl font-bold text-white' }, 'IOC Explorer'),
        h('p', { className:'text-sm text-gray-500 mt-1' }, 'Search and enrich Indicators of Compromise')
      ),
      h('button', {
        onClick: handlePoll, disabled: polling,
        className:'flex items-center gap-2 px-4 py-2 rounded-lg bg-cti-purple/10 text-cti-purple border border-cti-purple/20 hover:bg-cti-purple/20 transition-colors text-sm disabled:opacity-50'
      }, h(Icons.Refresh, { size:16, className: polling ? 'animate-spin' : '' }),
         polling ? 'Polling...' : 'Poll IOC Feeds')
    ),

    // Lookup box
    h('div', { className:'bg-cti-surface rounded-xl border border-cti-border p-5 mb-6' },
      h('h3', { className:'text-sm font-semibold text-gray-300 mb-3 flex items-center gap-2' },
        h(Icons.Shield, { size:16, className:'text-cti-green' }), 'IOC Lookup'),
      h('form', { onSubmit: handleLookup, className:'flex gap-3' },
        h('div', { className:'flex-1 relative' },
          h('div', { className:'absolute left-3 top-1/2 -translate-y-1/2 text-gray-500' }, h(Icons.Search, { size:16 })),
          h('input', {
            type:'text', placeholder:'Paste a hash, IP, domain, or URL...',
            value: lookupValue, onChange: e => setLookupValue(e.target.value),
            className:'w-full pl-10 pr-4 py-3 rounded-lg bg-cti-bg border border-cti-border text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-cti-green/40 font-mono'
          })
        ),
        h('button', {
          type:'submit', disabled: lookupLoading || !lookupValue.trim(),
          className:'px-6 py-3 rounded-lg bg-cti-green/10 text-cti-green border border-cti-green/20 hover:bg-cti-green/20 transition-colors text-sm font-semibold disabled:opacity-50'
        }, lookupLoading ? 'Looking up...' : 'Enrich')
      ),
      // Results
      lookupResult && h('div', { className:'mt-4' },
        lookupResult.error
          ? h('div', { className:'flex items-center gap-2 text-red-400 text-sm' },
              h(Icons.XCircle, { size:16 }), lookupResult.error)
          : h('div', null,
              h('div', { className:'flex items-center gap-3 mb-3' },
                h('code', { className:'text-sm text-gray-200 break-all' }, lookupResult.value),
                h('span', {
                  className:'text-[10px] px-2 py-0.5 rounded-full border',
                  style: {
                    color: TYPE_COLORS[lookupResult.detected_type] || '#666',
                    borderColor: (TYPE_COLORS[lookupResult.detected_type]||'#666') + '44',
                    background: (TYPE_COLORS[lookupResult.detected_type]||'#666') + '11',
                  }
                }, lookupResult.detected_type)
              ),
              lookupResult.enrichments.length > 0
                ? h('div', { className:'grid grid-cols-1 md:grid-cols-2 gap-3' },
                    lookupResult.enrichments.map((e,i) => h(EnrichmentCard, { key:i, enrichment:e })))
                : h('p', { className:'text-sm text-gray-500' },
                    'No enrichment data available. Add API keys in ', h('code', { className:'text-cti-amber' }, '.env'), ' to enable lookups.')
            )
      )
    ),

    // Stats
    stats && h('div', { className:'grid grid-cols-2 md:grid-cols-4 gap-3 mb-4' },
      h('div', { className:'bg-cti-surface rounded-lg border border-cti-border p-3 text-center' },
        h('div', { className:'text-xl font-display font-bold text-cti-green' }, stats.total),
        h('div', { className:'text-[10px] text-gray-500 uppercase tracking-wider' }, 'Total IOCs')
      ),
      Object.entries(stats.by_type).map(([type, count]) =>
        h('div', { key:type, className:'bg-cti-surface rounded-lg border border-cti-border p-3 text-center' },
          h('div', { className:'text-xl font-display font-bold', style:{ color: TYPE_COLORS[type]||'#666' } }, count),
          h('div', { className:'text-[10px] text-gray-500 uppercase tracking-wider' }, type)
        )
      )
    ),

    // Type filter bar
    h('div', { className:'flex gap-3 mb-4' },
      h('div', { className:'flex-1 relative' },
        h('div', { className:'absolute left-3 top-1/2 -translate-y-1/2 text-gray-500' }, h(Icons.Search, { size:16 })),
        h('input', {
          type:'text', placeholder:'Search IOCs...', value: search,
          onChange: e => setSearch(e.target.value),
          className:'w-full pl-10 pr-4 py-2.5 rounded-lg bg-cti-surface border border-cti-border text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-cti-blue/40'
        })
      ),
      h('div', { className:'flex gap-1' },
        ['','hash','ip','domain','url'].map(t =>
          h('button', {
            key:t, onClick:() => setTypeFilter(t),
            className:`px-3 py-2 rounded-lg text-xs transition-colors border ${
              typeFilter === t ? 'bg-cti-blue/10 text-cti-blue border-cti-blue/20'
                               : 'text-gray-500 border-transparent hover:text-gray-300'}`
          }, t || 'All')
        )
      )
    ),

    // IOC table
    h('div', { className:'bg-cti-surface rounded-xl border border-cti-border overflow-hidden' },
      h('table', { className:'w-full text-sm' },
        h('thead', null,
          h('tr', { className:'border-b border-cti-border text-left' },
            ['Type','Value','Source','Malware','Confidence','First Seen'].map(col =>
              h('th', { key:col, className:'px-4 py-3 text-xs text-gray-500 font-medium' }, col))
          )
        ),
        h('tbody', { className:'divide-y divide-cti-border' },
          iocs.map(ioc =>
            h('tr', { key:ioc.id, className:'hover:bg-white/[0.02] transition-colors' },
              h('td', { className:'px-4 py-2.5' },
                h('span', {
                  className:'text-[10px] px-2 py-0.5 rounded-full border',
                  style: {
                    color: TYPE_COLORS[ioc.ioc_type]||'#666',
                    borderColor: (TYPE_COLORS[ioc.ioc_type]||'#666')+'44',
                    background: (TYPE_COLORS[ioc.ioc_type]||'#666')+'11',
                  }
                }, ioc.ioc_type)
              ),
              h('td', { className:'px-4 py-2.5 font-mono text-xs text-gray-300 max-w-[300px] truncate' }, ioc.value),
              h('td', { className:'px-4 py-2.5 text-xs text-gray-400' }, ioc.source),
              h('td', { className:'px-4 py-2.5 text-xs text-cti-pink' }, ioc.malware_family || '\u2014'),
              h('td', { className:'px-4 py-2.5' },
                h('div', { className:'flex items-center gap-2' },
                  h('div', { className:'w-16 h-1.5 bg-cti-border rounded-full overflow-hidden' },
                    h('div', {
                      className:'h-full rounded-full',
                      style: {
                        width: `${ioc.confidence}%`,
                        background: ioc.confidence >= 70 ? '#00ff87' : ioc.confidence >= 40 ? '#fbbf24' : '#ef4444'
                      }
                    })
                  ),
                  h('span', { className:'text-xs text-gray-500' }, ioc.confidence)
                )
              ),
              h('td', { className:'px-4 py-2.5 text-xs text-gray-500' },
                ioc.first_seen ? new Date(ioc.first_seen).toLocaleDateString() : '\u2014')
            )
          )
        )
      ),
      iocs.length === 0 &&
        h('div', { className:'p-12 text-center text-gray-500 text-sm' }, 'No IOCs found. Poll the IOC feeds to populate this view.')
    )
  );
}
