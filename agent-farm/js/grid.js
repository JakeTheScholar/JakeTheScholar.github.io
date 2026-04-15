/* ── Agent Grid Renderer ── */

// ─── Agent Categories ───

const CATEGORIES = {
  executive: {
    label: 'Executive',
    gridClass: 'exec-grid',
    slots: [
      { id: 'ceo-001', name: 'CEO', color: '#ffd700', description: 'Strategic oversight — monitors all departments and sets priorities' },
      { id: 'cfo-001', name: 'CFO', color: '#00e676', description: 'Financial oversight — revenue tracking, ROI analysis, cost optimization' },
      { id: 'coo-001', name: 'COO', color: '#ff6e40', description: 'Operations management — throughput, uptime, workflow optimization' },
      { id: 'cmo-001', name: 'CMO', color: '#e040fb', description: 'Marketing strategy — campaigns, social, ads, brand growth' },
      { id: 'cto-001', name: 'CTO', color: '#448aff', description: 'Technology oversight — LLM health, API status, automation efficiency' },
      { id: 'cco-001', name: 'CCO', color: '#ff4081', description: 'Content strategy — quality control, publishing calendar, brand voice' },
    ],
  },
  content: {
    label: 'Content',
    gridClass: 'content-grid',
    slots: [
      { id: 'printables-001', name: 'Printables Designer', color: '#00d4ff', description: 'Financial templates for Etsy' },
      { id: 'etsy-lister-001', name: 'Etsy Lister', color: '#39ff14', description: 'Listing copy & SEO optimization' },
      { id: 'social-001', name: 'Social Content', color: '#c9a96e', description: 'Social media posts & captions' },
      { id: 'fiverr-001', name: 'Fiverr Gigs', color: '#8b5cf6', description: 'Gig management & delivery' },
      { id: 'thumbnail-001', name: 'Thumbnail Creator', color: '#f472b6', description: 'YouTube thumbnails & visual content' },
      { id: 'research-001', name: 'Research Agent', color: '#fb923c', description: 'Market & trend research' },
      { id: 'analytics-001', name: 'Analytics Agent', color: '#fbbf24', description: 'Sales tracking & A/B testing' },
      { id: 'seo-001', name: 'SEO Agent', color: '#34d399', description: 'Keyword research & optimization' },
      { id: 'scheduler-001', name: 'Content Scheduler', color: '#e879f9', description: 'Cross-platform scheduling' },
    ],
  },
  leadgen: {
    label: 'Lead Gen',
    gridClass: 'quadrant-grid',
    slots: [
      { id: 'lead-scraper-001', name: 'Lead Scraper', color: '#06b6d4', description: 'Discovers & qualifies leads' },
      { id: 'outreach-001', name: 'Outreach Agent', color: '#f59e0b', description: 'Personalized outreach messages' },
      { id: 'follow-up-001', name: 'Follow-Up Agent', color: '#ef4444', description: 'Follow-up sequences for leads' },
      { id: 'pipeline-mgr-001', name: 'Pipeline Manager', color: '#a855f7', description: 'Pipeline ops & status reports' },
    ],
  },
  growth: {
    label: 'Growth',
    gridClass: 'quadrant-grid',
    slots: [
      { id: 'web-dev-001', name: 'Web Dev Agent', color: '#f472b6', description: 'Client site mockups for leads' },
      { id: 'music-001', name: 'Music Agent', color: '#fb923c', description: 'Audio branding & sellable music' },
      { id: 'ad-copy-001', name: 'Ad Copy Agent', color: '#3b82f6', description: 'Paid ad copy & A/B variants' },
      { id: 'review-001', name: 'Review/QA Agent', color: '#14b8a6', description: 'Quality audits on agent output' },
    ],
  },
  revenue: {
    label: 'Revenue',
    gridClass: 'revenue-grid',
    slots: [
      { id: 'image-gen-001', name: 'Image Generator', color: '#e879f9', description: 'YouTube thumbnails & visual content' },
      { id: 'faceless-content-001', name: 'Faceless Content', color: '#f97316', description: 'AI video content production' },
      { id: 'freelance-scraper-001', name: 'Freelance Scraper', color: '#22d3ee', description: 'Scrapes Upwork/Fiverr gigs' },
      { id: 'gumroad-001', name: 'Gumroad Agent', color: '#f472b6', description: 'Gumroad product listings' },
      { id: 'video-producer-001', name: 'Video Producer', color: '#a78bfa', description: 'Full video production pipeline' },
    ],
  },
  operations: {
    label: 'Operations',
    gridClass: 'ops-grid',
    slots: [
      { id: 'manager-001', name: 'Farm Manager', color: '#10b981', description: 'Agent health, stall detection, auto-restart' },
    ],
  },
};

