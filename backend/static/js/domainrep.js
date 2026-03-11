// Domain Reputation page
function DomainRepPage() {
  var _s = React.useState;
  var _1 = _s(''), domain = _1[0], setDomain = _1[1];
  var _2 = _s(null), result = _2[0], setResult = _2[1];
  var _3 = _s(false), loading = _3[0], setLoading = _3[1];

  var handleLookup = async function(e) {
    e.preventDefault();
    if (!domain.trim()) return;
    setLoading(true); setResult(null);
    try { setResult(await API.lookupDomain(domain.trim())); }
    catch (err) { setResult({ error: err.message }); }
    finally { setLoading(false); }
  };

  var threatColor = function(score) {
    if (score >= 70) return '#ef4444';
    if (score >= 40) return '#fbbf24';
    return '#00ff87';
  };

  return h('div', { className:'max-w-4xl' },
    h('h1', { className:'font-display text-2xl font-bold text-white mb-1' }, 'Domain Reputation'),
    h('p', { className:'text-sm text-gray-500 mb-6' }, 'Check domain reputation via VirusTotal'),

    h('form', { onSubmit: handleLookup, className:'flex gap-3 mb-6' },
      h('div', { className:'flex-1 relative' },
        h('div', { className:'absolute left-3 top-1/2 -translate-y-1/2 text-gray-500' }, h(Icons.Search, { size:16 })),
        h('input', {
          type:'text', placeholder:'Enter a domain (e.g. example.com)',
          value: domain, onChange: function(e) { setDomain(e.target.value); },
          className:'w-full pl-10 pr-4 py-3 rounded-lg bg-cti-surface border border-cti-border text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-cti-green/40 font-mono'
        })
      ),
      h('button', {
        type:'submit', disabled: loading || !domain.trim(),
        className:'px-6 py-3 rounded-lg bg-cti-green/10 text-cti-green border border-cti-green/20 hover:bg-cti-green/20 transition-colors text-sm font-semibold disabled:opacity-50'
      }, loading ? 'Checking...' : 'Analyze')
    ),

    result && !result.error && h('div', null,
      h('div', { className:'bg-cti-surface rounded-xl border border-cti-border p-5 mb-4' },
        h('div', { className:'flex items-center justify-between' },
          h('code', { className:'text-lg text-white font-bold' }, result.domain),
          h('div', { className:'text-center' },
            h('div', { className:'text-3xl font-display font-bold', style:{ color: threatColor(result.threat_score) } }, result.threat_score),
            h('div', { className:'text-[10px] text-gray-500 uppercase tracking-wider' }, 'Threat Score')
          )
        ),
        h('div', { className:'w-full h-2 bg-cti-border rounded-full mt-3 overflow-hidden' },
          h('div', { className:'h-full rounded-full transition-all', style:{ width: result.threat_score+'%', background: threatColor(result.threat_score) } })
        )
      ),
      result.virustotal && h('div', { className:'bg-cti-bg rounded-lg border border-cti-border p-4' },
        h('h4', { className:'text-xs font-semibold text-cti-blue uppercase tracking-wider mb-3' }, 'VirusTotal Analysis'),
        h('div', { className:'grid grid-cols-4 gap-3 mb-4' },
          [['Malicious', result.virustotal.malicious, '#ef4444'],
           ['Suspicious', result.virustotal.suspicious, '#fbbf24'],
           ['Harmless', result.virustotal.harmless, '#00ff87'],
           ['Undetected', result.virustotal.undetected, '#666']].map(function(item) {
            return h('div', { key:item[0], className:'text-center' },
              h('div', { className:'text-xl font-display font-bold', style:{ color:item[2] } }, item[1]),
              h('div', { className:'text-[10px] text-gray-500 uppercase' }, item[0])
            );
          })
        ),
        result.virustotal.registrar && h('div', { className:'text-xs text-gray-400 mt-2' },
          'Registrar: ', h('span', { className:'text-gray-300' }, result.virustotal.registrar)),
        result.virustotal.categories && Object.keys(result.virustotal.categories).length > 0 &&
          h('div', { className:'flex flex-wrap gap-1 mt-2' },
            Object.values(result.virustotal.categories).map(function(cat, i) {
              return h('span', { key:i, className:'text-[10px] px-2 py-0.5 rounded-full bg-cti-purple/10 text-cti-purple border border-cti-purple/20' }, cat);
            })
          )
      ),
      !result.virustotal && h('p', { className:'text-sm text-gray-500 mt-4' },
        'No VirusTotal data. Add your API key in ', h('code', { className:'text-cti-amber' }, '.env'), ' to enable.')
    ),

    result && result.error && h('div', { className:'text-red-400 text-sm mt-4' }, result.error),

    !result && !loading && h('div', { className:'bg-cti-surface rounded-xl border border-cti-border p-12 text-center text-gray-500 text-sm' },
      'Enter a domain to check its reputation across threat intelligence sources.')
  );
}
