/* ── Activity Feed ── */
const Feed = {
  entries: [],

  init() {
    // Load cached history
    this.entries = Store.getFeedHistory();
    WS.on((msg) => this.handleMessage(msg));
  },

  handleMessage(msg) {
    if (msg.type === 'agent_event') {
      const entry = {
        timestamp: msg.timestamp || new Date().toISOString(),
        agent_id: msg.agent_id,
        action: msg.data?.action || '?',
        detail: msg.data?.detail || '',
        status: msg.data?.status || 'idle',
      };
      this.entries.push(entry);
      if (this.entries.length > 500) this.entries = this.entries.slice(-500);
      Store.appendFeedEntry(entry);

      // If feed view is visible, append the entry
      const container = document.getElementById('view-feed');
      if (container && container.style.display !== 'none') {
        this._appendEntry(container, entry);
      }
    }

    if (msg.type === 'system_status' && msg.recent_events) {
      for (const evt of msg.recent_events) {
        const entry = {
          timestamp: evt.timestamp || new Date().toISOString(),
          agent_id: evt.agent_id,
          action: evt.data?.action || '?',
          detail: evt.data?.detail || '',
          status: evt.data?.status || 'idle',
        };
        this.entries.push(entry);
      }
      if (this.entries.length > 500) this.entries = this.entries.slice(-500);
    }
  },

  render() {
    const container = document.getElementById('view-feed');
    if (!container) return;

    if (this.entries.length === 0) {
      container.innerHTML = `
        <div style="display:flex; align-items:center; justify-content:center; height:100%; opacity:0.3;">
          <div style="text-align:center; font-family:'Share Tech Mono',monospace; font-size:12px; color:var(--text-muted);">
            No activity yet. Start an agent to see events here.
          </div>
        </div>
      `;
      return;
    }

    container.innerHTML = this.entries.map(e => this._renderEntry(e)).join('');
    container.scrollTop = container.scrollHeight;
  },

  _renderEntry(entry) {
    const slot = AGENT_SLOTS.find(s => s.id === entry.agent_id);
    const color = slot ? slot.color : 'var(--text-muted)';
    const name = slot ? slot.name : entry.agent_id;

    return `
      <div class="feed-entry">
        <div class="feed-time">${UI.formatTime(entry.timestamp)}</div>
        <div class="feed-agent" style="color:${color}">${UI.esc(name)}</div>
        <div class="feed-detail">
          <span style="color:${color};">${UI.esc(entry.action)}</span>
          ${UI.esc(entry.detail)}
        </div>
        <div class="feed-badge">${UI.statusBadge(entry.status)}</div>
      </div>
    `;
  },

  _appendEntry(container, entry) {
    const placeholder = container.querySelector('div[style*="justify-content:center"]');
    if (placeholder) container.innerHTML = '';

    const div = document.createElement('div');
    div.innerHTML = this._renderEntry(entry);
    container.appendChild(div.firstElementChild);
    container.scrollTop = container.scrollHeight;
  },
};