// Flat list for lookups
const AGENT_SLOTS = Object.values(CATEGORIES).flatMap(c => c.slots);

const Grid = {
  agentData: {},
  category: 'executive',
  expandedAgent: null,

  init() {
    this.render();
    WS.on((msg) => this.handleMessage(msg));
  },

  setCategory(cat) {
    if (!CATEGORIES[cat]) return;
    this.category = cat;
    this.expandedAgent = null;
    this.render();
  },

  toggleExpand(agentId) {
    if (this.expandedAgent === agentId) {
      this.expandedAgent = null;
    } else {
      this.expandedAgent = agentId;
    }
    this.render();
  },

  render() {
    const container = document.getElementById('view-grid');
    const catConfig = CATEGORIES[this.category];
    const slots = catConfig.slots;

    // Sub-tabs with agent counts per category
    const tabs = Object.entries(CATEGORIES).map(([key, cfg]) => {
      const active = key === this.category;
      const running = cfg.slots.filter(s => (this.agentData[s.id] || {}).status === 'running').length;
      const countBadge = running > 0 ? `<span class="subtab-count">${running}</span>` : '';
      return `<div class="grid-subtab ${active ? 'active' : ''}" data-cat="${key}">${cfg.label}${countBadge}</div>`;
    }).join('');

    // If an agent is expanded, show split layout
    const expandedSlot = this.expandedAgent ? slots.find(s => s.id === this.expandedAgent) : null;

    let gridContent;
    if (expandedSlot) {
      gridContent = `
        <div class="grid-split">
          <div class="grid-split-list">
            ${slots.map(slot => this._renderCard(slot, true)).join('')}
          </div>
          <div class="grid-split-detail">
            ${this._renderDetail(expandedSlot)}
          </div>
        </div>`;
    } else {
      gridContent = `
        <div class="agent-grid-inner ${catConfig.gridClass}">
          ${slots.map(slot => this._renderCard(slot, false)).join('')}
        </div>`;
    }

    container.innerHTML = `<div class="grid-subtabs">${tabs}</div>${gridContent}`;

    // Tab clicks
    container.querySelector('.grid-subtabs').addEventListener('click', (e) => {
      const tab = e.target.closest('.grid-subtab');
      if (tab) this.setCategory(tab.dataset.cat);
    });

    // Card clicks for expand
    container.querySelectorAll('.agent-card').forEach(card => {
      card.addEventListener('click', (e) => {
        // Don't expand if clicking a control button
        if (e.target.closest('.ctrl-btn')) return;
        const id = card.id.replace('card-', '');
        this.toggleExpand(id);
      });
    });
  },

  _renderCard(slot, compact) {
    const data = this.agentData[slot.id] || {};
    const status = data.status || 'offline';
    const tasksCompleted = data.tasks_completed || 0;
    const isOnline = status !== 'offline';
    const isRunning = status === 'running';
    const isExpanded = this.expandedAgent === slot.id;

    if (compact) {
      // Compact card for split view sidebar
      return `
        <div class="agent-card compact ${isRunning ? 'running' : ''} ${isExpanded ? 'selected' : ''}" id="card-${slot.id}" style="--agent-color: ${slot.color}">
          <div class="card-header">
            <div style="min-width:0;">
              <div class="agent-name" style="color: ${isOnline ? slot.color : 'var(--text-muted)'}">${UI.esc(slot.name)}</div>
              <div class="agent-id">${slot.id}</div>
            </div>
            <div style="display:flex; align-items:center; gap:6px;">
              ${UI.statusBadge(status)}
            </div>
          </div>
          <div class="card-footer">
            <div class="task-count">Tasks: <span>${tasksCompleted}</span></div>
            <div class="flex">${Controls.renderButtons(slot.id, status, isOnline)}</div>
          </div>
        </div>`;
    }

    // Full card for grid view
    const recentLog = data.recent_log || [];
    return `
      <div class="agent-card ${isRunning ? 'running' : ''}" id="card-${slot.id}" style="--agent-color: ${slot.color}; cursor:pointer;">
        <div class="card-header">
          <div>
            <div class="agent-name" style="color: ${isOnline ? slot.color : 'var(--text-muted)'}">${UI.esc(slot.name)}</div>
            <div class="agent-id">${slot.id}</div>
          </div>
          ${UI.statusBadge(status)}
        </div>

        <div class="agent-desc">${UI.esc(slot.description)}</div>

        <div class="agent-log" id="log-${slot.id}">
          ${isOnline ? this._renderLog(recentLog, slot.color) : `
            <div style="display:flex; align-items:center; justify-content:center; height:100%; opacity:0.3;">
              <div style="text-align:center;">
                <div style="font-size:20px; margin-bottom:4px; color:${slot.color};">&#9679;</div>
                <div style="font-size:9px; color:var(--text-muted); margin-top:4px;">READY</div>
              </div>
            </div>
          `}
        </div>

        <div class="card-footer">
          <div class="task-count">Tasks: <span>${tasksCompleted}</span></div>
          <div class="flex">
            ${Controls.renderButtons(slot.id, status, isOnline)}
          </div>
        </div>
      </div>
    `;
  },

  _renderDetail(slot) {
    const data = this.agentData[slot.id] || {};
    const status = data.status || 'offline';
    const tasksCompleted = data.tasks_completed || 0;
    const currentTask = data.current_task || null;
    const recentLog = data.recent_log || [];
    const isOnline = status !== 'offline';
    const isRunning = status === 'running';

    const taskInfo = currentTask
      ? `<div class="detail-current-task">
           <div class="detail-label">CURRENT TASK</div>
           <div class="detail-task-type" style="color:${slot.color};">${UI.esc(currentTask.type || 'unknown')}</div>
           <div class="detail-task-desc">${UI.esc(currentTask.description || '')}</div>
         </div>`
      : `<div class="detail-current-task">
           <div class="detail-label">CURRENT TASK</div>
           <div class="detail-task-desc" style="opacity:0.4;">No active task</div>
         </div>`;

    return `
      <div class="detail-panel" style="--agent-color: ${slot.color};">
        <div class="detail-header">
          <div>
            <div class="detail-name" style="color:${slot.color};">${UI.esc(slot.name)}</div>
            <div class="detail-id">${slot.id}</div>
            <div class="detail-desc">${UI.esc(slot.description)}</div>
          </div>
          <div style="text-align:right;">
            ${UI.statusBadge(status)}
            <div class="detail-controls" style="margin-top:8px;">
              ${Controls.renderButtons(slot.id, status, isOnline)}
            </div>
          </div>
        </div>

        <div class="detail-stats">
          <div class="detail-stat">
            <div class="detail-stat-val" style="color:${slot.color};">${tasksCompleted}</div>
            <div class="detail-stat-lbl">TASKS DONE</div>
          </div>
          <div class="detail-stat">
            <div class="detail-stat-val" style="color:${isRunning ? 'var(--neon)' : 'var(--text-muted)'};">${isRunning ? 'LIVE' : status.toUpperCase()}</div>
            <div class="detail-stat-lbl">STATUS</div>
          </div>
          <div class="detail-stat">
            <div class="detail-stat-val" style="color:var(--text-secondary);">${recentLog.length}</div>
            <div class="detail-stat-lbl">LOG ENTRIES</div>
          </div>
        </div>

        ${taskInfo}

        <div class="detail-log-section">
          <div class="detail-label">ACTIVITY LOG</div>
          <div class="detail-log">
            ${recentLog.length > 0
              ? recentLog.slice().reverse().map(e => {
                  const d = e.data || {};
                  const actionClass = d.action === 'error' ? 'error' : (d.action === 'completed' ? 'completed' : '');
                  return `<div class="detail-log-entry">
                    <span class="log-time">${UI.formatTimeShort(e.timestamp)}</span>
                    <span class="log-action ${actionClass}">${UI.esc(d.action || '?')}</span>
                    <span style="color:var(--text-muted);"> ${UI.esc((d.detail || '').substring(0, 200))}</span>
                  </div>`;
                }).join('')
              : '<div class="detail-log-entry" style="opacity:0.3;">No activity yet</div>'
            }
          </div>
        </div>
      </div>
    `;
  },

  _renderLog(entries, color) {
    if (!entries || entries.length === 0) {
      return '<div class="log-entry" style="opacity:0.3;">Waiting for activity...</div>';
    }
    return entries.slice(-5).map(e => {
      const d = e.data || {};
      const actionClass = d.action === 'error' ? 'error' : (d.action === 'completed' ? 'completed' : '');
      return `<div class="log-entry">
        <span class="log-time">${UI.formatTimeShort(e.timestamp)}</span>
        <span class="log-action ${actionClass}">${UI.esc(d.action || '?')}</span>
        <span style="color:var(--text-muted);"> ${UI.esc((d.detail || '').substring(0, 60))}</span>
      </div>`;
    }).join('');
  },

  handleMessage(msg) {
    if (msg.type === 'system_status') {
      const agents = msg.agents || {};
      for (const [id, info] of Object.entries(agents)) {
        this.agentData[id] = info;
      }
      const events = msg.recent_events || [];
      for (const evt of events) {
        const aid = evt.agent_id;
        if (this.agentData[aid]) {
          if (!this.agentData[aid].recent_log) this.agentData[aid].recent_log = [];
          this.agentData[aid].recent_log.push(evt);
          if (this.agentData[aid].recent_log.length > 10) {
            this.agentData[aid].recent_log = this.agentData[aid].recent_log.slice(-10);
          }
        }
      }
      this.render();
    }

    if (msg.type === 'agent_event') {
      const aid = msg.agent_id;
      if (!this.agentData[aid]) this.agentData[aid] = {};
      const data = msg.data || {};
      this.agentData[aid].status = data.status;
      this.agentData[aid].tasks_completed = data.tasks_completed;
      this.agentData[aid].current_task = data.current_task;
      if (!this.agentData[aid].recent_log) this.agentData[aid].recent_log = [];
      this.agentData[aid].recent_log.push(msg);
      if (this.agentData[aid].recent_log.length > 10) {
        this.agentData[aid].recent_log = this.agentData[aid].recent_log.slice(-10);
      }

      this._updateCard(aid);
    }
  },

  _updateCard(agentId) {
    // If this agent is in the expanded detail, re-render the whole view
    if (this.expandedAgent === agentId) {
      this.render();
      return;
    }

    const slot = AGENT_SLOTS.find(s => s.id === agentId);
    if (!slot) return;
    const el = document.getElementById(`card-${agentId}`);
    if (!el) return;

    const temp = document.createElement('div');
    const isCompact = this.expandedAgent !== null;
    temp.innerHTML = this._renderCard(slot, isCompact);
    const newCard = temp.firstElementChild;
    el.replaceWith(newCard);

    // Re-attach click handler
    newCard.addEventListener('click', (e) => {
      if (e.target.closest('.ctrl-btn')) return;
      this.toggleExpand(agentId);
    });

    const log = document.getElementById(`log-${agentId}`);
    if (log) log.scrollTop = log.scrollHeight;
  },
};
