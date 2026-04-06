/* ── Pipeline Dashboard View ── */

const STAGE_COLORS = {
  scraped: '#06b6d4',
  researched: '#3b82f6',
  pitch_ready: '#8b5cf6',
  contacted: '#f59e0b',
  responded: '#34d399',
  closed: '#39ff14',
};

const STAGE_LABELS = {
  scraped: 'Leads Scraped',
  researched: 'Research Done',
  pitch_ready: 'Pitch Ready',
  contacted: 'Contacted',
  responded: 'Responded',
  closed: 'Closed',
};

const INDUSTRY_LABELS = {
  hvac_plumbing: 'HVAC & Plumbing',
  dental_ortho: 'Dental & Ortho',
  real_estate: 'Real Estate',
  auto_repair: 'Auto Repair',
  landscaping: 'Landscaping',
  legal_services: 'Legal Services',
  home_services: 'Home Services',
  medical_spa: 'Medical Spa',
};

const Pipeline = {
  stats: null,
  stages: null,
  leads: null,
  refreshTimer: null,

  init() {
    // Will fetch data when view becomes active
  },

  async fetchData() {
    const token = Store.get('api_key');
    if (!token) return;

    const headers = { Authorization: `Bearer ${token}` };
    try {
      const [statsRes, stagesRes, leadsRes] = await Promise.all([
        fetch('/api/pipeline/stats', { headers }),
        fetch('/api/pipeline/stages', { headers }),
        fetch('/api/pipeline/leads?limit=20', { headers }),
      ]);

      if (statsRes.ok) this.stats = await statsRes.json();
      if (stagesRes.ok) this.stages = await stagesRes.json();
      if (leadsRes.ok) this.leads = await leadsRes.json();
    } catch (e) {
      console.error('[Pipeline] Fetch error:', e);
    }
  },

  async render() {
    await this.fetchData();
    const container = document.getElementById('view-pipeline');
    if (!container) return;

    if (!this.stats) {
      container.innerHTML = `<div style="display:flex;align-items:center;justify-content:center;height:100%;color:var(--text-muted);font-family:'Share Tech Mono',monospace;font-size:12px;">Connecting to pipeline...</div>`;
      return;
    }

    const sc = this.stats.stage_counts || {};
    const total = this.stats.total_leads || 0;
    const outreach = this.stats.outreach_drafted || 0;
    const closed = sc.closed || 0;
    const rate = total > 0 ? ((this.stats.conversion_rate || 0) * 100).toFixed(1) : '0.0';

    container.innerHTML = `
      ${this._renderStats(total, outreach, closed, rate)}
      ${this._renderFunnel(sc, total)}
      ${this._renderLeadsTable()}
    `;

    // Auto-refresh every 30s while visible
    this.startAutoRefresh();
  },

  _renderStats(total, outreach, closed, rate) {
    return `
      <div class="pipeline-stats">
        <div class="stat-card">
          <div class="stat-value" style="color:#06b6d4;">${total}</div>
          <div class="stat-label">Total Leads</div>
        </div>
        <div class="stat-card">
          <div class="stat-value" style="color:#f59e0b;">${outreach}</div>
          <div class="stat-label">Outreach Drafted</div>
        </div>
        <div class="stat-card">
          <div class="stat-value" style="color:#39ff14;">${closed}</div>
          <div class="stat-label">Deals Closed</div>
        </div>
        <div class="stat-card">
          <div class="stat-value" style="color:#8b5cf6;">${rate}%</div>
          <div class="stat-label">Conversion Rate</div>
        </div>
      </div>`;
  },

  _renderFunnel(sc, total) {
    const maxCount = Math.max(...Object.values(sc), 1);
    const stages = ['scraped', 'researched', 'pitch_ready', 'contacted', 'responded', 'closed'];

    const rows = stages.map(stage => {
      const count = sc[stage] || 0;
      const pct = maxCount > 0 ? (count / maxCount) * 100 : 0;
      const color = STAGE_COLORS[stage];
      const label = STAGE_LABELS[stage];

      return `
        <div class="funnel-row">
          <div class="funnel-label">${UI.esc(label)}</div>
          <div class="funnel-bar-bg">
            <div class="funnel-bar" style="width:${pct}%;background:${color};opacity:0.7;"></div>
          </div>
          <div class="funnel-count">${count}</div>
        </div>`;
    }).join('');

    return `<div class="funnel-section"><div class="funnel-title">Pipeline Funnel</div>${rows}</div>`;
  },

  _renderLeadsTable() {
    if (!this.leads || this.leads.length === 0) {
      return `
        <div class="leads-section">
          <div class="leads-title">Recent Leads</div>
          <div style="text-align:center;padding:20px;color:var(--text-muted);font-family:'Share Tech Mono',monospace;font-size:11px;">
            No leads yet — start the Lead Scraper agent to begin
          </div>
        </div>`;
    }

    const rows = this.leads.map(lead => {
      const stageColor = STAGE_COLORS[lead.stage] || '#5a5468';
      const industry = INDUSTRY_LABELS[lead.industry] || lead.industry || '—';
      const score = lead.score || 0;
      const scoreColor = score >= 70 ? '#34d399' : score >= 50 ? '#fbbf24' : '#f87171';

      return `
        <tr>
          <td>${UI.esc(lead.business_name || '—')}</td>
          <td>${UI.esc(industry)}</td>
          <td><span class="stage-pill" style="background:${stageColor}20;color:${stageColor};border:1px solid ${stageColor}40;">${UI.esc(lead.stage)}</span></td>
          <td style="color:${scoreColor};font-family:'Share Tech Mono',monospace;font-size:12px;">${score}</td>
          <td style="font-family:'Share Tech Mono',monospace;font-size:10px;color:var(--text-muted);">${UI.esc(lead.contact_name || '—')}</td>
          <td style="font-family:'Share Tech Mono',monospace;font-size:10px;color:var(--text-muted);">${UI.esc(lead.location || '—')}</td>
        </tr>`;
    }).join('');

    return `
      <div class="leads-section">
        <div class="leads-title">Recent Leads</div>
        <table class="leads-table">
          <thead><tr>
            <th>Business</th><th>Industry</th><th>Stage</th><th>Score</th><th>Contact</th><th>Location</th>
          </tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`;
  },

  startAutoRefresh() {
    this.stopAutoRefresh();
    this.refreshTimer = setInterval(() => {
      if (App.currentView === 'pipeline') this.render();
    }, 30000);
  },

  stopAutoRefresh() {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
      this.refreshTimer = null;
    }
  },
};
