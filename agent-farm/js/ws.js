/* ── WebSocket client with auth + auto-reconnect ── */
const WS = {
  socket: null,
  connected: false,
  reconnectDelay: 1000,
  maxReconnectDelay: 30000,
  listeners: [],

  connect() {
    const cfg = Store.getConfig();
    this._updateStatus('connecting');

    // Append auth token as query param
    let url = cfg.serverUrl;
    if (cfg.apiKey) {
      const sep = url.includes('?') ? '&' : '?';
      url += `${sep}token=${encodeURIComponent(cfg.apiKey)}`;
    }

    try {
      this.socket = new WebSocket(url);
    } catch (e) {
      this._scheduleReconnect();
      return;
    }

    this.socket.onopen = () => {
      this.connected = true;
      this.reconnectDelay = 1000;
      this._updateStatus('connected');
    };

    this.socket.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        this._dispatch(msg);
      } catch (e) {
        // Ignore malformed messages
      }
    };

    this.socket.onclose = (e) => {
      this.connected = false;
      if (e.code === 4001) {
        this._updateStatus('disconnected');
        // Don't auto-reconnect on auth failure
        return;
      }
      this._updateStatus('disconnected');
      this._scheduleReconnect();
    };

    this.socket.onerror = () => {};
  },

  send(msg) {
    if (this.socket && this.connected) {
      this.socket.send(JSON.stringify(msg));
    }
  },

  sendCommand(agentId, action) {
    this.send({ type: 'command', agent_id: agentId, action });
  },

  on(callback) {
    this.listeners.push(callback);
  },

  _dispatch(msg) {
    for (const cb of this.listeners) {
      try { cb(msg); } catch (e) { /* ignore listener errors */ }
    }
  },

  _scheduleReconnect() {
    setTimeout(() => {
      this.reconnectDelay = Math.min(this.reconnectDelay * 1.5, this.maxReconnectDelay);
      this.connect();
    }, this.reconnectDelay);
  },

  _updateStatus(state) {
    const el = document.getElementById('connection-status');
    if (!el) return;
    const dot = el.querySelector('.status-dot');
    const label = el.querySelector('span:last-child');
    dot.className = `status-dot ${state}`;
    label.textContent = state.toUpperCase();
  },
};
