// Settings page with log viewer
function SettingsPage() {
  var _s = React.useState, _e = React.useEffect;
  var _1 = _s(null), settings = _1[0], setSettings = _1[1];
  var _2 = _s(null), health = _2[0], setHealth = _2[1];
  var _3 = _s(true), loading = _3[0], setLoading = _3[1];

  // Log viewer state
  var _4 = _s([]), logLines = _4[0], setLogLines = _4[1];
  var _5 = _s('cti-platform'), logFile = _5[0], setLogFile = _5[1];
  var _6 = _s(''), logSearch = _6[0], setLogSearch = _6[1];
  var _7 = _s(false), logLoading = _7[0], setLogLoading = _7[1];
  var _8 = _s(false), showLogs = _8[0], setShowLogs = _8[1];
  var _9 = _s(null), logFiles = _9[0], setLogFiles = _9[1];

  _e(function() {
    Promise.all([API.getSettings(), API.getHealth()])
      .then(function(results) { setSettings(results[0]); setHealth(results[1]); })
      .catch(function(e) { console.error(e); })
      .finally(function() { setLoading(false); });
  }, []);

  var fetchLogs = function() {
    setLogLoading(true);
    API.getLogs(logFile, 200, logSearch || undefined)
      .then(function(data) { setLogLines(data.lines || []); })
      .catch(function(e) { console.error(e); })
      .finally(function() { setLogLoading(false); });
  };

  var fetchLogFiles = function() {
    API.getLogFiles()
      .then(function(data) { setLogFiles(data.files || []); })
      .catch(function(e) { console.error(e); });
  };

  // Fetch logs when log viewer is toggled on or log file changes
  _e(function() {
    if (showLogs) { fetchLogs(); fetchLogFiles(); }
  }, [showLogs, logFile]);

  if (loading) return h('div', { className:'flex items-center justify-center h-64 text-gray-500' }, 'Loading settings...');

  var StatusDot = function(props) {
    return h('div', {
      className:'w-2.5 h-2.5 rounded-full',
      style:{ background: props.active ? '#00ff87' : '#ef4444', boxShadow: props.active ? '0 0 8px #00ff8766' : 'none' }
    });
  };

  // Colorize log lines
  var colorLine = function(line) {
    if (line.indexOf('| ERROR') > -1 || line.indexOf('Error') > -1)   return 'text-red-400';
    if (line.indexOf('| WARNING') > -1 || line.indexOf('Warning') > -1) return 'text-amber-400';
    if (line.indexOf('| INFO') > -1)    return 'text-gray-400';
    if (line.indexOf('| DEBUG') > -1)   return 'text-gray-600';
    return 'text-gray-500';
  };

  return h('div', { className:'max-w-4xl' },
    h('h1', { className:'font-display text-2xl font-bold text-white mb-1' }, 'Settings'),
    h('p', { className:'text-sm text-gray-500 mb-6' }, 'Platform configuration, API key status, and activity logs'),

    // System status
    health && h('div', { className:'bg-cti-surface rounded-xl border border-cti-border p-5 mb-6' },
      h('h3', { className:'text-sm font-semibold text-gray-300 mb-4' }, 'System Status'),
      h('div', { className:'grid grid-cols-3 gap-4' },
        h('div', { className:'flex items-center gap-2' },
          h(StatusDot, { active: health.status === 'healthy' }),
          h('span', { className:'text-sm text-gray-300' }, 'Backend: ' + health.status)
        ),
        h('div', { className:'flex items-center gap-2' },
          h(StatusDot, { active: health.scheduler_running }),
          h('span', { className:'text-sm text-gray-300' }, 'Scheduler: ' + (health.scheduler_running ? 'Running' : 'Stopped'))
        ),
        h('div', { className:'flex items-center gap-2' },
          h(Icons.Activity, { size:14, className:'text-cti-blue' }),
          h('span', { className:'text-sm text-gray-300' }, 'Version: ' + health.version)
        )
      )
    ),

    // API Keys
    settings && h('div', { className:'bg-cti-surface rounded-xl border border-cti-border p-5 mb-6' },
      h('h3', { className:'text-sm font-semibold text-gray-300 mb-4' }, 'API Key Status'),
      h('div', { className:'space-y-3' },
        Object.entries(settings.api_keys).map(function(entry) {
          var name = entry[0], info = entry[1];
          return h('div', { key:name, className:'flex items-center justify-between p-3 rounded-lg bg-cti-bg border border-cti-border' },
            h('div', { className:'flex items-center gap-3' },
              h(StatusDot, { active: info.configured }),
              h('span', { className:'text-sm text-gray-300 capitalize' }, name.replace(/_/g, ' '))
            ),
            h('span', { className:'font-mono text-xs ' + (info.configured ? 'text-cti-green' : 'text-gray-600') },
              info.configured ? info.value : 'Not configured')
          );
        })
      ),
      h('p', { className:'text-xs text-gray-600 mt-4' },
        'API keys are configured in ', h('code', { className:'text-cti-amber' }, 'backend/.env'),
        '. Restart the server after changes.')
    ),

    // Feed settings
    settings && h('div', { className:'bg-cti-surface rounded-xl border border-cti-border p-5 mb-6' },
      h('h3', { className:'text-sm font-semibold text-gray-300 mb-4' }, 'Feed Configuration'),
      h('div', { className:'flex items-center justify-between p-3 rounded-lg bg-cti-bg border border-cti-border' },
        h('span', { className:'text-sm text-gray-300' }, 'Auto-poll interval'),
        h('span', { className:'text-sm text-cti-blue font-mono' }, settings.feed_poll_interval + ' minutes')
      )
    ),

    // ── Activity Logs ──────────────────────────────────────────────
    h('div', { className:'bg-cti-surface rounded-xl border border-cti-border p-5' },
      h('div', { className:'flex items-center justify-between mb-4' },
        h('h3', { className:'text-sm font-semibold text-gray-300' }, 'Activity Logs'),
        h('button', {
          onClick: function() { setShowLogs(!showLogs); },
          className:'text-xs px-3 py-1.5 rounded-lg border transition-colors ' +
            (showLogs
              ? 'bg-cti-green/10 text-cti-green border-cti-green/20'
              : 'bg-cti-bg text-gray-400 border-cti-border hover:text-gray-200')
        }, showLogs ? 'Hide Logs' : 'View Logs')
      ),

      showLogs && h('div', null,
        // Controls
        h('div', { className:'flex items-center gap-3 mb-3' },
          // File selector
          h('select', {
            value: logFile,
            onChange: function(e) { setLogFile(e.target.value); },
            className:'bg-cti-bg border border-cti-border rounded-lg px-3 py-1.5 text-sm text-gray-300 focus:outline-none focus:border-cti-blue'
          },
            h('option', { value:'cti-platform' }, 'Application Log'),
            h('option', { value:'access' }, 'Access Log')
          ),
          // Search
          h('input', {
            type:'text', placeholder:'Filter logs...',
            value: logSearch,
            onChange: function(e) { setLogSearch(e.target.value); },
            onKeyDown: function(e) { if (e.key === 'Enter') fetchLogs(); },
            className:'flex-1 bg-cti-bg border border-cti-border rounded-lg px-3 py-1.5 text-sm text-gray-300 placeholder-gray-600 focus:outline-none focus:border-cti-blue'
          }),
          // Refresh
          h('button', {
            onClick: fetchLogs,
            disabled: logLoading,
            className:'flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cti-bg border border-cti-border text-gray-400 hover:text-gray-200 text-sm disabled:opacity-50'
          },
            h(Icons.Refresh, { size:14, className: logLoading ? 'animate-spin' : '' }),
            'Refresh'
          )
        ),

        // Log file info
        logFiles && h('div', { className:'flex gap-4 mb-3' },
          logFiles.map(function(f) {
            return h('span', { key:f.name, className:'text-[10px] text-gray-600' },
              f.name + ' (' + f.size_kb + ' KB)'
            );
          })
        ),

        // Log output
        h('div', {
          className:'bg-black/40 rounded-lg border border-cti-border p-3 font-mono text-[11px] max-h-[400px] overflow-y-auto',
          style:{ lineHeight:'1.6' }
        },
          logLoading
            ? h('div', { className:'text-gray-500 text-center py-8' }, 'Loading logs...')
            : logLines.length === 0
              ? h('div', { className:'text-gray-600 text-center py-8' }, 'No log entries found.')
              : logLines.map(function(line, i) {
                  return h('div', { key: i, className: colorLine(line) + ' hover:bg-white/[0.02] px-1' }, line);
                })
        )
      )
    )
  );
}
