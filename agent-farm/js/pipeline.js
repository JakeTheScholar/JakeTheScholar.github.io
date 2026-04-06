/* ── Multi-Pipeline Dashboard View ── */

const INDUSTRY_LABELS = {
  hvac_plumbing: 'HVAC & Plumbing', dental_ortho: 'Dental & Ortho',
  real_estate: 'Real Estate', auto_repair: 'Auto Repair',
  landscaping: 'Landscaping', legal_services: 'Legal Services',
  home_services: 'Home Services', medical_spa: 'Medical Spa',
};

// Stage color ramps per pipeline type
const STAGE_RAMPS = {
  leadgen:  ['#06b6d4', '#3b82f6', '#8b5cf6', '#f59e0b', '#34d399', '#39ff14'],
  etsy:     ['#f59e0b', '#fb923c', '#39ff14', '#34d399', '#06b6d4'],
  fiverr:   ['#8b5cf6', '#a78bfa', '#c4b5fd', '#34d399', '#39ff14'],
  content:  ['#34d399', '#06b6d4', '#3b82f6', '#8b5cf6', '#39ff14'],
  audio:    ['#fb923c', '#f59e0b', '#34d399', '#39ff14'],
  websites: ['#f472b6', '#a78bfa', '#39ff14'],
};

const Pipeline = {
  pipelineTypes: null,  // from /api/pipeline/types
  allStats: null,       // from /api/pipeline/all-stats
  items: null,          // from /api/pipeline/items
  leadgenLeads: null,   // from /api/pipeline/leads (legacy)
  activeType: 'leadgen',
  refreshTimer: null,

  init() {},

  async fetchData() {
    const token = Store.get('api_key');
    if (!token) return;
    const headers = { Authorization: `Bearer ${token}` };

    try {
      const [typesRes, allStatsRes] = await Promise.all([
        fetch('/api/pipeline/types', { headers }),
        fetch('/api/pipeline/all-stats', { headers }),
      ]);
      if (typesRes.ok) this.pipelineTypes = await typesRes.json();
      if (allStatsRes.ok) this.allStats = await allStatsRes.json();

      // Fetch type-specific data
      if (this.activeType === 'leadgen') {
        const [leadsRes, stagesRes] = await Promise.all([
          fetch('/api/pipeline/leads?limit=20', { headers }),
          fetch('/api/pipeline/stages', { headers }),
        ]);
        if (leadsRes.ok) this.leadgenLeads = await leadsRes.json();
      } else {
        const [itemsRes, stagesRes] = await Promise.all([
          fetch(`/api/pipeline/items?pipeline_type=${this.activeType}&limit=20`, { headers }),
          fetch(`/api/pipeline/items/stages?pipeline_type=${this.activeType}`, { headers }),
        ]);
        if (itemsRes.ok) this.items = await itemsRes.json();
      }
    } catch (e) {
      console.error('[Pipeline] Fetch error:', e);
    }
  },

  async render() {
    await this.fetchData();
    const container = document.getElementById('view-pipeline');
    if (!container) return;

    if (!this.allStats || !this.pipelineTypes) {
      container.innerHTML = `<div style="display:flex;align-items:center;justify-content:center;height:100%;color:var(--text-muted);font-family:'Share Tech Mono',monospace;font-size:12px;">Connecting to pipeline...</div>`;
      return;
    }

    container.innerHTML = `
      ${this._renderTypeTabs()}
      ${this._renderOverviewCards()}
      ${this._renderActivePipeline()}
    `;

    // Wire tab clicks
    container.querySelector('.pipeline-type-tabs').addEventListener('click', (e) => {
      const tab = e.target.closest('.pipeline-type-tab');
      if (tab && tab.dataset.type !== this.activeType) {
        this.activeType = tab.dataset.type;
        this.render();
      }
    });

    this.startAutoRefresh();
  },

  _renderTypeTabs() {
    const types = Object.entries(this.pipelineTypes);
    const tabs = types.map(([key, cfg]) => {
      const active = key === this.activeType;
      const stats = this.allStats[key] || {};
      const total = key === 'leadgen' ? (stats.total_leads || 0) : (stats.total || 0);
      return `<div class="pipeline-type-tab ${active ? 'active' : ''}" data-type="${key}" style="${active ? `--tab-color:${cfg.color};border-color:${cfg.color};color:${cfg.color};` : ''}">
        <span>${UI.esc(cfg.label)}</span>
        <span class="pipeline-tab-count">${total}</span>
      </div>`;
    }).join('');
    return `<div class="pipeline-type-tabs">${tabs}</div>`;
  },

  _renderOverviewCards() {
    // Summary across all pipelines
    let totalAll = 0;
    const cards = Object.entries(this.allStats).map(([key, stats]) => {
      const cfg = this.pipelineTypes[key];
      if (!cfg) return '';
      const total = key === 'leadgen' ? (stats.total_leads || 0) : (stats.total || 0);
      totalAll += total;
      const sc = stats.stage_counts || {};
      const lastStage = cfg.stages[cfg.stages.length - 1];
      const completed = sc[lastStage] || 0;
      return `<div class="stat-card" style="border-top:2px solid ${cfg.color};">
        <div class="stat-value" style="color:${cfg.color};">${total}</div>
        <div class="stat-label">${UI.esc(cfg.label)}</div>
        <div style="font-family:'Share Tech Mono',monospace;font-size:9px;color:var(--text-muted);margin-top:4px;">${completed} ${UI.esc(cfg.stage_labels[lastStage] || lastStage)}</div>
      </div>`;
    }).join('');

    return `<div class="pipeline-stats">${cards}</div>`;
  },

  _renderActivePipeline() {
    const type = this.activeType;
    const cfg = this.pipelineTypes[type];
    if (!cfg) return '';
    const stats = this.allStats[type] || {};
    const sc = stats.stage_counts || {};

    const funnel = this._renderFunnel(cfg, sc, type);

    if (type === 'leadgen') {
      return funnel + this._renderLeadgenTable();
    } else {
      return funnel + this._renderItemsTable(cfg, type);
    }
  },

  _renderFunnel(cfg, sc, type) {
    const ramp = STAGE_RAMPS[type] || STAGE_RAMPS.leadgen;
    const maxCount = Math.max(...cfg.stages.map(s => sc[s] || 0), 1);

    const rows = cfg.stages.map((stage, i) => {
      const count = sc[stage] || 0;
      const pct = maxCount > 0 ? (count / maxCount) * 100 : 0;
      const color = ramp[i % ramp.length];
      const label = cfg.stage_labels[stage] || stage;

      return `<div class="funnel-row">
        <div class="funnel-label">${UI.esc(label)}</div>
        <div class="funnel-bar-bg">
          <div class="funnel-bar" style="width:${pct}%;background:${color};opacity:0.7;"></div>
        </div>
        <div class="funnel-count">${count}</div>
      </div>`;
    }).join('');

    return `<div class="funnel-section"><div class="funnel-title" style="color:${cfg.color};">${UI.esc(cfg.label)} Funnel</div>${rows}</div>`;
  },

  _renderLeadgenTable() {
    const leads = this.leadgenLeads;
    if (!leads || leads.length === 0) {
      return `<div class="leads-section">
        <div class="leads-title">Recent Leads</div>
        <div style="text-align:center;padding:20px;color:var(--text-muted);font-family:'Share Tech Mono',monospace;font-size:11px;">
          No leads yet — start the Lead Scraper agent to begin
        </div></div>`;
    }

    const ramp = STAGE_RAMPS.leadgen;
    const stageIdx = { scraped: 0, researched: 1, pitch_ready: 2, contacted: 3, responded: 4, closed: 5 };

    const rows = leads.map(lead => {
      const color = ramp[stageIdx[lead.stage] || 0];
      const industry = INDUSTRY_LABELS[lead.industry] || lead.industry || '—';
      const score = lead.score || 0;
      const scoreColor = score >= 70 ? '#34d399' : score >= 50 ? '#fbbf24' : '#f87171';
      return `<tr>
        <td>${UI.esc(lead.business_name || '—')}</td>
        <td>${UI.esc(industry)}</td>
        <td><span class="stage-pill" style="background:${color}20;color:${color};border:1px solid ${color}40;">${UI.esc(lead.stage)}</span></td>
        <td style="color:${scoreColor};font-family:'Share Tech Mono',monospace;font-size:12px;">${score}</td>
        <td style="font-family:'Share Tech Mono',monospace;font-size:10px;color:var(--text-muted);">${UI.esc(lead.contact_name || '—')}</td>
        <td style="font-family:'Share Tech Mono',monospace;font-size:10px;color:var(--text-muted);">${UI.esc(lead.location || '—')}</td>
      </tr>`;
    }).join('');

    return `<div class="leads-section">
      <div class="leads-title">Recent Leads</div>
      <table class="leads-table">
        <thead><tr><th>Business</th><th>Industry</th><th>Stage</th><th>Score</th><th>Contact</th><th>Location</th></tr></thead>
        <tbody>${rows}</tbody>
      </table></div>`;
  },

  _renderItemsTable(cfg, type) {
    const items = this.items;
    if (!items || items.length === 0) {
      return `<div class="leads-section">
        <div class="leads-title">Recent ${UI.esc(cfg.label)} Items</div>
        <div style="text-align:center;padding:20px;color:var(--text-muted);font-family:'Share Tech Mono',monospace;font-size:11px;">
          No items yet — start the relevant agents to begin tracking
        </div></div>`;
    }

    const ramp = STAGE_RAMPS[type] || STAGE_RAMPS.leadgen;
    const stageIdx = {};
    cfg.stages.forEach((s, i) => stageIdx[s] = i);

    const rows = items.map(item => {
      const color = ramp[stageIdx[item.stage] || 0];
      const score = item.score || 0;
      const scoreColor = score >= 70 ? '#34d399' : score >= 50 ? '#fbbf24' : '#f87171';
      const label = cfg.stage_labels[item.stage] || item.stage;
      return `<tr>
        <td>${UI.esc(item.title || '—')}</td>
        <td style="font-size:12px;color:var(--text-muted);">${UI.esc(item.subtitle || '—')}</td>
        <td><span class="stage-pill" style="background:${color}20;color:${color};border:1px solid ${color}40;">${UI.esc(label)}</span></td>
        <td style="color:${scoreColor};font-family:'Share Tech Mono',monospace;font-size:12px;">${score}</td>
        <td style="font-family:'Share Tech Mono',monospace;font-size:10px;color:var(--text-muted);">${UI.esc(item.source_agent || '—')}</td>
      </tr>`;
    }).join('');

    return `<div class="leads-section">
      <div class="leads-title">Recent ${UI.esc(cfg.label)} Items</div>
      <table class="leads-table">
        <thead><tr><th>Title</th><th>Detail</th><th>Stage</th><th>Score</th><th>Source</th></tr></thead>
        <tbody>${rows}</tbody>
      </table></div>`;
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
