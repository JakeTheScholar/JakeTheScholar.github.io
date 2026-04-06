/* ── Settings View ── */
const Settings = {
  init() {
    // Render on first show
  },

  _validateUrl(url, protocols) {
    try {
      const u = new URL(url);
      return protocols.includes(u.protocol);
    } catch { return false; }
  },

  render() {
    const container = document.getElementById('view-settings');
    if (!container) return;

    const cfg = Store.getConfig();

    container.innerHTML = `
      <div class="settings-group">
        <h3>Connection</h3>
        <div class="setting-row">
          <div class="setting-label">WebSocket URL</div>
          <input class="setting-input" id="set-ws-url" value="${UI.esc(cfg.serverUrl)}" placeholder="ws://localhost:8000/ws">
        </div>
        <div class="setting-row">
          <div class="setting-label">API URL</div>
          <input class="setting-input" id="set-api-url" value="${UI.esc(cfg.apiUrl)}" placeholder="http://localhost:8000">
        </div>
        <div class="setting-row">
          <div class="setting-label">API Key</div>
          <input class="setting-input" id="set-api-key" type="password" value="${UI.esc(cfg.apiKey || '')}" placeholder="Paste key from server console">
        </div>
      </div>

      <div class="settings-group">
        <h3>LLM Status</h3>
        <div id="llm-status" style="font-family:'Share Tech Mono',monospace; font-size:12px; color:var(--text-secondary);">
          Loading...
        </div>
      </div>

      <div class="settings-group">
        <h3>Agents</h3>
        <div id="agent-settings">
          ${AGENT_SLOTS.map(slot => {
            const data = Grid.agentData[slot.id];
            const isRegistered = !!data;
            return `
              <div class="setting-row">
                <div class="flex items-center gap-2">
                  <span style="width:8px;height:8px;border-radius:50%;background:${slot.color};display:inline-block;"></span>
                  <span class="setting-label">${UI.esc(slot.name)}</span>
                </div>
                ${UI.statusBadge(isRegistered ? (data.status || 'idle') : 'offline')}
              </div>
            `;
          }).join('')}
        </div>
      </div>

      <div style="text-align:center; margin-top:16px;">
        <button id="save-settings-btn" style="
          font-family:'Orbitron',monospace; font-size:11px; letter-spacing:2px;
          padding:10px 32px; border-radius:4px; cursor:pointer;
          background:rgba(0,212,255,0.1); color:var(--cyber); border:1px solid rgba(0,212,255,0.25);
          text-transform:uppercase; transition:all 0.2s;
        ">
          Save Settings
        </button>
      </div>
    `;

    // Bind events without inline handlers
    const saveBtn = document.getElementById('save-settings-btn');
    if (saveBtn) {
      saveBtn.addEventListener('click', () => Settings.save());
      saveBtn.addEventListener('mouseenter', function() { this.style.background = 'rgba(0,212,255,0.2)'; });
      saveBtn.addEventListener('mouseleave', function() { this.style.background = 'rgba(0,212,255,0.1)'; });
    }

    this._loadLLMStatus();
  },

  async _loadLLMStatus() {
    const cfg = Store.getConfig();
    const el = document.getElementById('llm-status');
    if (!el) return;

    try {
      const headers = cfg.apiKey ? { 'Authorization': `Bearer ${cfg.apiKey}` } : {};
      const r = await fetch(`${cfg.apiUrl}/api/ollama/status`, { headers });
      if (!r.ok) throw new Error('Unauthorized');
      const data = await r.json();
      const models = (data.ollama_models || []).map(m => UI.esc(m)).join(', ') || 'none';
      el.innerHTML = `
        <div class="setting-row">
          <span>Ollama</span>
          ${UI.statusBadge(data.ollama_connected ? 'running' : 'error')}
        </div>
        <div class="setting-row">
          <span>Active Model</span>
          <span style="color:var(--cyber);">${UI.esc(data.active_model || 'none')}</span>
        </div>
        <div class="setting-row">
          <span>Available Models</span>
          <span style="color:var(--text-secondary);">${models}</span>
        </div>
        <div class="setting-row">
          <span>Claude API</span>
          ${UI.statusBadge(data.claude_available ? 'running' : 'idle')}
        </div>
      `;
    } catch {
      el.innerHTML = '<span style="color:var(--negative);">Cannot reach server (check API key)</span>';
    }
  },

  save() {
    const wsUrl = document.getElementById('set-ws-url')?.value;
    const apiUrl = document.getElementById('set-api-url')?.value;
    const apiKey = document.getElementById('set-api-key')?.value;

    if (!wsUrl || !apiUrl) return;

    // Validate URLs
    if (!this._validateUrl(wsUrl, ['ws:', 'wss:'])) {
      alert('WebSocket URL must start with ws:// or wss://');
      return;
    }
    if (!this._validateUrl(apiUrl, ['http:', 'https:'])) {
      alert('API URL must start with http:// or https://');
      return;
    }

    Store.saveConfig({ serverUrl: wsUrl, apiUrl: apiUrl, apiKey: apiKey || '' });
    if (WS.socket) WS.socket.close();
    WS.connect();
  },
};
