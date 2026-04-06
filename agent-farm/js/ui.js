/* ── UI Helpers ── */
const UI = {
  esc(str) {
    const d = document.createElement('div');
    d.textContent = str;
    return d.innerHTML;
  },

  formatTime(iso) {
    if (!iso) return '--:--:--';
    const d = new Date(iso);
    return d.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
  },

  formatTimeShort(iso) {
    if (!iso) return '--:--';
    const d = new Date(iso);
    return d.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' });
  },

  statusBadge(status) {
    const s = this.esc((status || 'offline').toLowerCase());
    const validClasses = ['running', 'idle', 'paused', 'error', 'offline'];
    const cls = validClasses.includes(s) ? s : 'offline';
    return `<span class="badge ${cls}">${s}</span>`;
  },

  $(sel) { return document.querySelector(sel); },
  $$(sel) { return document.querySelectorAll(sel); },
};
