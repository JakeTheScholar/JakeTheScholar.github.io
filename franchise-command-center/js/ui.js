"use strict";

const UI = {
  esc(str) {
    if (str === null || str === undefined) return '';
    return String(str).replace(/[&<>"']/g, m =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[m]);
  },

  MARCOS_DEFAULT_TEMPLATE: {
    name: "Marco's Pizza",
    fees: { royaltyPct: 5.5, adFundPct: 2.0, otherFees: [] },
    costDefaults: {
      foodCostPct: { low: 28, mid: 30, high: 32 },
      laborPct: { low: 25, mid: 27, high: 30 },
      utilitiesMonthly: 2500,
      insuranceMonthly: 800,
      otherMonthly: 500
    },
    investmentRange: { low: 250000, mid: 350000, high: 500000 },
    revenueBenchmarks: { low: 50000, mid: 70000, high: 95000 },
    termYears: 10
  },

  currency(val) {
    if (val === undefined || val === null) return '$0';
    const abs = Math.abs(val);
    const formatted = abs >= 1000 ? '$' + abs.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) : '$' + abs.toFixed(2);
    return val < 0 ? '-' + formatted : formatted;
  },

  currencyCompact(val) {
    if (Math.abs(val) >= 1000000) return '$' + (val / 1000000).toFixed(1) + 'M';
    if (Math.abs(val) >= 1000) return '$' + (val / 1000).toFixed(0) + 'k';
    return '$' + val.toFixed(0);
  },

  pct(val) {
    return val.toFixed(1) + '%';
  },

  months(val) {
    if (val < 0) return 'Never';
    if (val === 1) return '1 month';
    return val + ' months';
  },

  metricCard(label, value, sub) {
    return '<div class="metric-card">' +
      '<p class="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">' + label + '</p>' +
      '<p class="text-lg sm:text-2xl font-bold text-white mt-1 truncate">' + value + '</p>' +
      (sub ? '<p class="text-xs text-slate-500 mt-1">' + sub + '</p>' : '') +
      '</div>';
  },

  emptyState(icon, title, subtitle, actionHtml) {
    return '<div class="text-center py-16">' +
      '<div class="text-5xl mb-4 opacity-30">' + icon + '</div>' +
      '<h3 class="text-lg font-semibold text-slate-300">' + title + '</h3>' +
      '<p class="text-slate-500 mt-1">' + subtitle + '</p>' +
      (actionHtml ? '<div class="mt-4">' + actionHtml + '</div>' : '') +
      '</div>';
  },

  button(text, onclick, style) {
    const styles = {
      primary: 'bg-gradient-to-r from-emerald-600 to-emerald-500 text-white hover:from-emerald-500 hover:to-emerald-400 shadow-lg shadow-emerald-500/15',
      secondary: 'bg-slate-800/60 text-slate-300 border border-slate-700/50 hover:bg-slate-700/60 hover:text-white',
      danger: 'bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/20',
    };
    return '<button onclick="' + onclick + '" class="px-4 py-2 rounded-xl text-sm font-medium transition-all ' + (styles[style || 'primary'] || styles.primary) + '">' + text + '</button>';
  },

  pageHeader(title, subtitle, actionHtml) {
    return '<div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6 sm:mb-8 animate-in">' +
      '<div class="min-w-0">' +
      '<h2 class="text-xl sm:text-2xl font-bold text-white truncate">' + title + '</h2>' +
      (subtitle ? '<p class="text-slate-500 mt-1 text-sm">' + subtitle + '</p>' : '') +
      '</div>' +
      (actionHtml ? '<div class="flex flex-wrap gap-2 flex-shrink-0">' + actionHtml + '</div>' : '') +
      '</div>';
  },

  inputField(label, name, value, type, opts) {
    opts = opts || {};
    const prefix = opts.prefix || '';
    const suffix = opts.suffix || '';
    const step = opts.step || 'any';
    return '<div class="' + (opts.className || '') + '">' +
      '<label class="block text-sm font-medium text-slate-400 mb-1.5">' + UI.esc(label) + '</label>' +
      '<div class="relative">' +
      (prefix ? '<span class="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm">' + UI.esc(prefix) + '</span>' : '') +
      '<input type="' + (type || 'number') + '" name="' + UI.esc(name) + '" value="' + UI.esc(value !== undefined ? value : '') + '" step="' + step + '" class="dark-input w-full px-3 py-2.5 text-sm' + (prefix ? ' pl-7' : '') + (suffix ? ' pr-8' : '') + '">' +
      (suffix ? '<span class="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm">' + UI.esc(suffix) + '</span>' : '') +
      '</div></div>';
  },

  selectField(label, name, options, selectedValue) {
    const optionsHtml = options.map(o => {
      const val = typeof o === 'object' ? o.value : o;
      const text = typeof o === 'object' ? o.label : o;
      return '<option value="' + UI.esc(val) + '"' + (val === selectedValue ? ' selected' : '') + '>' + UI.esc(text) + '</option>';
    }).join('');
    return '<div>' +
      '<label class="block text-sm font-medium text-slate-400 mb-1.5">' + label + '</label>' +
      '<select name="' + name + '" class="dark-input w-full px-3 py-2.5 text-sm">' + optionsHtml + '</select>' +
      '</div>';
  },

  table(headers, rows, opts) {
    opts = opts || {};
    let html = '<div class="overflow-x-auto rounded-xl border border-slate-700/30 bg-slate-900/30">' +
      '<table class="min-w-full">' +
      '<thead><tr class="border-b border-slate-700/30">';
    headers.forEach(h => {
      html += '<th class="px-4 py-3.5 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider">' + h + '</th>';
    });
    html += '</tr></thead><tbody>';
    rows.forEach((row, i) => {
      const rowClass = row._isTotal
        ? 'font-semibold bg-emerald-500/5 border-t border-slate-700/30'
        : (i % 2 === 1 ? 'bg-slate-800/15' : '');
      html += '<tr class="' + rowClass + ' border-b border-slate-700/10 hover:bg-slate-700/10 transition-colors">';
      row.cells.forEach(cell => {
        html += '<td class="px-4 py-3 text-sm text-slate-300">' + cell + '</td>';
      });
      html += '</tr>';
    });
    html += '</tbody></table></div>';
    return html;
  },

  rankColor(rank, total) {
    if (total <= 1) return '';
    if (rank === 0) return 'text-emerald-400 font-semibold';
    if (rank === total - 1) return 'text-red-400';
    return 'text-slate-300';
  }
};
