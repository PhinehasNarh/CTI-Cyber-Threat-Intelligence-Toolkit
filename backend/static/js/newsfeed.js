// News Feed page component
function NewsFeedPage() {
  const [articles, setArticles] = React.useState([]);
  const [sources, setSources] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [search, setSearch] = React.useState('');
  const [sourceFilter, setSourceFilter] = React.useState('');
  const [polling, setPolling] = React.useState(false);

  const fetchArticles = async () => {
    try {
      const params = {};
      if (search) params.search = search;
      if (sourceFilter) params.source = sourceFilter;
      params.limit = '100';
      const data = await API.getArticles(params);
      setArticles(data.articles);
    } catch (e) { console.error('Articles load failed:', e); }
    finally { setLoading(false); }
  };

  const fetchSources = async () => {
    try { const d = await API.getSources(); setSources(d.sources); }
    catch (e) { console.error(e); }
  };

  React.useEffect(() => { fetchArticles(); fetchSources(); }, []);
  React.useEffect(() => {
    const t = setTimeout(() => fetchArticles(), 300);
    return () => clearTimeout(t);
  }, [search, sourceFilter]);

  const handleStar = async (id, current) => {
    await API.updateArticle(id, { is_starred: !current });
    setArticles(prev => prev.map(a => a.id === id ? { ...a, is_starred: !current } : a));
  };

  const handleMarkRead = async (id) => {
    await API.updateArticle(id, { is_read: true });
    setArticles(prev => prev.map(a => a.id === id ? { ...a, is_read: true } : a));
  };

  const handlePoll = async () => {
    setPolling(true);
    try { await API.pollFeeds(); await fetchArticles(); }
    finally { setPolling(false); }
  };

  if (loading) return h('div', { className:'flex items-center justify-center h-64 text-gray-500' }, 'Loading articles...');

  return h('div', { className:'max-w-4xl' },
    // Header
    h('div', { className:'flex items-center justify-between mb-6' },
      h('div', null,
        h('h1', { className:'font-display text-2xl font-bold text-white' }, 'News Feed'),
        h('p', { className:'text-sm text-gray-500 mt-1' }, `Security news from ${sources.length} sources`)
      ),
      h('button', {
        onClick: handlePoll, disabled: polling,
        className:'flex items-center gap-2 px-4 py-2 rounded-lg bg-cti-green/10 text-cti-green border border-cti-green/20 hover:bg-cti-green/20 transition-colors text-sm disabled:opacity-50'
      }, h(Icons.Refresh, { size:16, className: polling ? 'animate-spin' : '' }),
         polling ? 'Polling...' : 'Refresh')
    ),

    // Filters
    h('div', { className:'flex gap-3 mb-4' },
      h('div', { className:'flex-1 relative' },
        h('div', { className:'absolute left-3 top-1/2 -translate-y-1/2 text-gray-500' }, h(Icons.Search, { size:16 })),
        h('input', {
          type:'text', placeholder:'Search articles...', value: search,
          onChange: e => setSearch(e.target.value),
          className:'w-full pl-10 pr-4 py-2.5 rounded-lg bg-cti-surface border border-cti-border text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-cti-blue/40'
        })
      ),
      h('div', { className:'relative' },
        h('div', { className:'absolute left-3 top-1/2 -translate-y-1/2 text-gray-500' }, h(Icons.Filter, { size:16 })),
        h('select', {
          value: sourceFilter, onChange: e => setSourceFilter(e.target.value),
          className:'pl-10 pr-8 py-2.5 rounded-lg bg-cti-surface border border-cti-border text-sm text-gray-200 focus:outline-none focus:border-cti-blue/40 appearance-none cursor-pointer'
        },
          h('option', { value:'' }, 'All Sources'),
          sources.map(s => h('option', { key:s.name, value:s.name }, `${s.name} (${s.count})`))
        )
      )
    ),

    // Article list
    h('div', { className:'bg-cti-surface rounded-xl border border-cti-border divide-y divide-cti-border' },
      articles.map(a =>
        h('div', { key:a.id, className:`px-4 py-3 hover:bg-white/[0.02] transition-colors ${a.is_read ? 'opacity-60' : ''}` },
          h('div', { className:'flex items-start gap-3' },
            // Star
            h('button', { onClick:() => handleStar(a.id, a.is_starred), className:'mt-0.5 flex-shrink-0' },
              h('svg', { width:16, height:16, viewBox:'0 0 24 24',
                fill: a.is_starred ? '#fbbf24' : 'none',
                stroke: a.is_starred ? '#fbbf24' : '#555',
                strokeWidth:2, strokeLinecap:'round', strokeLinejoin:'round' },
                h('path', { d:'M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z' })
              )
            ),
            // Content
            h('div', { className:'flex-1 min-w-0' },
              h('a', {
                href:a.url, target:'_blank', rel:'noopener noreferrer',
                onClick:() => handleMarkRead(a.id),
                className:'text-sm text-gray-200 hover:text-cti-blue transition-colors flex items-center gap-1.5'
              },
                h('span', { className:'truncate' }, a.title),
                h(Icons.ExternalLink, { size:12, className:'flex-shrink-0 opacity-40' })
              ),
              h('div', { className:'flex items-center gap-3 mt-1.5' },
                h('span', { className:'text-xs text-cti-blue font-medium' }, a.source),
                a.published && h('span', { className:'text-xs text-gray-600' },
                  new Date(a.published).toLocaleDateString(undefined, { month:'short', day:'numeric', year:'numeric' })),
                a.categories && a.categories.length > 0 &&
                  h('div', { className:'flex gap-1' },
                    a.categories.slice(0,3).map((cat,i) =>
                      h('span', { key:i, className:'text-[10px] px-1.5 py-0.5 rounded bg-cti-purple/10 text-cti-purple' }, cat)
                    )
                  )
              ),
              a.summary && h('p', { className:'text-xs text-gray-500 mt-1.5 line-clamp-2' }, a.summary)
            )
          )
        )
      ),
      articles.length === 0 &&
        h('div', { className:'p-12 text-center text-gray-500 text-sm' }, 'No articles found. Try polling feeds or adjusting filters.')
    )
  );
}
