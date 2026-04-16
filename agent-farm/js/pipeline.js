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
  pipelineTypes: null,
  allStats: null,
  items: null,
  leadgenLeads: null,
  activeType: 'leadgen',
  refreshTimer: null,

  init() {},

  async fetchData() {
    const cfg = Store.getConfig();
    const token = cfg.apiKey;
    if (!token) return;
    const headers = { Authorization: `Bearer ${token}` };

    try {
      const [typesRes, allStatsRes] = await Promise.all([
        fetch('/api/pipeline/types', { headers }),
        fetch('/api/pipeline/all-stats', { headers }),
      ]);
      if (typesRes.ok) this.pipelineTypes = await typesRes.json();
      if (allStatsRes.ok) this.allStats = await allStatsRes.json();

      if (this.activeType === 'leadgen') {
        const [leadsRes] = await Promise.all([
          fetch('/api/pipeline/leads?limit=20', { headers }),
          fetch('/api/pipeline/stages', { headers }),
        ]);
        if (leadsRes.ok) this.leadgenLeads = await leadsRes.json();
      } else {
        const [itemsRes] = await Promise.all([
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
      container.innerHTML = `<div style="display:flex;align-items:center;justify-content:center;height:200px;color:var(--text-muted);font-family:'Rajdhani',sans-serif;font-size:14px;letter-spacing:1px;">Connecting to pipeline...</div>`;
      return;
    }

    // Calculate totals for summary bar
    let grandTotal = 0;
    let activeCount = 0;
    Object.entries(this.allStats).forEach(([key, stats]) => {
      const total = key === 'leadgen' ? (stats.total_leads || 0) : (stats.total || 0);
      grandTotal += total;
      if (total > 0) activeCount++;
    });

    // Websites built (no-website lead flow) — pull from "websites" pipeline stats
    const siteStats = this.allStats.websites || {};
    const sitesBuilt = siteStats.total || 0;
    const sitesDelivered = (siteStats.stage_counts && siteStats.stage_counts.delivered) || 0;
    // Mockup drafts in Gmail awaiting Jake's review (populated by manager agent)
    const mockupDraftStats = this.allStats.mockup_drafts || {};
    const mockupDrafts = mockupDraftStats.pending_review || 0;

    container.innerHTML = `
      <div class="pipeline-summary-bar">
        <div class="pipeline-summary-item">
          <span class="pipeline-summary-num">${grandTotal}</span>
          <span class="pipeline-summary-lbl">Total Items</span>
        </div>
        <div class="pipeline-summary-item">
          <span class="pipeline-summary-num">${activeCount}</span>
          <span class="pipeline-summary-lbl">Active Pipelines</span>
        </div>
        <div class="pipeline-summary-item">
          <span class="pipeline-summary-num">${Object.keys(this.pipelineTypes).length}</span>
          <span class="pipeline-summary-lbl">Pipeline Types</span>
        </div>
        <div class="pipeline-summary-item" style="--accent:#f472b6;">
          <span class="pipeline-summary-num" style="color:#f472b6;">${sitesBuilt}</span>
          <span class="pipeline-summary-lbl">Websites Built${sitesDelivered ? ` · ${sitesDelivered} delivered` : ''}</span>
        </div>
        <div class="pipeline-summary-item" style="--accent:#fbbf24;">
          <span class="pipeline-summary-num" style="color:#fbbf24;">${mockupDrafts}</span>
          <span class="pipeline-summary-lbl">Mockup Drafts${mockupDrafts ? ' · awaiting review' : ''}</span>
        </div>
      </div>
      ${this._renderTypeTabs()}
      ${this._renderOverviewCards()}
      ${this._renderActivePipeline()}
    `;

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
    const cards = Object.entries(this.allStats).map(([key, stats]) => {
      const cfg = this.pipelineTypes[key];
      if (!cfg) return '';
      const total = key === 'leadgen' ? (stats.total_leads || 0) : (stats.total || 0);
      const sc = stats.stage_counts || {};
      const lastStage = cfg.stages[cfg.stages.length - 1];
      const completed = sc[lastStage] || 0;
      const completionRate = total > 0 ? ((completed / total) * 100).toFixed(0) : '0';
      return `<div class="stat-card" style="--card-accent:${cfg.color};">
        <div class="stat-value" style="color:${cfg.color};">${total}</div>
        <div class="stat-label">${UI.esc(cfg.label)}</div>
        <div class="stat-sub">${completed} ${UI.esc(cfg.stage_labels[lastStage] || lastStage)} · ${completionRate}%</div>
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
    const total = cfg.stages.reduce((sum, s) => sum + (sc[s] || 0), 0);

    const rows = cfg.stages.map((stage, i) => {
      const count = sc[stage] || 0;
      const pct = maxCount > 0 ? (count / maxCount) * 100 : 0;
      const shareOfTotal = total > 0 ? ((count / total) * 100).toFixed(0) : '0';
      const color = ramp[i % ramp.length];
      const label = cfg.stage_labels[stage] || stage;

      return `<div class="funnel-row">
        <div class="funnel-label">${UI.esc(label)}</div>
        <div class="funnel-bar-bg">
          <div class="funnel-bar" style="width:${pct}%;background:${color};"></div>
        </div>
        <div class="funnel-count">${count}<span style="opacity:0.4;font-size:10px;margin-left:4px;">${shareOfTotal}%</span></div>
      </div>`;
    }).join('');

    return `<div class="funnel-section"><div class="funnel-title" style="color:${cfg.color};">${UI.esc(cfg.label)} Funnel</div>${rows}</div>`;
  },

  _renderLeadgenTable() {
    const leads = this.leadgenLeads;
    if (!leads || leads.length === 0) {
      return `<div class="leads-section">
        <div class="leads-title">Recent Leads</div>
        <div style="text-align:center;padding:30px;color:var(--text-muted);font-family:'Rajdhani',sans-serif;font-size:13px;">
          No leads yet — start the Lead Scraper agent
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
        <td style="font-weight:600;color:var(--text);">${UI.esc(lead.business_name || '—')}</td>
        <td>${UI.esc(industry)}</td>
        <td><span class="stage-pill" style="background:${color}15;color:${color};border:1px solid ${color}30;">${UI.esc(lead.stage)}</span></td>
        <td><span class="num" style="color:${scoreColor};font-size:14px;font-weight:600;">${score}</span></td>
        <td style="font-size:12px;color:var(--text-muted);">${UI.esc(lead.contact_name || '—')}</td>
        <td style="font-size:12px;color:var(--text-muted);">${UI.esc(lead.location || '—')}</td>
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
        <div style="text-align:center;padding:30px;color:var(--text-muted);font-family:'Rajdhani',sans-serif;font-size:13px;">
          No items yet — start the relevant agents
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
        <td style="font-weight:600;color:var(--text);">${UI.esc(item.title || '—')}</td>
        <td style="font-size:12px;color:var(--text-muted);">${UI.esc(item.subtitle || '—')}</td>
        <td><span class="stage-pill" style="background:${color}15;color:${color};border:1px solid ${color}30;">${UI.esc(label)}</span></td>
        <td><span class="num" style="color:${scoreColor};font-size:14px;font-weight:600;">${score}</span></td>
        <td style="font-size:12px;color:var(--text-muted);">${UI.esc(item.source_agent || '—')}</td>
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
