// IP Intelligence page
function IPIntelPage() {
  var _s = React.useState;
  var _1 = _s(''), ipValue = _1[0], setIpValue = _1[1];
  var _2 = _s(null), result = _2[0], setResult = _2[1];
  var _3 = _s(false), loading = _3[0], setLoading = _3[1];

  var handleLookup = async function(e) {
    e.preventDefault();
    if (!ipValue.trim()) return;
    setLoading(true); setResult(null);
    try { setResult(await API.lookupIP(ipValue.trim())); }
    catch (err) { setResult({ error: err.message }); }
    finally { setLoading(false); }
  };

  var threatColor = function(score) {
    if (score >= 70) return '#ef4444';
    if (score >= 40) return '#fbbf24';
    return '#00ff87';
  };

  var InfoBlock = function(props) {
    return h('div', { className:'bg-cti-bg rounded-lg border border-cti-border p-4' },
      h('h4', { className:'text-xs font-semibold uppercase tracking-wider mb-3', style:{ color: props.color || '#00d4ff' } }, props.title),
      props.children
    );
  };

  var Row = function(props) {
    return h('div', { className:'flex items-start gap-2 text-xs mb-1.5' },
      h('span', { className:'text-gray-500 min-w-[110px]' }, props.label),
      h('span', { className:'text-gray-300 break-all' }, String(props.value != null ? props.value : '\u2014'))
    );
  };

  return h('div', { className:'max-w-4xl' },
    h('h1', { className:'font-display text-2xl font-bold text-white mb-1' }, 'IP Intelligence'),
    h('p', { className:'text-sm text-gray-500 mb-6' }, 'Consolidated IP threat analysis from multiple sources'),

    // Lookup form
    h('form', { onSubmit: handleLookup, className:'flex gap-3 mb-6' },
      h('div', { className:'flex-1 relative' },
        h('div', { className:'absolute left-3 top-1/2 -translate-y-1/2 text-gray-500' }, h(Icons.Search, { size:16 })),
        h('input', {
          type:'text', placeholder:'Enter an IP address (e.g. 8.8.8.8)',
          value: ipValue, onChange: function(e) { setIpValue(e.target.value); },
          className:'w-full pl-10 pr-4 py-3 rounded-lg bg-cti-surface border border-cti-border text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-cti-blue/40 font-mono'
        })
      ),
      h('button', {
        type:'submit', disabled: loading || !ipValue.trim(),
        className:'px-6 py-3 rounded-lg bg-cti-blue/10 text-cti-blue border border-cti-blue/20 hover:bg-cti-blue/20 transition-colors text-sm font-semibold disabled:opacity-50'
      }, loading ? 'Scanning...' : 'Analyze')
    ),

    // Results
    result && !result.error && h('div', null,
      // Threat Score header
      h('div', { className:'bg-cti-surface rounded-xl border border-cti-border p-5 mb-4' },
        h('div', { className:'flex items-center justify-between' },
          h('div', null,
            h('code', { className:'text-lg text-white font-bold' }, result.ip),
            h('p', { className:'text-xs text-gray-500 mt-1' }, result.summary)
          ),
          h('div', { className:'text-center' },
            h('div', { className:'text-3xl font-display font-bold', style:{ color: threatColor(result.threat_score) } }, result.threat_score),
            h('div', { className:'text-[10px] text-gray-500 uppercase tracking-wider' }, 'Threat Score')
          )
        ),
        // Score bar
        h('div', { className:'w-full h-2 bg-cti-border rounded-full mt-3 overflow-hidden' },
          h('div', { className:'h-full rounded-full transition-all', style:{ width: result.threat_score+'%', background: threatColor(result.threat_score) } })
        )
      ),

      // Source cards
      h('div', { className:'grid grid-cols-1 md:grid-cols-2 gap-4' },
        result.abuseipdb && h(InfoBlock, { title:'AbuseIPDB', color:'#ef4444' },
          h(Row, { label:'Abuse Score', value: result.abuseipdb.abuse_score + '%' }),
          h(Row, { label:'Total Reports', value: result.abuseipdb.total_reports }),
          h(Row, { label:'Country', value: result.abuseipdb.country }),
          h(Row, { label:'ISP', value: result.abuseipdb.isp }),
          h(Row, { label:'Domain', value: result.abuseipdb.domain }),
          h(Row, { label:'Tor Exit', value: result.abuseipdb.is_tor ? 'Yes' : 'No' }),
          h(Row, { label:'Usage', value: result.abuseipdb.usage_type })
        ),
        result.shodan && h(InfoBlock, { title:'Shodan InternetDB', color:'#fbbf24' },
          h(Row, { label:'Open Ports', value: (result.shodan.ports || []).join(', ') || 'None' }),
          h(Row, { label:'Hostnames', value: (result.shodan.hostnames || []).join(', ') || 'None' }),
          h(Row, { label:'Vulns', value: (result.shodan.vulns || []).length + ' found' }),
          result.shodan.vulns && result.shodan.vulns.length > 0 &&
            h('div', { className:'flex flex-wrap gap-1 mt-2' },
              result.shodan.vulns.slice(0, 10).map(function(v) {
                return h('span', { key:v, className:'text-[10px] px-1.5 py-0.5 rounded bg-red-500/10 text-red-400 border border-red-500/20' }, v);
              })
            ),
          h(Row, { label:'Tags', value: (result.shodan.tags || []).join(', ') || 'None' })
        ),
        result.greynoise && h(InfoBlock, { title:'GreyNoise', color:'#a78bfa' },
          h(Row, { label:'Classification', value: result.greynoise.classification }),
          h(Row, { label:'Noise', value: result.greynoise.noise ? 'Yes (scanning)' : 'No' }),
          h(Row, { label:'RIOT', value: result.greynoise.riot ? 'Yes (benign)' : 'No' }),
          h(Row, { label:'Name', value: result.greynoise.name }),
          h(Row, { label:'Message', value: result.greynoise.message })
        )
      )
    ),

    result && result.error && h('div', { className:'text-red-400 text-sm mt-4' }, result.error),

    !result && !loading && h('div', { className:'bg-cti-surface rounded-xl border border-cti-border p-12 text-center text-gray-500 text-sm' },
      'Enter an IP address to get a consolidated threat intelligence report from AbuseIPDB, Shodan, and GreyNoise.')
  );
}
