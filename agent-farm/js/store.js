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
    return this._get('config') || {
      serverUrl: 'ws://localhost:8000/ws',
      apiUrl: 'http://localhost:8000',
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
