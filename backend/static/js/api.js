// API client for the CTI backend
var API = {
  async request(path, options = {}) {
    var res = await fetch('/api' + path, {
      headers: { 'Content-Type': 'application/json' },
      ...options,
    });
    if (!res.ok) throw new Error('API ' + res.status + ': ' + (await res.text()));
    return res.json();
  },

  // Dashboard
  getDashboard()        { return this.request('/dashboard'); },

  // Feed articles
  getArticles(params={}) {
    var qs = new URLSearchParams(params).toString();
    return this.request('/feed' + (qs ? '?' + qs : ''));
  },
  getSources()          { return this.request('/feed/sources'); },
  updateArticle(id, d)  { return this.request('/feed/' + id, { method:'PATCH', body:JSON.stringify(d) }); },
  pollFeeds()           { return this.request('/feed/poll', { method:'POST' }); },

  // IOCs
  getIOCs(params={}) {
    var qs = new URLSearchParams(params).toString();
    return this.request('/iocs' + (qs ? '?' + qs : ''));
  },
  getIOCStats()         { return this.request('/iocs/stats'); },
  lookupIOC(value, type) {
    return this.request('/iocs/lookup?value=' + encodeURIComponent(value) + (type ? '&ioc_type='+type : ''), { method:'POST' });
  },
  pollIOCs()            { return this.request('/iocs/poll', { method:'POST' }); },

  // KEV Catalog
  getKEVs(params={}) {
    var qs = new URLSearchParams(params).toString();
    return this.request('/kev' + (qs ? '?' + qs : ''));
  },
  getKEVStats()         { return this.request('/kev/stats'); },
  syncKEV()             { return this.request('/kev/sync', { method:'POST' }); },

  // Intel lookups
  lookupIP(ip)          { return this.request('/intel/ip?ip=' + encodeURIComponent(ip), { method:'POST' }); },
  lookupDomain(domain)  { return this.request('/intel/domain?domain=' + encodeURIComponent(domain), { method:'POST' }); },

  // Settings
  getSettings()         { return this.request('/settings'); },

  // Logs
  getLogs(file, lines, search) {
    var params = { file: file || 'cti-platform', lines: lines || 200 };
    if (search) params.search = search;
    var qs = new URLSearchParams(params).toString();
    return this.request('/settings/logs?' + qs);
  },
  getLogFiles()         { return this.request('/settings/logs/files'); },

  // Health
  getHealth()           { return this.request('/health'); },
};
