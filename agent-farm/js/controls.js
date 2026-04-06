/* ── Agent Control Buttons (event delegation, no inline handlers) ── */
const Controls = {
  init() {
    // Single delegated listener on the grid
    document.addEventListener('click', (e) => {
      const btn = e.target.closest('.ctrl-btn[data-agent][data-action]');
      if (!btn) return;
      const agentId = btn.dataset.agent;
      const action = btn.dataset.action;
      if (agentId && action) {
        WS.sendCommand(agentId, action);
      }
    });
  },

  renderButtons(agentId, status, isOnline) {
    if (!isOnline) {
      return `<button class="ctrl-btn" disabled title="Not registered">&#8212;</button>`;
    }

    const esc = UI.esc(agentId);
    const isRunning = status === 'running';
    const isPaused = status === 'paused';
    let btns = '';

    if (status === 'idle' || status === 'error') {
      btns += `<button class="ctrl-btn start" data-agent="${esc}" data-action="start" title="Start">&#9654;</button>`;
    }
    if (isRunning) {
      btns += `<button class="ctrl-btn pause" data-agent="${esc}" data-action="pause" title="Pause">&#9646;&#9646;</button>`;
      btns += `<button class="ctrl-btn stop" data-agent="${esc}" data-action="stop" title="Stop">&#9632;</button>`;
    }
    if (isPaused) {
      btns += `<button class="ctrl-btn start" data-agent="${esc}" data-action="pause" title="Resume">&#9654;</button>`;
      btns += `<button class="ctrl-btn stop" data-agent="${esc}" data-action="stop" title="Stop">&#9632;</button>`;
    }

    return btns;
  },
};
