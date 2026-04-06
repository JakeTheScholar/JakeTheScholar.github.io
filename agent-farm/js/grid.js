/* ── Agent Grid Renderer ── */

// Content agents (3x3)
const CONTENT_SLOTS = [
  { id: 'printables-001', name: 'Printables Designer', color: '#00d4ff', description: 'Financial templates for Etsy' },
  { id: 'etsy-lister-001', name: 'Etsy Lister', color: '#39ff14', description: 'Listing copy & SEO optimization' },
  { id: 'social-001', name: 'Social Content', color: '#c9a96e', description: 'Social media posts & captions' },
  { id: 'fiverr-001', name: 'Fiverr Gigs', color: '#8b5cf6', description: 'Gig management & delivery' },
  { id: 'thumbnail-001', name: 'Thumbnail Creator', color: '#f472b6', description: 'Product images & mockups' },
  { id: 'research-001', name: 'Research Agent', color: '#fb923c', description: 'Market & trend research' },
  { id: 'analytics-001', name: 'Analytics Agent', color: '#fbbf24', description: 'Sales tracking & A/B testing' },
  { id: 'seo-001', name: 'SEO Agent', color: '#34d399', description: 'Keyword research & optimization' },
  { id: 'scheduler-001', name: 'Content Scheduler', color: '#e879f9', description: 'Cross-platform scheduling' },
];

// Lead Gen agents (1x3)
const LEADGEN_SLOTS = [
  { id: 'lead-scraper-001', name: 'Lead Scraper', color: '#06b6d4', description: 'Discovers & qualifies leads' },
  { id: 'outreach-001', name: 'Outreach Agent', color: '#f59e0b', description: 'Personalized outreach messages' },
  { id: 'pipeline-mgr-001', name: 'Pipeline Manager', color: '#a855f7', description: 'Pipeline ops & status reports' },
];

const AGENT_SLOTS = [...CONTENT_SLOTS, ...LEADGEN_SLOTS];

const Grid = {
  agentData: {},  // live state from server
  category: 'content',  // 'content' | 'leadgen'

  init() {
    this.render();
    WS.on((msg) => this.handleMessage(msg));
  },

  setCategory(cat) {
    this.category = cat;
    this.render();
    // Update sub-tab styles
    document.querySelectorAll('.grid-subtab').forEach(tab => {
      tab.classList.toggle('active', tab.dataset.cat === cat);
    });
  },

  render() {
    const container = document.getElementById('view-grid');
    const slots = this.category === 'leadgen' ? LEADGEN_SLOTS : CONTENT_SLOTS;
    const isLeadGen = this.category === 'leadgen';

    // Sub-tabs + grid
    container.innerHTML =
      `<div class="grid-subtabs">
        <div class="grid-subtab ${this.category === 'content' ? 'active' : ''}" data-cat="content">Content</div>
        <div class="grid-subtab ${this.category === 'leadgen' ? 'active' : ''}" data-cat="leadgen">Lead Gen</div>
      </div>
      <div class="agent-grid-inner ${isLeadGen ? 'leadgen-grid' : 'content-grid'}">
        ${slots.map(slot => this._renderCard(slot)).join('')}
      </div>`;

    // Wire sub-tab clicks via event delegation
    container.querySelector('.grid-subtabs').addEventListener('click', (e) => {
      const tab = e.target.closest('.grid-subtab');
      if (tab) this.setCategory(tab.dataset.cat);
    });
  },

  _renderCard(slot) {
    const data = this.agentData[slot.id] || {};
    const status = data.status || 'offline';
    const tasksCompleted = data.tasks_completed || 0;
    const recentLog = data.recent_log || [];
    const isOnline = status !== 'offline';
    const isRunning = status === 'running';

    return `
      <div class="agent-card ${isRunning ? 'running' : ''}" id="card-${slot.id}" style="--agent-color: ${slot.color}">
        <div class="card-header">
          <div>
            <div class="agent-name" style="color: ${isOnline ? slot.color : 'var(--text-muted)'}">${UI.esc(slot.name)}</div>
            <div class="agent-id">${slot.id}</div>
          </div>
          ${UI.statusBadge(status)}
        </div>

        <div class="agent-log" id="log-${slot.id}">
          ${isOnline ? this._renderLog(recentLog, slot.color) : `
            <div style="display:flex; align-items:center; justify-content:center; height:100%; opacity:0.3;">
              <div style="text-align:center;">
                <div style="font-size:20px; margin-bottom:4px; color:${slot.color};">&#9679;</div>
                <div style="font-size:10px; color:var(--text-muted);">${UI.esc(slot.description)}</div>
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

  _renderLog(entries, color) {
    if (!entries || entries.length === 0) {
      return '<div class="log-entry" style="opacity:0.3;">Waiting for activity...</div>';
    }
    return entries.map(e => {
      const d = e.data || {};
      const actionClass = d.action === 'error' ? 'error' : (d.action === 'completed' ? 'completed' : '');
      return `<div class="log-entry">
        <span class="log-time">${UI.formatTimeShort(e.timestamp)}</span>
        <span class="log-action ${actionClass}">${UI.esc(d.action || '?')}</span>
        <span style="color:var(--text-muted);"> ${UI.esc((d.detail || '').substring(0, 80))}</span>
      </div>`;
    }).join('');
  },

  handleMessage(msg) {
    if (msg.type === 'system_status') {
      // Full state snapshot
      const agents = msg.agents || {};
      for (const [id, info] of Object.entries(agents)) {
        this.agentData[id] = info;
      }
      // Also populate recent events into agent logs
      const events = msg.recent_events || [];
      for (const evt of events) {
        const aid = evt.agent_id;
        if (this.agentData[aid]) {
          if (!this.agentData[aid].recent_log) this.agentData[aid].recent_log = [];
          this.agentData[aid].recent_log.push(evt);
          // Keep last 10
          if (this.agentData[aid].recent_log.length > 10) {
            this.agentData[aid].recent_log = this.agentData[aid].recent_log.slice(-10);
          }
        }
      }
      this.render();
      this._updateCounter();
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

      // Update just this card
      this._updateCard(aid);
      this._updateCounter();
    }
  },

  _updateCard(agentId) {
    const slot = AGENT_SLOTS.find(s => s.id === agentId);
    if (!slot) return;
    const el = document.getElementById(`card-${agentId}`);
    if (!el) return;

    const temp = document.createElement('div');
    temp.innerHTML = this._renderCard(slot);
    const newCard = temp.firstElementChild;
    el.replaceWith(newCard);

    // Auto-scroll log to bottom
    const log = document.getElementById(`log-${agentId}`);
    if (log) log.scrollTop = log.scrollHeight;
  },

  _updateCounter() {
    const active = Object.values(this.agentData).filter(a => a.status === 'running').length;
    const el = document.getElementById('agent-counter');
    if (el) el.textContent = `${active}/${AGENT_SLOTS.length} ACTIVE`;
  },
};
