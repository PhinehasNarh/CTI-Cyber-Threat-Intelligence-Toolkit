// Dashboard page component
var _RC = window.Recharts || {};
var LineChart = _RC.LineChart, Line = _RC.Line, BarChart = _RC.BarChart,
    Bar = _RC.Bar, PieChart = _RC.PieChart, Pie = _RC.Pie, Cell = _RC.Cell,
    XAxis = _RC.XAxis, YAxis = _RC.YAxis, Tooltip = _RC.Tooltip,
    CartesianGrid = _RC.CartesianGrid, ResponsiveContainer = _RC.ResponsiveContainer;

const CHART_COLORS = ['#00ff87','#00d4ff','#a78bfa','#f472b6','#fbbf24','#fb923c'];

const TOOLTIP_STYLE = {
  background:'#111118', border:'1px solid #1a1a2e',
  borderRadius:8, color:'#e0e0e0', fontSize:12
};

function DashboardPage() {
  const [data, setData] = React.useState(null);
  const [loading, setLoading] = React.useState(true);
  const [polling, setPolling] = React.useState(false);

  const fetchData = async () => {
    try { setData(await API.getDashboard()); }
    catch (e) { console.error('Dashboard load failed:', e); }
    finally { setLoading(false); }
  };

  React.useEffect(() => { fetchData(); }, []);

  const handlePoll = async () => {
    setPolling(true);
    try {
      await Promise.all([API.pollFeeds(), API.pollIOCs()]);
      await fetchData();
    } finally { setPolling(false); }
  };

  if (loading) return h('div', { className:'flex items-center justify-center h-64 text-gray-500' }, 'Loading dashboard...');

  if (!data) return h('div', { className:'text-center text-gray-500 mt-20' },
    h('p', { className:'mb-4' }, 'Could not connect to the backend API.'),
    h('p', { className:'text-sm' }, 'Make sure the FastAPI server is running on ',
      h('code', { className:'text-cti-green' }, 'localhost:8000'))
  );

  const { stats, recent_articles, ioc_by_type, articles_by_source, ioc_trend } = data;
  const iocTypeData = Object.entries(ioc_by_type).map(([name, value]) => ({ name, value }));
  const sourceData = Object.entries(articles_by_source).slice(0,8)
    .map(([name, count]) => ({ name: name.length > 15 ? name.slice(0,15)+'...' : name, count }));

  return h('div', { className:'max-w-6xl' },
    // Header
    h('div', { className:'flex items-center justify-between mb-6' },
      h('div', null,
        h('h1', { className:'font-display text-2xl font-bold text-white' }, 'Threat Overview'),
        h('p', { className:'text-sm text-gray-500 mt-1' }, 'Real-time summary of collected intelligence')
      ),
      h('button', {
        onClick: handlePoll, disabled: polling,
        className:'flex items-center gap-2 px-4 py-2 rounded-lg bg-cti-green/10 text-cti-green border border-cti-green/20 hover:bg-cti-green/20 transition-colors text-sm disabled:opacity-50'
      }, h(Icons.Refresh, { size:16, className: polling ? 'animate-spin' : '' }),
         polling ? 'Polling...' : 'Poll Feeds Now')
    ),

    // Stat cards
    h('div', { className:'grid grid-cols-2 md:grid-cols-5 gap-3 mb-6' },
      h(StatCard, { label:'Total Articles', value:stats.total_articles, color:'#00d4ff' }),
      h(StatCard, { label:'Articles Today', value:stats.articles_today, color:'#00ff87' }),
      h(StatCard, { label:'Unread', value:stats.unread_articles, color:'#fbbf24' }),
      h(StatCard, { label:'Total IOCs', value:stats.total_iocs, color:'#a78bfa' }),
      h(StatCard, { label:'IOCs Today', value:stats.iocs_today, color:'#f472b6' }),
    ),

    // Charts row
    h('div', { className:'grid grid-cols-1 md:grid-cols-3 gap-4 mb-6' },
      // IOC Trend line chart
      h('div', { className:'md:col-span-2 bg-cti-surface rounded-xl border border-cti-border p-4' },
        h('h3', { className:'text-sm font-semibold text-gray-300 mb-3' }, 'IOCs Collected (7 days)'),
        h(ResponsiveContainer, { width:'100%', height:200 },
          h(LineChart, { data: ioc_trend },
            h(CartesianGrid, { strokeDasharray:'3 3', stroke:'#1a1a2e' }),
            h(XAxis, { dataKey:'date', tick:{ fill:'#666', fontSize:11 }, tickFormatter: d => d.slice(5) }),
            h(YAxis, { tick:{ fill:'#666', fontSize:11 } }),
            h(Tooltip, { contentStyle: TOOLTIP_STYLE }),
            h(Line, { type:'monotone', dataKey:'count', stroke:'#00ff87', strokeWidth:2, dot:{ fill:'#00ff87', r:3 } })
          )
        )
      ),
      // IOC types pie
      h('div', { className:'bg-cti-surface rounded-xl border border-cti-border p-4' },
        h('h3', { className:'text-sm font-semibold text-gray-300 mb-3' }, 'IOC Types'),
        iocTypeData.length > 0
          ? h(ResponsiveContainer, { width:'100%', height:200 },
              h(PieChart, null,
                h(Pie, { data:iocTypeData, cx:'50%', cy:'50%', innerRadius:40, outerRadius:70, dataKey:'value',
                  label: ({ name, value }) => `${name}: ${value}` },
                  iocTypeData.map((_, i) => h(Cell, { key:i, fill:CHART_COLORS[i % CHART_COLORS.length] }))
                ),
                h(Tooltip, { contentStyle: TOOLTIP_STYLE })
              )
            )
          : h('div', { className:'flex items-center justify-center h-[200px] text-gray-500 text-sm' }, 'No IOC data yet')
      )
    ),

    // Source bar chart
    sourceData.length > 0 && h('div', { className:'bg-cti-surface rounded-xl border border-cti-border p-4 mb-6' },
      h('h3', { className:'text-sm font-semibold text-gray-300 mb-3' }, 'Articles by Source'),
      h(ResponsiveContainer, { width:'100%', height:200 },
        h(BarChart, { data: sourceData },
          h(CartesianGrid, { strokeDasharray:'3 3', stroke:'#1a1a2e' }),
          h(XAxis, { dataKey:'name', tick:{ fill:'#666', fontSize:10 }, angle:-20, textAnchor:'end', height:50 }),
          h(YAxis, { tick:{ fill:'#666', fontSize:11 } }),
          h(Tooltip, { contentStyle: TOOLTIP_STYLE }),
          h(Bar, { dataKey:'count', fill:'#00d4ff', radius:[4,4,0,0] })
        )
      )
    ),

    // Live Feed + Recent Articles side-by-side
    h('div', { className:'grid grid-cols-1 md:grid-cols-2 gap-4' },

      // Live Feed widget
      h('div', { className:'bg-cti-surface rounded-xl border border-cti-border' },
        h('div', { className:'p-4 border-b border-cti-border flex items-center justify-between' },
          h('h3', { className:'text-sm font-semibold text-gray-300' }, 'Live Feed'),
          h('div', { className:'flex items-center gap-1.5' },
            h('div', { className:'w-2 h-2 rounded-full bg-cti-green animate-pulse-dot' }),
            h('span', { className:'text-[10px] text-gray-500 uppercase tracking-wider' }, 'Live')
          )
        ),
        h('div', { className:'divide-y divide-cti-border max-h-[360px] overflow-y-auto' },
          recent_articles.slice(0, 8).map(function(a) {
            var sevTag = 'info';
            var sevColor = { bg:'bg-cti-blue/10', text:'text-cti-blue', border:'border-cti-blue/20' };
            var titleLower = (a.title || '').toLowerCase();
            if (titleLower.match(/breach|ransomware|attack|malware|exploit|critical|zero.day|vulnerability|cve-/)) {
              sevTag = 'high';
              sevColor = { bg:'bg-red-500/10', text:'text-red-400', border:'border-red-500/20' };
            } else if (titleLower.match(/warning|threat|phish|scam|patch|update/)) {
              sevTag = 'medium';
              sevColor = { bg:'bg-amber-500/10', text:'text-amber-400', border:'border-amber-500/20' };
            }
            var timeAgo = '';
            if (a.published) {
              var diff = Date.now() - new Date(a.published).getTime();
              var hrs = Math.floor(diff / 3600000);
              if (hrs < 1) timeAgo = Math.max(1, Math.floor(diff / 60000)) + 'm ago';
              else if (hrs < 24) timeAgo = hrs + 'h ago';
              else timeAgo = Math.floor(hrs / 24) + 'd ago';
            }
            return h('div', { key: a.id, className:'px-4 py-3 hover:bg-white/[0.02] transition-colors' },
              h('div', { className:'flex items-start gap-2' },
                h('div', { className:'mt-1 w-1.5 h-1.5 rounded-full flex-shrink-0',
                  style:{ background: sevTag === 'high' ? '#ef4444' : sevTag === 'medium' ? '#fbbf24' : '#00d4ff' } }),
                h('div', { className:'flex-1 min-w-0' },
                  h('p', { className:'text-xs text-gray-200 line-clamp-2 leading-relaxed' }, a.title),
                  h('div', { className:'flex items-center gap-2 mt-1' },
                    h('span', { className:'text-[10px] ' + sevColor.bg + ' ' + sevColor.text + ' ' + sevColor.border +
                      ' px-1.5 py-0.5 rounded-full border uppercase font-semibold' }, sevTag),
                    h('span', { className:'text-[10px] text-gray-600' }, a.source),
                    timeAgo && h('span', { className:'text-[10px] text-gray-600' }, timeAgo)
                  )
                )
              )
            );
          }),
          recent_articles.length === 0 &&
            h('div', { className:'p-8 text-center text-gray-500 text-sm' }, 'No items yet. Poll feeds to populate.')
        )
      ),

      // Recent articles list
      h('div', { className:'bg-cti-surface rounded-xl border border-cti-border' },
        h('div', { className:'p-4 border-b border-cti-border' },
          h('h3', { className:'text-sm font-semibold text-gray-300' }, 'Recent Articles')
        ),
        h('div', { className:'divide-y divide-cti-border max-h-[360px] overflow-y-auto' },
          recent_articles.map(function(a) {
            return h('a', { key:a.id, href:a.url, target:'_blank', rel:'noopener noreferrer',
              className:'block px-4 py-3 hover:bg-white/[0.02] transition-colors' },
              h('div', { className:'flex items-start justify-between gap-3' },
                h('div', { className:'flex-1 min-w-0' },
                  h('p', { className:'text-sm text-gray-200 truncate' }, a.title),
                  h('div', { className:'flex items-center gap-2 mt-1' },
                    h('span', { className:'text-xs text-cti-blue' }, a.source),
                    a.published && h('span', { className:'text-xs text-gray-600' },
                      new Date(a.published).toLocaleDateString())
                  )
                ),
                a.categories && a.categories.length > 0 &&
                  h('div', { className:'flex gap-1 flex-shrink-0' },
                    a.categories.slice(0,2).map(function(cat, i) {
                      return h('span', { key:i, className:'text-[10px] px-2 py-0.5 rounded-full bg-cti-purple/10 text-cti-purple border border-cti-purple/20' }, cat);
                    })
                  )
              )
            );
          }),
          recent_articles.length === 0 &&
            h('div', { className:'p-8 text-center text-gray-500 text-sm' }, 'No articles yet. Click "Poll Feeds Now" to fetch.')
        )
      )
    )
  );
}
