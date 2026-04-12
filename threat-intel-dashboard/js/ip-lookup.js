"use strict";

const IPLookup = {
  _loaded: false,

  init() {
    if (this._loaded) return;
    this._loaded = true;

    const input = document.getElementById('ip-input');
    const btn = document.getElementById('ip-btn');

    btn.addEventListener('click', () => this._lookup());
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') this._lookup();
    });
  },

  async _lookup() {
    const input = document.getElementById('ip-input');
    const btn = document.getElementById('ip-btn');
    const resultEl = document.getElementById('ip-result');
    const ip = input.value.trim();

    if (!UI.isValidIP(ip)) {
      this._showError('Please enter a valid IPv4 or IPv6 address.');
      return;
    }

    btn.disabled = true;
    btn.textContent = 'Checking...';
    resultEl.classList.add('visible');

    // Show loading in details area
    document.getElementById('ip-details').innerHTML = '<div class="loading-overlay"><div class="loading-spinner"></div>Looking up IP...</div>';
    document.getElementById('ip-score').textContent = '--';
    document.getElementById('ip-score-desc').textContent = '';

    try {
      const data = await API.checkIP(ip);
      this._renderResult(data);
    } catch (err) {
      console.error('IPLookup:', err);
      document.getElementById('ip-details').innerHTML = '<p style="color:var(--rose);font-size:0.85rem;">Failed to look up IP address.</p>';
    } finally {
      btn.disabled = false;
      btn.textContent = 'Check IP';
    }
  },

  _renderResult(data) {
    const score = data.abuseConfidenceScore ?? 0;

    // Gauge
    Charts.gauge('ip-gauge', score);

    // Score value + description
    const scoreEl = document.getElementById('ip-score');
    scoreEl.textContent = score + '%';
    scoreEl.style.color = this._scoreColor(score);

    const descEl = document.getElementById('ip-score-desc');
    descEl.textContent = this._scoreLabel(score) + (data._demo ? ' (Demo)' : '');

    // Details grid
    const details = [
      { label: 'IP Address', value: data.ipAddress || '--' },
      { label: 'ISP', value: data.isp || '--' },
      { label: 'Domain', value: data.domain || '--' },
      { label: 'Country', value: data.countryName ? `${data.countryName} (${data.countryCode || ''})` : '--' },
      { label: 'Usage Type', value: data.usageType || '--' },
      { label: 'Total Reports', value: data.totalReports != null ? String(data.totalReports) : '--' },
      { label: 'Last Reported', value: data.lastReportedAt ? UI.formatDate(data.lastReportedAt) : 'Never' },
      { label: 'Whitelisted', value: data.isWhitelisted ? 'Yes' : 'No' },
    ];

    document.getElementById('ip-details').innerHTML = details.map(d => `
      <div class="ip-detail-row">
        <span class="ip-detail-label">${UI.esc(d.label)}</span>
        <span class="ip-detail-value">${UI.esc(d.value)}</span>
      </div>
    `).join('');
  },

  _scoreColor(score) {
    if (score <= 10) return '#10b981';
    if (score <= 30) return '#f59e0b';
    if (score <= 60) return '#f97316';
    return '#ef4444';
  },

  _scoreLabel(score) {
    if (score === 0) return 'Clean';
    if (score <= 10) return 'Low Risk';
    if (score <= 30) return 'Moderate Risk';
    if (score <= 60) return 'High Risk';
    return 'Very High Risk';
  },

  _showError(msg) {
    const banner = document.getElementById('error-banner');
    banner.textContent = msg;
    banner.style.display = 'block';
    setTimeout(() => { banner.style.display = 'none'; }, 4000);
  },
};
