"use strict";

const Portfolio = {
  currentView: 'list',
  currentId: null,

  render() {
    Portfolio.currentView = 'list';
    Portfolio.renderList();
  },

  renderList() {
    const el = App.getContent();
    const portfolios = Store.getPortfolios();
    const scenarios = Store.getScenarios();

    let html = UI.pageHeader('Portfolio Planner', 'Plan multi-location expansion',
      UI.button('+ New Portfolio', 'Portfolio.showCreate()', 'primary') +
      (scenarios.length >= 2 ? ' ' + UI.button('Compare Scenarios', 'Portfolio.showCompare()', 'secondary') : '')
    );

    if (portfolios.length === 0) {
      html += UI.emptyState('&#128202;', 'No portfolios yet', 'Create a portfolio to plan your multi-location timeline.' + (scenarios.length < 2 ? '<br>You need at least 1 scenario first.' : ''),
        scenarios.length >= 1 ? UI.button('+ New Portfolio', 'Portfolio.showCreate()', 'primary') : UI.button('Create a Scenario First', "window.location.hash='new-analysis'", 'primary'));
    } else {
      html += '<div class="grid grid-cols-1 md:grid-cols-2 gap-4">';
      portfolios.forEach(p => {
        const locCount = p.locations.length;
        html += '<div class="card p-5">';
        html += '<div class="flex items-start justify-between"><h4 class="font-semibold text-white">' + UI.esc(p.name) + '</h4>';
        html += '<span class="text-xs text-slate-500">' + UI.esc(p.created) + '</span></div>';
        html += '<p class="text-sm text-slate-400 mt-1">' + locCount + ' location' + (locCount !== 1 ? 's' : '') + '</p>';
        html += '<div class="mt-4 flex gap-2">';
        html += UI.button('Timeline', "Portfolio.showTimeline('" + UI.esc(p.id) + "')", 'primary');
        html += UI.button('Edit', "Portfolio.showEdit('" + UI.esc(p.id) + "')", 'secondary');
        html += UI.button('Delete', "Portfolio.confirmDelete('" + UI.esc(p.id) + "')", 'danger');
        html += '</div></div>';
      });
      html += '</div>';
    }

    el.innerHTML = html;
  },

  showCreate() {
    const scenarios = Store.getScenarios();
    if (scenarios.length === 0) {
      alert('Create at least one scenario first.');
      window.location.hash = 'new-analysis';
      return;
    }
    Portfolio.currentId = null;
    Portfolio.renderForm(null);
  },

  showEdit(id) {
    Portfolio.currentId = id;
    Portfolio.renderForm(Store.getPortfolio(id));
  },

  renderForm(existing) {
    const el = App.getContent();
    const scenarios = Store.getScenarios();
    const p = existing || { name: '', locations: [{ scenarioId: scenarios[0].id, openMonth: 0 }] };

    let html = UI.pageHeader(existing ? 'Edit Portfolio' : 'New Portfolio', 'Define locations and their opening timeline',
      UI.button('&larr; Back', 'Portfolio.renderList()', 'secondary'));

    html += '<div id="portfolio-form" class="form-panel p-6 space-y-4">';
    html += UI.inputField('Portfolio Name', 'portfolioName', p.name, 'text');

    html += '<h3 class="font-semibold text-slate-200 mt-4">Locations</h3>';
    html += '<div id="location-rows">';
    p.locations.forEach((loc, i) => {
      html += Portfolio.locationRow(i, loc, scenarios);
    });
    html += '</div>';

    html += '<div class="mt-2">';
    html += '<button onclick="Portfolio.addRow()" class="text-sm text-emerald-400 hover:text-emerald-300 font-medium transition-colors">+ Add Location</button>';
    html += '</div>';

    html += '<div class="mt-6 flex gap-3">';
    html += UI.button(existing ? 'Save Changes' : 'Create Portfolio', 'Portfolio.saveForm()', 'primary');
    html += UI.button('Cancel', 'Portfolio.renderList()', 'secondary');
    html += '</div></div>';

    el.innerHTML = html;
  },

  locationRow(index, loc, scenarios) {
    const opts = scenarios.map(s => '<option value="' + UI.esc(s.id) + '"' + (s.id === loc.scenarioId ? ' selected' : '') + '>' + UI.esc(s.name) + '</option>').join('');
    return '<div class="flex flex-col sm:flex-row gap-3 sm:items-end mb-3 location-row" data-index="' + index + '">' +
      '<div class="flex-1"><label class="text-sm text-slate-400">Scenario</label><select name="loc-scenario-' + index + '" class="dark-input w-full px-3 py-2.5 text-sm">' + opts + '</select></div>' +
      '<div class="sm:w-32"><label class="text-sm text-slate-400">Opens Month</label><input type="number" name="loc-month-' + index + '" value="' + loc.openMonth + '" min="0" class="dark-input w-full px-3 py-2.5 text-sm"></div>' +
      '<button onclick="this.closest(\'.location-row\').remove()" class="text-red-400 hover:text-red-300 pb-2 text-lg transition-colors self-end">&times;</button>' +
      '</div>';
  },

  addRow() {
    const container = document.getElementById('location-rows');
    const scenarios = Store.getScenarios();
    const index = container.querySelectorAll('.location-row').length;
    const div = document.createElement('div');
    div.innerHTML = Portfolio.locationRow(index, { scenarioId: scenarios[0].id, openMonth: index * 12 }, scenarios);
    container.appendChild(div.firstElementChild);
  },

  saveForm() {
    const name = document.querySelector('[name="portfolioName"]').value || 'Untitled Portfolio';
    const rows = document.querySelectorAll('.location-row');
    const locations = [];
    rows.forEach((row, i) => {
      const scenarioSelect = row.querySelector('select');
      const monthInput = row.querySelector('input[type="number"]');
      if (scenarioSelect && monthInput) {
        locations.push({
          scenarioId: scenarioSelect.value,
          openMonth: parseInt(monthInput.value) || 0,
        });
      }
    });

    const data = { name, locations };
    if (Portfolio.currentId) data.id = Portfolio.currentId;
    Store.savePortfolio(data);
    Portfolio.renderList();
  },

  showTimeline(id) {
    const portfolio = Store.getPortfolio(id);
    if (!portfolio) return;
    Portfolio.currentId = id;

    const el = App.getContent();
    const locations = portfolio.locations.map(loc => ({
      ...loc,
      scenario: Store.getScenario(loc.scenarioId),
    })).filter(l => l.scenario);

    if (locations.length === 0) {
      el.innerHTML = UI.pageHeader(portfolio.name, 'Timeline View',
        UI.button('&larr; Back', 'Portfolio.renderList()', 'secondary')) +
        UI.emptyState('&#128203;', 'No valid scenarios', 'The scenarios in this portfolio may have been deleted.');
      return;
    }

    const timeline = Engine.calcPortfolioTimeline(locations, 60);

    let html = UI.pageHeader(UI.esc(portfolio.name) + ' — Timeline', locations.length + ' locations over 5 years',
      UI.button('&larr; Back', 'Portfolio.renderList()', 'secondary'));

    html += '<div class="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6 sm:mb-8">';
    html += UI.metricCard('Total Capital', UI.currency(timeline.totalInvestment));
    html += UI.metricCard('Combined Cash Flow', UI.currency(timeline.combinedMonthlyCashFlow), '/month (at month 60)');
    html += UI.metricCard('Portfolio ROI', UI.pct(timeline.portfolioROI), 'Over 5 years');
    html += UI.metricCard('Locations', locations.length);
    html += '</div>';

    if (timeline.milestones.length > 0) {
      html += '<div class="form-panel p-5 mb-8">';
      html += '<h3 class="font-semibold text-white mb-3">Key Milestones</h3>';
      html += '<div class="space-y-2">';
      timeline.milestones.forEach(m => {
        html += '<div class="flex items-center gap-3"><span class="text-xs font-mono bg-emerald-500/12 text-emerald-400 px-2.5 py-1 rounded-lg border border-emerald-500/20">Month ' + m.month + '</span><span class="text-sm text-slate-300">' + UI.esc(m.text) + '</span></div>';
      });
      html += '</div></div>';
    }

    // Cash Flow Chart
    html += '<div class="form-panel p-5 mb-8">';
    html += '<h3 class="font-semibold text-white mb-3">Monthly Cash Flow</h3>';
    html += '<div class="overflow-x-auto">';
    html += '<div class="flex items-end gap-px" style="height:200px; min-width:' + (timeline.monthly.length * 12) + 'px">';

    const maxCF = Math.max(...timeline.monthly.map(m => m.cashFlow), 1);
    timeline.monthly.forEach((m, i) => {
      const height = Math.max(1, Math.round((m.cashFlow / maxCF) * 180));
      const isOpening = timeline.milestones.some(ms => ms.month === i && ms.text.includes('opens'));
      const barStyle = isOpening
        ? 'background:linear-gradient(to top,#d97706,#fbbf24);'
        : (m.cashFlow >= 0
          ? 'background:linear-gradient(to top,#059669,#34d399);'
          : 'background:linear-gradient(to top,#dc2626,#f87171);');
      html += '<div class="flex-1 rounded-t relative group" style="height:' + height + 'px; min-width:8px; ' + barStyle + '">';
      html += '<div class="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 hidden group-hover:block bg-slate-900/95 border border-slate-700/40 text-slate-200 text-xs px-2.5 py-1.5 rounded-lg whitespace-nowrap z-10 shadow-xl backdrop-blur-sm">Mo ' + i + ': ' + UI.currency(m.cashFlow) + '/mo<br>Cumulative: ' + UI.currency(m.cumulative) + '</div>';
      html += '</div>';
    });

    html += '</div>';
    html += '<div class="flex justify-between text-xs text-slate-600 mt-2"><span>Month 0</span><span>Month 60</span></div>';
    html += '</div></div>';

    // Cumulative Chart
    html += '<div class="form-panel p-5">';
    html += '<h3 class="font-semibold text-white mb-3">Cumulative Cash Flow</h3>';
    html += '<div class="overflow-x-auto">';
    html += '<div class="flex items-end gap-px" style="height:200px; min-width:' + (timeline.monthly.length * 12) + 'px">';

    const maxCum = Math.max(...timeline.monthly.map(m => m.cumulative), 1);
    timeline.monthly.forEach((m, i) => {
      const height = Math.max(1, Math.round((Math.max(0, m.cumulative) / maxCum) * 180));
      const barStyle = m.cumulative >= 0
        ? 'background:linear-gradient(to top,#2563eb,#60a5fa);'
        : 'background:linear-gradient(to top,#dc2626,#f87171);';
      html += '<div class="flex-1 rounded-t relative group" style="height:' + height + 'px; min-width:8px; ' + barStyle + '">';
      html += '<div class="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 hidden group-hover:block bg-slate-900/95 border border-slate-700/40 text-slate-200 text-xs px-2.5 py-1.5 rounded-lg whitespace-nowrap z-10 shadow-xl backdrop-blur-sm">Mo ' + i + ': ' + UI.currency(m.cumulative) + ' total</div>';
      html += '</div>';
    });

    html += '</div>';
    html += '<div class="flex justify-between text-xs text-slate-600 mt-2"><span>Month 0</span><span>Month 60</span></div>';
    html += '</div></div>';

    el.innerHTML = html;
  },

  showCompare() {
    const el = App.getContent();
    const scenarios = Store.getScenarios();

    if (scenarios.length < 2) {
      el.innerHTML = UI.pageHeader('Compare Scenarios', '',
        UI.button('&larr; Back', 'Portfolio.renderList()', 'secondary')) +
        UI.emptyState('&#128200;', 'Need at least 2 scenarios', 'Create more scenarios to compare them side-by-side.');
      return;
    }

    let html = UI.pageHeader('Compare Scenarios', 'Side-by-side analysis of up to 4 scenarios',
      UI.button('&larr; Back', 'Portfolio.renderList()', 'secondary'));

    html += '<div class="form-panel p-4 mb-6">';
    html += '<p class="text-sm text-slate-400 mb-3">Select 2-4 scenarios to compare:</p>';
    html += '<div class="flex flex-wrap gap-3">';
    scenarios.forEach((s, i) => {
      const checked = i < 4 ? 'checked' : '';
      html += '<label class="flex items-center gap-2 text-sm text-slate-300 cursor-pointer hover:text-white transition-colors"><input type="checkbox" class="compare-check accent-emerald-500" value="' + UI.esc(s.id) + '" ' + checked + ' onchange="Portfolio.updateCompare()"> ' + UI.esc(s.name) + '</label>';
    });
    html += '</div></div>';

    html += '<div id="compare-table"></div>';
    el.innerHTML = html;
    Portfolio.updateCompare();
  },

  updateCompare() {
    const checked = Array.from(document.querySelectorAll('.compare-check:checked')).map(c => c.value).slice(0, 4);
    const container = document.getElementById('compare-table');
    if (checked.length < 2) {
      container.innerHTML = '<p class="text-slate-500 text-sm">Select at least 2 scenarios.</p>';
      return;
    }

    const scenarios = checked.map(id => Store.getScenario(id)).filter(Boolean);
    const computed = scenarios.map(s => Engine.calcScenario(s.inputs));

    const metrics = [
      { label: 'Investment', key: 'totalInvestment', fmt: UI.currency, fromInputs: true, higherBetter: false },
      { label: 'Monthly Revenue', key: 'monthlyRevenue', fmt: UI.currency, fromInputs: true, higherBetter: true },
      { label: 'Monthly Cash Flow', key: 'monthlyCashFlow', fmt: UI.currency, fromInputs: false, higherBetter: true },
      { label: 'Break-Even', key: 'breakEvenMonth', fmt: UI.months, fromInputs: false, higherBetter: false },
      { label: 'First Year ROI', key: 'firstYearROI', fmt: UI.pct, fromInputs: false, higherBetter: true },
      { label: 'Annual Earnings', key: 'annualOwnerEarnings', fmt: UI.currency, fromInputs: false, higherBetter: true },
      { label: 'Food Cost %', key: 'foodCostPct', fmt: UI.pct, fromInputs: true, higherBetter: false },
      { label: 'Labor %', key: 'laborPct', fmt: UI.pct, fromInputs: true, higherBetter: false },
    ];

    const headers = ['Metric', ...scenarios.map(s => '<span class="text-white">' + UI.esc(s.name) + '</span>')];
    const rows = metrics.map(metric => {
      const values = scenarios.map((s, i) => {
        return metric.fromInputs ? s.inputs[metric.key] : computed[i][metric.key];
      });
      const sorted = [...values].sort((a, b) => metric.higherBetter ? b - a : a - b);
      const cells = ['<span class="text-slate-400">' + metric.label + '</span>', ...values.map((v, i) => {
        const rank = sorted.indexOf(v);
        return '<span class="' + UI.rankColor(rank, values.length) + '">' + metric.fmt(v) + '</span>';
      })];
      return { cells };
    });

    container.innerHTML = UI.table(headers, rows);
  },

  confirmDelete(id) {
    if (confirm('Delete this portfolio? This cannot be undone.')) {
      Store.deletePortfolio(id);
      Portfolio.renderList();
    }
  }
};
