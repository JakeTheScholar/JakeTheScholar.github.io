"use strict";

const UI = {
  esc(str) {
    if (str === null || str === undefined) return '';
    return String(str).replace(/[&<>"']/g, m =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[m]);
  },

  currency(val) {
    if (val === undefined || val === null) return '$0';
    const abs = Math.abs(val);
    const formatted = abs >= 1000
      ? '$' + abs.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
      : '$' + abs.toFixed(2);
    return val < 0 ? '-' + formatted : formatted;
  },

  currencySign(val) {
    if (val === undefined || val === null) return '$0';
    const prefix = val > 0 ? '+' : '';
    return prefix + UI.currency(val);
  },

  pct(val) { return val.toFixed(1) + '%'; },

  pnlClass(val) { return val >= 0 ? 'color:var(--green)' : 'color:var(--red)'; },

  pnlColor(val) { return val >= 0 ? 'var(--green)' : 'var(--red)'; },

  cushionColor(cushion) {
    if (cushion === 0) return 'var(--green)';
    if (cushion > 500) return 'var(--green)';
    if (cushion > 200) return 'var(--yellow)';
    return 'var(--red)';
  },

  formatDate(dateStr) {
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  },

  formatPrice(val) {
    if (val === undefined || val === null || val === 0) return '-';
    return val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  },

  today() { return new Date().toISOString().slice(0, 10); },

  badgeHtml(phase) {
    const cls = phase === 'eval' ? 'badge-eval' : phase === 'funded' ? 'badge-funded' : 'badge-live';
    const label = phase.charAt(0).toUpperCase() + phase.slice(1);
    return '<span class="badge ' + cls + '">' + UI.esc(label) + '</span>';
  },

  firmBadgeHtml(firm) {
    const map = { apex: 'APX', topstep: 'TS', mff: 'MFF', alpha: 'ALF', lucid: 'LCT' };
    const colors = { apex: 'badge-eval', topstep: 'badge-funded', mff: 'badge-live', alpha: 'badge-eval', lucid: 'badge-funded' };
    const label = map[firm] || UI.esc(String(firm).toUpperCase().slice(0, 3));
    const cls = colors[firm] || 'badge-active';
    return '<span class="badge ' + cls + '" style="font-size:9px;padding:1px 6px">' + label + '</span>';
  },

  statusBadgeHtml(status) {
    const cls = status === 'active' ? 'badge-active' : 'badge-archived';
    const label = status.charAt(0).toUpperCase() + status.slice(1);
    return '<span class="badge ' + cls + '">' + UI.esc(label) + '</span>';
  },
};
