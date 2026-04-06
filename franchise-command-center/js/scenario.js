"use strict";

const Scenario = {
  currentId: null,
  overrides: null,

  render(id) {
    const scenario = Store.getScenario(id);
    if (!scenario) {
      App.getContent().innerHTML = UI.emptyState('&#128269;', 'Scenario not found', 'It may have been deleted.',
        UI.button('Go to Dashboard', "window.location.hash='dashboard'", 'primary'));
      return;
    }
    Scenario.currentId = id;
    Scenario.overrides = null;
    Scenario.renderView(scenario);
  },

  getActiveInputs(scenario) {
    if (!Scenario.overrides) return scenario.inputs;
    return { ...scenario.inputs, ...Scenario.overrides };
  },

  renderView(scenario) {
    const el = App.getContent();
    const inputs = Scenario.getActiveInputs(scenario);
    const computed = Engine.calcScenario(inputs);
    const pnl = Engine.buildPnL(computed.lineItems);

    let html = UI.pageHeader(
      UI.esc(scenario.name),
      UI.esc(scenario.templateName) + ' &middot; ' + UI.esc(scenario.entryPoint).toUpperCase() + ' &middot; ' + UI.esc(scenario.created),
      UI.button('&larr; Dashboard', "window.location.hash='dashboard'", 'secondary') +
      UI.button('Print', 'window.print()', 'secondary') +
      UI.button('Delete', "Scenario.confirmDelete('" + UI.esc(scenario.id) + "')", 'danger')
    );

    // Metric Cards
    html += '<div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4 mb-6 sm:mb-8">';
    html += UI.metricCard('Total Investment', UI.currency(inputs.totalInvestment));
    html += UI.metricCard('Monthly Cash Flow', UI.currency(computed.monthlyCashFlow), computed.monthlyCashFlow >= 0 ? 'Positive' : 'Negative');
    html += UI.metricCard('Break-Even', UI.months(computed.breakEvenMonth), computed.breakEvenMonth > 0 ? ('~' + (computed.breakEvenMonth / 12).toFixed(1) + ' years') : '');
    html += UI.metricCard('First Year ROI', UI.pct(computed.firstYearROI));
    html += UI.metricCard('Annual Earnings', UI.currency(computed.annualOwnerEarnings));
    html += '</div>';

    // Sensitivity Sliders
    html += '<div class="form-panel p-4 sm:p-6 mb-6 sm:mb-8 no-print">';
    html += '<h3 class="font-semibold text-white mb-4">Sensitivity Analysis</h3>';
    html += '<p class="text-xs text-slate-500 mb-4">Drag sliders to see how changes affect your numbers. Resets when you leave this page.</p>';
    html += '<div class="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">';

    const revBase = scenario.inputs.monthlyRevenue;
    const revMin = Math.round(revBase * 0.75);
    const revMax = Math.round(revBase * 1.25);
    const revCurrent = inputs.monthlyRevenue;
    html += '<div><label class="text-sm font-medium text-slate-400">Revenue: <span id="slider-rev-val" class="text-emerald-400">' + UI.currency(revCurrent) + '</span></label>';
    html += '<input type="range" class="slider-track mt-2" id="slider-rev" min="' + revMin + '" max="' + revMax + '" step="1000" value="' + revCurrent + '" oninput="Scenario.onSlider()"></div>';

    const foodBase = scenario.inputs.foodCostPct;
    const foodCurrent = inputs.foodCostPct;
    html += '<div><label class="text-sm font-medium text-slate-400">Food Cost: <span id="slider-food-val" class="text-emerald-400">' + UI.pct(foodCurrent) + '</span></label>';
    html += '<input type="range" class="slider-track mt-2" id="slider-food" min="' + Math.max(0, foodBase - 5) + '" max="' + (foodBase + 5) + '" step="0.5" value="' + foodCurrent + '" oninput="Scenario.onSlider()"></div>';

    const laborBase = scenario.inputs.laborPct;
    const laborCurrent = inputs.laborPct;
    html += '<div><label class="text-sm font-medium text-slate-400">Labor: <span id="slider-labor-val" class="text-emerald-400">' + UI.pct(laborCurrent) + '</span></label>';
    html += '<input type="range" class="slider-track mt-2" id="slider-labor" min="' + Math.max(0, laborBase - 5) + '" max="' + (laborBase + 5) + '" step="0.5" value="' + laborCurrent + '" oninput="Scenario.onSlider()"></div>';

    html += '</div>';
    html += '<div class="mt-3 text-right">' + UI.button('Reset Sliders', 'Scenario.resetSliders()', 'secondary') + '</div>';
    html += '</div>';

    // P&L Table
    html += '<div class="mb-8">';
    html += '<div class="section-heading"><h3 class="font-semibold text-slate-300">Monthly P&L</h3></div>';
    const rows = pnl.map(row => ({
      _isTotal: row.isTotal,
      cells: [
        '<span class="' + (row.isTotal ? 'text-white' : 'text-slate-300') + '">' + row.label + '</span>',
        '<span class="' + (row.amount < 0 ? 'text-red-400' : row.isTotal && row.amount > 0 ? 'text-emerald-400 font-semibold' : 'text-slate-200') + '">' + UI.currency(row.amount) + '</span>',
        '<span class="text-slate-500">' + UI.pct(row.pctOfRevenue) + '</span>',
      ]
    }));
    html += UI.table(['Line Item', 'Monthly', '% of Revenue'], rows);
    html += '</div>';

    el.innerHTML = html;
  },

  onSlider() {
    const scenario = Store.getScenario(Scenario.currentId);
    if (!scenario) return;

    const rev = parseFloat(document.getElementById('slider-rev').value);
    const food = parseFloat(document.getElementById('slider-food').value);
    const labor = parseFloat(document.getElementById('slider-labor').value);

    document.getElementById('slider-rev-val').textContent = UI.currency(rev);
    document.getElementById('slider-food-val').textContent = UI.pct(food);
    document.getElementById('slider-labor-val').textContent = UI.pct(labor);

    Scenario.overrides = { monthlyRevenue: rev, foodCostPct: food, laborPct: labor };
    Scenario.renderView(scenario);
  },

  resetSliders() {
    Scenario.overrides = null;
    const scenario = Store.getScenario(Scenario.currentId);
    if (scenario) Scenario.renderView(scenario);
  },

  confirmDelete(id) {
    if (confirm('Delete this scenario? This cannot be undone.')) {
      Store.deleteScenario(id);
      window.location.hash = 'dashboard';
    }
  }
};
