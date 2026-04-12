"use strict";

const UI = {
  esc(str) {
    const d = document.createElement('div');
    d.textContent = str;
    return d.innerHTML;
  },

  $(sel) { return document.querySelector(sel); },
  $$(sel) { return document.querySelectorAll(sel); },

  num(val, decimals = 2) {
    if (val == null || isNaN(val)) return '--';
    const n = parseFloat(val);
    if (Math.abs(n) >= 1e12) return (n / 1e12).toFixed(1) + 'T';
    if (Math.abs(n) >= 1e9) return (n / 1e9).toFixed(1) + 'B';
    if (Math.abs(n) >= 1e6) return (n / 1e6).toFixed(1) + 'M';
    if (Math.abs(n) >= 1e3 && decimals <= 1) return (n / 1e3).toFixed(1) + 'K';
    return n.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  },

  pct(val, decimals = 1) {
    if (val == null || isNaN(val)) return '--';
    return parseFloat(val).toFixed(decimals) + '%';
  },

  formatValue(val, unit) {
    if (val == null || val === '.' || isNaN(val)) return '--';
    const n = parseFloat(val);
    switch (unit) {
      case '%': return UI.pct(n);
      case '$B': return '$' + UI.num(n * 1e9, 0);
      case '$M': return '$' + UI.num(n * 1e6, 0);
      case 'K': return UI.num(n, 0) + 'K';
      case 'index': return UI.num(n, 1);
      case 'ratio': return n.toFixed(2);
      default: return UI.num(n);
    }
  },

  changeClass(current, previous) {
    if (current == null || previous == null) return 'neutral';
    return current > previous ? 'positive' : current < previous ? 'negative' : 'neutral';
  },

  changeArrow(current, previous) {
    if (current == null || previous == null) return '';
    return current > previous ? '\u25B2' : current < previous ? '\u25BC' : '\u25C6';
  },

  formatDate(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  },

  dateSubtract(years) {
    const d = new Date();
    d.setFullYear(d.getFullYear() - years);
    return d.toISOString().slice(0, 10);
  },

  today() {
    return new Date().toISOString().slice(0, 10);
  },
};
