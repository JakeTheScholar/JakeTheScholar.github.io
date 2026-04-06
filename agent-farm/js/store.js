/* ── localStorage wrapper with 'af_' prefix ── */
const Store = {
  _get(key) {
    try { return JSON.parse(localStorage.getItem('af_' + key)); }
    catch { return null; }
  },
  _set(key, val) {
    localStorage.setItem('af_' + key, JSON.stringify(val));
  },

  getConfig() {
    const saved = this._get('config');
    if (saved && saved.serverUrl) return saved;

    // Auto-detect from current page URL (works for localhost + ngrok + any host)
    const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
    return {
      serverUrl: `${proto}//${location.host}/ws`,
      apiUrl: `${location.protocol}//${location.host}`,
    };
  },
  saveConfig(cfg) { this._set('config', cfg); },

  getFeedHistory() { return this._get('feed_history') || []; },
  saveFeedHistory(entries) {
    // Keep last 200
    this._set('feed_history', entries.slice(-200));
  },
  appendFeedEntry(entry) {
    const hist = this.getFeedHistory();
    hist.push(entry);
    this.saveFeedHistory(hist);
  },
};
