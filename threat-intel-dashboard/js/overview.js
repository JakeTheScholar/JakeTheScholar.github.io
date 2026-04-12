"use strict";

const Overview = {
  _loaded: false,

  async init() {
    if (this._loaded) return;
    this._loaded = true;
    await this.render();
  },

  async render() {
    const statsEl = document.getElementById('overview-stats');
    const trendingEl = document.getElementById('trending-cves');
    const updatedEl = document.getElementById('overview-updated');

    // Show loading
    statsEl.innerHTML = Array(4).fill('<div class="stat-card"><div class="skeleton" style="height:18px;width:60%;margin-bottom:12px;"></div><div class="skeleton" style="height:32px;width:40%;"></div></div>').join('');
    trendingEl.innerHTML = '<div class="loading-overlay"><div class="loading-spinner"></div>Loading threat data...</div>';

    try {
      // Fetch CVEs for overview stats (last 30 days)
      const [allData, criticalCves] = await Promise.all([
        API.fetchCVEs({ resultsPerPage: 100 }),
        API.fetchRecentCritical(),
      ]);

      const vulns = allData.vulnerabilities || [];
      const total = allData.totalResults || vulns.length;

      // Severity counts
      const counts = { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0, NONE: 0 };
      vulns.forEach(v => { if (v.severity in counts) counts[v.severity]++; });

      // Stat cards
      statsEl.innerHTML = [
        { label: 'Total CVEs (30d)', value: total, accent: 'rose' },
        { label: 'Critical', value: counts.CRITICAL, accent: 'critical' },
        { label: 'High Severity', value: counts.HIGH, accent: 'high' },
        { label: 'Avg CVSS Score', value: this._avgScore(vulns), accent: 'medium' },
      ].map(s => `
        <div class="stat-card">
          <div class="accent accent-${s.accent}"></div>
          <div class="stat-label">${UI.esc(s.label)}</div>
          <div class="stat-value sev-${s.accent}">${UI.esc(String(s.value))}</div>
        </div>
      `).join('');

      // Severity donut
      const donutData = [
        { label: 'Critical', value: counts.CRITICAL, color: '#ef4444' },
        { label: 'High', value: counts.HIGH, color: '#ec6d8c' },
        { label: 'Medium', value: counts.MEDIUM, color: '#f59e0b' },
        { label: 'Low', value: counts.LOW, color: '#10b981' },
      ].filter(d => d.value > 0);
      Charts.donut('severity-donut', donutData);

      // 7-day timeline bar chart
      const timeline = this._buildTimeline(vulns);
      Charts.barChart('timeline-bar', timeline);

      // Trending critical CVEs
      if (criticalCves.length === 0) {
        trendingEl.innerHTML = '<p style="color:var(--text-muted);font-size:0.85rem;">No critical vulnerabilities in the current window.</p>';
      } else {
        trendingEl.innerHTML = criticalCves.map(cve => this._cveCard(cve)).join('');
      }

      updatedEl.textContent = 'Last updated: ' + new Date().toLocaleTimeString();

    } catch (err) {
      console.error('Overview.render:', err);
      statsEl.innerHTML = '';
      trendingEl.innerHTML = '<p style="color:var(--rose);font-size:0.85rem;">Failed to load threat data. Using demo mode.</p>';
    }
  },

  _avgScore(vulns) {
    const scored = vulns.filter(v => v.score != null);
    if (scored.length === 0) return '--';
    const avg = scored.reduce((s, v) => s + v.score, 0) / scored.length;
    return avg.toFixed(1);
  },

  _buildTimeline(vulns) {
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      const label = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      days.push({ key, label, value: 0 });
    }

    vulns.forEach(v => {
      if (!v.published) return;
      const pubDate = v.published.slice(0, 10);
      const match = days.find(d => d.key === pubDate);
      if (match) match.value++;
    });

    return days;
  },

  _cveCard(cve) {
    const sevClass = UI.sevClass(cve.severity);
    return `
      <div class="cve-card ${sevClass}">
        <div class="cve-header">
          <span class="cve-id">${UI.esc(cve.id)}</span>
          <span class="cve-score ${sevClass}">${cve.score != null ? cve.score.toFixed(1) : '--'} ${UI.esc(cve.severity)}</span>
          <span class="cve-date">${UI.formatDate(cve.published)}</span>
        </div>
        <div class="cve-desc">${UI.esc(cve.description)}</div>
      </div>
    `;
  },
};
