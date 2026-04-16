/* ── Metrics Dashboard View ── */

const Metrics = {
  data: null,
  refreshTimer: null,

  init() {},

  async fetchData() {
    const cfg = Store.getConfig();
    const token = cfg.apiKey;
    if (!token) return;
    const headers = { Authorization: `Bearer ${token}` };

    try {
      const [metricsRes, allStatsRes] = await Promise.all([
        fetch('/api/pipeline/metrics', { headers }),
        fetch('/api/pipeline/all-stats', { headers }),
      ]);
      if (metricsRes.ok) this.data = await metricsRes.json();
      if (allStatsRes.ok) this.allStats = await allStatsRes.json();
    } catch (e) {
      console.error('[Metrics] Fetch error:', e);
    }
  },

  async render() {
    await this.fetchData();
    const container = document.getElementById('view-metrics');
    if (!container) return;

    if (!this.data) {
      container.innerHTML = `<div style="display:flex;align-items:center;justify-content:center;height:200px;color:var(--text-muted);font-family:'Rajdhani',sans-serif;font-size:14px;letter-spacing:1px;">Loading metrics...</div>`;
      return;
    }

    const d = this.data;
    container.innerHTML = `
      ${this._renderKPIs(d)}
      <div class="metrics-row">
        ${this._renderFunnel(d.funnel)}
        ${this._renderScoreDistribution(d.score_distribution)}
      </div>
      <div class="metrics-row">
        ${this._renderLeadQuality(d.lead_quality)}
        ${this._renderOutreachROI(d.outreach_roi)}
      </div>
      <div class="metrics-row">
        ${this._renderIndustry(d.industry)}
      </div>
      <div class="metrics-row">
        ${this._renderAgentVelocity(d.agent_velocity)}
        ${this._renderOutreachStats(d.outreach)}
      </div>
      <div class="metrics-row">
        ${this._renderCampaigns(d.campaigns)}
        ${this._renderSourceAgents(d.source_agents)}
      </div>
      ${this._renderCreationTrend(d.creation_trend)}
    `;

    this.startAutoRefresh();
  },

  /* ── KPI Row ── */
  _renderKPIs(d) {
    const funnel = d.funnel || [];
    const firstCount = funnel.length > 0 ? funnel[0].from_count : 0;
    const lastCount = funnel.length > 0 ? funnel[funnel.length - 1].to_count : 0;
    const convRate = firstCount > 0 ? ((lastCount / firstCount) * 100).toFixed(1) : '0.0';

    const avgScore = d.score_distribution ? (d.score_distribution.avg || 0).toFixed(1) : '0.0';
    const sendRate = d.outreach ? ((d.outreach.send_rate || 0) * 100).toFixed(0) : '0';
    const totalLeads = firstCount;
    const outreachTotal = d.outreach ? (d.outreach.total || 0) : 0;

    // Websites built (no-website lead flow)
    const siteStats = (this.allStats && this.allStats.websites) || {};
    const sitesBuilt = siteStats.total || 0;
    // Mockup drafts sitting in Gmail awaiting Jake's review
    const mockupDrafts = (this.allStats && this.allStats.mockup_drafts)
      ? (this.allStats.mockup_drafts.pending_review || 0)
      : 0;

    return `<div class="metrics-kpi-row">
      ${this._kpiCard(totalLeads, 'Total Leads', 'var(--cyber)', '◆')}
      ${this._kpiCard(convRate + '%', 'Close Rate', 'var(--neon)', '▲')}
      ${this._kpiCard(avgScore, 'Avg Score', 'var(--violet)', '●')}
      ${this._kpiCard(sendRate + '%', 'Send Rate', 'var(--gold)', '◉')}
      ${this._kpiCard(outreachTotal, 'Outreach', 'var(--rose)', '✦')}
      ${this._kpiCard(sitesBuilt, 'Websites Built', '#f472b6', '◈')}
      ${this._kpiCard(mockupDrafts, 'Mockup Drafts', '#fbbf24', '✉')}
    </div>`;
  },

  _kpiCard(value, label, color, icon) {
    return `<div class="stat-card" style="--card-accent:${color};">
      <div style="display:flex;align-items:center;justify-content:center;gap:8px;">
        <span style="color:${color};opacity:0.4;font-size:12px;">${icon}</span>
        <div class="stat-value num" style="color:${color};">${value}</div>
      </div>
      <div class="stat-label">${label}</div>
    </div>`;
  },

  /* ── Funnel Conversion ── */
  _renderFunnel(funnel) {
    if (!funnel || funnel.length === 0) return '<div class="metrics-card flex-1"><div class="metrics-card-title" style="color:var(--cyber);">Funnel Conversion</div><div style="color:var(--text-muted);font-size:13px;padding:20px 0;text-align:center;">No funnel data yet</div></div>';

    const stages = [];
    funnel.forEach((f, i) => {
      if (i === 0) stages.push({ stage: f.from_stage, count: f.from_count });
      stages.push({ stage: f.to_stage, count: f.to_count, conversion_rate: f.conversion_rate });
    });

    const maxCount = Math.max(...stages.map(s => s.count), 1);
    const ramp = ['#06b6d4', '#3b82f6', '#8b5cf6', '#f59e0b', '#34d399', '#39ff14'];

    const rows = stages.map((s, i) => {
      const pct = (s.count / maxCount) * 100;
      const color = ramp[i % ramp.length];
      const convLabel = s.conversion_rate != null
        ? `<span style="color:${color};font-family:'Space Grotesk',sans-serif;font-size:11px;font-weight:600;margin-left:8px;">${(s.conversion_rate * 100).toFixed(0)}%</span>`
        : '';
      return `<div class="funnel-row">
        <div class="funnel-label">${UI.esc(s.stage)}</div>
        <div class="funnel-bar-bg">
          <div class="funnel-bar" style="width:${pct}%;background:${color};"></div>
        </div>
        <div class="funnel-count"><span class="num">${s.count}</span>${convLabel}</div>
      </div>`;
    }).join('');

    return `<div class="metrics-card flex-1">
      <div class="metrics-card-title" style="color:var(--cyber);">Funnel Conversion</div>
      ${rows}
    </div>`;
  },

  /* ── Score Distribution ── */
  _renderScoreDistribution(sd) {
    if (!sd) return '<div class="metrics-card flex-1"><div class="metrics-card-title" style="color:var(--violet);">Score Distribution</div><div style="color:var(--text-muted);font-size:13px;padding:20px 0;text-align:center;">No score data yet</div></div>';

    const stats = `
      <div class="metrics-stat-grid">
        <div><span class="metrics-stat-val num">${(sd.avg || 0).toFixed(1)}</span><span class="metrics-stat-lbl">Avg</span></div>
        <div><span class="metrics-stat-val num">${sd.median || 0}</span><span class="metrics-stat-lbl">Median</span></div>
        <div><span class="metrics-stat-val num">${sd.p25 || 0}</span><span class="metrics-stat-lbl">P25</span></div>
        <div><span class="metrics-stat-val num">${sd.p75 || 0}</span><span class="metrics-stat-lbl">P75</span></div>
        <div><span class="metrics-stat-val num">${sd.min || 0}</span><span class="metrics-stat-lbl">Min</span></div>
        <div><span class="metrics-stat-val num">${sd.max || 0}</span><span class="metrics-stat-lbl">Max</span></div>
      </div>`;

    const rawBuckets = sd.buckets || {};
    const buckets = Object.entries(rawBuckets).map(([range, count]) => {
      const [min, max] = range.split('-').map(Number);
      return { min_score: min, max_score: max, count };
    }).sort((a, b) => a.min_score - b.min_score);
    const maxBucket = Math.max(...buckets.map(b => b.count), 1);
    const bars = buckets.map(b => {
      const h = Math.max((b.count / maxBucket) * 90, 3);
      const color = b.min_score >= 70 ? '#34d399' : b.min_score >= 40 ? '#fbbf24' : '#f87171';
      return `<div class="metrics-hist-col">
        <div class="metrics-hist-count">${b.count}</div>
        <div class="metrics-hist-bar" style="height:${h}px;background:${color};opacity:0.7;"></div>
        <div class="metrics-hist-label">${b.min_score}–${b.max_score}</div>
      </div>`;
    }).join('');

    return `<div class="metrics-card flex-1">
      <div class="metrics-card-title" style="color:var(--violet);">Score Distribution</div>
      ${stats}
      <div class="metrics-histogram">${bars}</div>
    </div>`;
  },

  /* ── Lead Quality Cohorts ── */
  _renderLeadQuality(lq) {
    if (!lq) return '<div class="metrics-card flex-1"><div class="metrics-card-title" style="color:var(--positive);">Lead Quality</div><div style="color:var(--text-muted);font-size:13px;padding:20px 0;text-align:center;">No quality data yet</div></div>';

    const cohorts = [
      { key: 'high', label: 'High Quality', range: '70–100', color: '#34d399' },
      { key: 'medium', label: 'Medium Quality', range: '40–69', color: '#fbbf24' },
      { key: 'low', label: 'Low Quality', range: '0–39', color: '#f87171' },
    ];

    const cards = cohorts.map(c => {
      const data = lq[c.key] || {};
      const convPct = ((data.conversion_rate || 0) * 100).toFixed(1);
      const count = data.count || 0;
      return `<div class="metrics-cohort" style="border-left:3px solid ${c.color};">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
          <span class="metrics-cohort-label" style="margin-bottom:0;">${c.label}</span>
          <span style="font-family:'Space Grotesk',sans-serif;font-size:10px;font-weight:500;color:var(--text-muted);">${c.range}</span>
        </div>
        <div style="display:flex;gap:20px;align-items:baseline;">
          <div><span class="metrics-stat-val num" style="color:${c.color};font-size:22px;">${count}</span><span class="metrics-stat-lbl">leads</span></div>
          <div><span class="metrics-stat-val num" style="color:${c.color};">${convPct}%</span><span class="metrics-stat-lbl">conv</span></div>
          <div><span class="metrics-stat-val num">${(data.avg_score || 0).toFixed(0)}</span><span class="metrics-stat-lbl">avg</span></div>
        </div>
      </div>`;
    }).join('');

    return `<div class="metrics-card flex-1">
      <div class="metrics-card-title" style="color:var(--positive);">Lead Quality Cohorts</div>
      ${cards}
    </div>`;
  },

  /* ── Outreach ROI ── */
  _renderOutreachROI(roi) {
    if (!roi) return '<div class="metrics-card flex-1"><div class="metrics-card-title" style="color:var(--gold);">Outreach ROI</div><div style="color:var(--text-muted);font-size:13px;padding:20px 0;text-align:center;">No ROI data yet</div></div>';

    const w = roi.with_outreach || {};
    const wo = roi.without_outreach || {};
    const delta = roi.close_rate_delta || 0;
    const deltaColor = delta > 0 ? 'var(--neon)' : delta < 0 ? 'var(--negative)' : 'var(--text-muted)';
    const deltaSign = delta > 0 ? '+' : '';

    return `<div class="metrics-card flex-1">
      <div class="metrics-card-title" style="color:var(--gold);">Outreach ROI</div>
      <div class="metrics-roi-compare">
        <div class="metrics-roi-box" style="border-color:rgba(57,255,20,0.3);">
          <div class="metrics-roi-heading">With Outreach</div>
          <div class="metrics-roi-val num" style="color:var(--neon);">${((w.close_rate || 0) * 100).toFixed(1)}%</div>
          <div class="metrics-roi-sub num">${w.count || 0} leads · ${w.closed || 0} closed</div>
          <div class="metrics-roi-sub num">Avg score: ${(w.avg_score || 0).toFixed(1)}</div>
        </div>
        <div class="metrics-roi-delta num" style="color:${deltaColor};">${deltaSign}${(delta * 100).toFixed(1)}pp</div>
        <div class="metrics-roi-box" style="border-color:rgba(90,84,104,0.3);">
          <div class="metrics-roi-heading">Without Outreach</div>
          <div class="metrics-roi-val num" style="color:var(--text-muted);">${((wo.close_rate || 0) * 100).toFixed(1)}%</div>
          <div class="metrics-roi-sub num">${wo.count || 0} leads · ${wo.closed || 0} closed</div>
          <div class="metrics-roi-sub num">Avg score: ${(wo.avg_score || 0).toFixed(1)}</div>
        </div>
      </div>
    </div>`;
  },

  /* ── Industry Performance ── */
  _renderIndustry(industry) {
    if (!industry || industry.length === 0) return '';

    const rows = industry.map(ind => {
      const closeColor = ind.close_rate >= 0.3 ? '#34d399' : ind.close_rate >= 0.1 ? '#fbbf24' : '#f87171';
      return `<tr>
        <td style="text-transform:capitalize;font-weight:600;color:var(--text);">${UI.esc((ind.industry || '').replace(/_/g, ' '))}</td>
        <td><span class="num" style="font-size:14px;font-weight:600;">${ind.total || 0}</span></td>
        <td><span class="num" style="color:${closeColor};font-size:14px;font-weight:600;">${((ind.close_rate || 0) * 100).toFixed(1)}%</span></td>
        <td><span class="num" style="font-size:13px;">${(ind.avg_days_to_close || 0).toFixed(1)}d</span></td>
        <td><span class="num" style="font-size:13px;">${(ind.avg_score || 0).toFixed(1)}</span></td>
      </tr>`;
    }).join('');

    return `<div class="metrics-card flex-1">
      <div class="metrics-card-title" style="color:var(--cyber);">Industry Performance</div>
      <table class="leads-table">
        <thead><tr><th>Industry</th><th>Leads</th><th>Close Rate</th><th>Avg Days</th><th>Avg Score</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
  },

  /* ── Agent Velocity ── */
  _renderAgentVelocity(velocity) {
    if (!velocity || velocity.length === 0) return '<div class="metrics-card flex-1"><div class="metrics-card-title" style="color:var(--cyber);">Agent Velocity</div><div style="color:var(--text-muted);font-size:13px;padding:20px 0;text-align:center;">No velocity data yet</div></div>';

    const maxItems = Math.max(...velocity.map(v => v.items_created), 1);
    const bars = velocity.map(v => {
      const pct = (v.items_created / maxItems) * 100;
      // Find agent name from AGENT_SLOTS
      const slot = AGENT_SLOTS.find(s => s.id === v.agent_id);
      const name = slot ? slot.name : v.agent_id;
      const color = slot ? slot.color : 'var(--cyber)';
      return `<div class="funnel-row">
        <div class="funnel-label" style="width:140px;font-size:11px;">${UI.esc(name)}</div>
        <div class="funnel-bar-bg">
          <div class="funnel-bar" style="width:${pct}%;background:${color};"></div>
        </div>
        <div class="funnel-count"><span class="num">${v.items_created}</span></div>
      </div>`;
    }).join('');

    return `<div class="metrics-card flex-1">
      <div class="metrics-card-title" style="color:var(--cyber);">Agent Velocity (30d)</div>
      ${bars}
    </div>`;
  },

  /* ── Outreach Stats ── */
  _renderOutreachStats(outreach) {
    if (!outreach) return '<div class="metrics-card flex-1"><div class="metrics-card-title" style="color:var(--rose);">Outreach</div><div style="color:var(--text-muted);font-size:13px;padding:20px 0;text-align:center;">No outreach data yet</div></div>';

    const channels = outreach.by_channel || {};
    const channelRows = Object.entries(channels).map(([ch, count]) => {
      return `<div class="metrics-channel-row">
        <span class="metrics-channel-name">${UI.esc(ch)}</span>
        <span class="metrics-channel-count num">${count}</span>
      </div>`;
    }).join('') || '<div style="color:var(--text-muted);font-size:12px;padding:8px 0;">No channels yet</div>';

    return `<div class="metrics-card flex-1">
      <div class="metrics-card-title" style="color:var(--rose);">Outreach Breakdown</div>
      <div class="metrics-stat-grid" style="margin-bottom:16px;">
        <div><span class="metrics-stat-val num">${outreach.total || 0}</span><span class="metrics-stat-lbl">Total</span></div>
        <div><span class="metrics-stat-val num">${outreach.drafted || 0}</span><span class="metrics-stat-lbl">Drafted</span></div>
        <div><span class="metrics-stat-val num">${outreach.sent || 0}</span><span class="metrics-stat-lbl">Sent</span></div>
        <div><span class="metrics-stat-val num">${(outreach.avg_draft_to_send_hours || 0).toFixed(1)}h</span><span class="metrics-stat-lbl">Avg Send Time</span></div>
      </div>
      <div style="font-family:'Rajdhani',sans-serif;font-size:11px;font-weight:600;letter-spacing:1px;color:var(--text-muted);margin-bottom:8px;text-transform:uppercase;">By Channel</div>
      ${channelRows}
    </div>`;
  },

  /* ── Campaigns ── */
  _renderCampaigns(campaigns) {
    if (!campaigns || campaigns.length === 0) return '<div class="metrics-card flex-1"><div class="metrics-card-title" style="color:var(--warning);">Campaigns</div><div style="color:var(--text-muted);font-size:13px;padding:20px 0;text-align:center;">No campaigns yet</div></div>';

    const cards = campaigns.map(c => {
      const pct = ((c.completion_rate || 0) * 100).toFixed(0);
      const barColor = c.completion_rate >= 1.0 ? 'var(--neon)' : c.completion_rate >= 0.5 ? 'var(--warning)' : 'var(--cyber)';
      const statusColor = c.status === 'completed' ? 'var(--neon)' : c.status === 'active' ? 'var(--cyber)' : 'var(--text-muted)';
      return `<div class="metrics-campaign">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
          <span style="font-family:'Rajdhani',sans-serif;font-size:14px;font-weight:600;color:var(--text);">${UI.esc(c.name)}</span>
          <span class="badge" style="background:${statusColor}15;color:${statusColor};border:1px solid ${statusColor}40;">${UI.esc(c.status)}</span>
        </div>
        <div style="font-family:'Rajdhani',sans-serif;font-size:12px;color:var(--text-muted);margin-bottom:8px;">
          ${UI.esc(c.industry || '')} · <span class="num">${c.days_active || 0}d</span> active · <span class="num">${c.leads_generated || 0}/${c.target_count || 0}</span> leads
        </div>
        <div style="background:rgba(255,255,255,0.03);border-radius:4px;height:6px;overflow:hidden;">
          <div style="height:100%;width:${pct}%;background:${barColor};border-radius:4px;transition:width 0.6s ease;"></div>
        </div>
        <div style="font-family:'Space Grotesk',sans-serif;font-size:11px;font-weight:600;color:${barColor};margin-top:4px;text-align:right;">${pct}%</div>
      </div>`;
    }).join('');

    return `<div class="metrics-card flex-1">
      <div class="metrics-card-title" style="color:var(--warning);">Campaigns</div>
      ${cards}
    </div>`;
  },

  /* ── Source Agent Performance ── */
  _renderSourceAgents(agents) {
    if (!agents || agents.length === 0) return '<div class="metrics-card flex-1"><div class="metrics-card-title" style="color:var(--violet);">Source Agents</div><div style="color:var(--text-muted);font-size:13px;padding:20px 0;text-align:center;">No source agent data yet</div></div>';

    const rows = agents.map(a => {
      const slot = AGENT_SLOTS.find(s => s.id === a.source_agent);
      const name = slot ? slot.name : a.source_agent;
      const color = slot ? slot.color : 'var(--text)';
      return `<tr>
        <td style="font-weight:600;"><span style="color:${color};">●</span> ${UI.esc(name)}</td>
        <td><span class="num" style="font-size:14px;font-weight:600;">${a.items_created || 0}</span></td>
        <td><span class="num" style="font-size:13px;">${(a.avg_score || 0).toFixed(1)}</span></td>
      </tr>`;
    }).join('');

    return `<div class="metrics-card flex-1">
      <div class="metrics-card-title" style="color:var(--violet);">Source Agent Performance</div>
      <table class="leads-table">
        <thead><tr><th>Agent</th><th>Items</th><th>Avg Score</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
  },

  /* ── Creation Trend ── */
  _renderCreationTrend(trend) {
    if (!trend || trend.length === 0) return '';

    const maxCount = Math.max(...trend.map(t => t.count), 1);
    const barWidth = Math.max(Math.floor(100 / Math.max(trend.length, 1)), 2);

    const bars = trend.map(t => {
      const h = Math.max((t.count / maxCount) * 70, 3);
      const dateLabel = t.date ? t.date.slice(5) : '';
      return `<div class="metrics-trend-col" style="flex:1;max-width:${barWidth}%;">
        <div class="metrics-trend-bar" style="height:${h}px;"></div>
        <div class="metrics-trend-date">${dateLabel}</div>
      </div>`;
    }).join('');

    return `<div class="metrics-card" style="margin-top:0;">
      <div class="metrics-card-title" style="color:var(--cyber);">Lead Creation Trend (30d)</div>
      <div class="metrics-trend-chart">${bars}</div>
    </div>`;
  },

  startAutoRefresh() {
    this.stopAutoRefresh();
    this.refreshTimer = setInterval(() => {
      if (App.currentView === 'metrics') this.render();
    }, 60000);
  },

  stopAutoRefresh() {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
      this.refreshTimer = null;
    }
  },
};
