"use strict";

const Dashboard = {
  render() {
    const el = App.getContent();
    const scenarios = Store.getScenarios();
    const templates = Store.getTemplates();
    const portfolios = Store.getPortfolios();

    let html = UI.pageHeader('Dashboard', 'Your franchise analysis overview',
      UI.button('+ New Analysis', "window.location.hash='new-analysis'", 'primary'));

    // Quick Stats
    if (scenarios.length > 0) {
      const totalInvested = scenarios.reduce((sum, s) => sum + (s.inputs.totalInvestment || 0), 0);
      const avgCashFlow = scenarios.reduce((sum, s) => {
        const c = Engine.calcScenario(s.inputs);
        return sum + c.monthlyCashFlow;
      }, 0) / scenarios.length;
      const bestScenario = scenarios.reduce((best, s) => {
        const c = Engine.calcScenario(s.inputs);
        return c.monthlyCashFlow > (best.cf || -Infinity) ? { s, cf: c.monthlyCashFlow } : best;
      }, {});

      html += '<div class="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6 sm:mb-8">';
      html += UI.metricCard('Scenarios', scenarios.length);
      html += UI.metricCard('Avg Cash Flow', UI.currency(avgCashFlow), '/month');
      html += UI.metricCard('Best Performer', bestScenario.s ? UI.esc(bestScenario.s.name) : '—', bestScenario.cf ? UI.currency(bestScenario.cf) + '/mo' : '');
      html += UI.metricCard('Portfolios', portfolios.length);
      html += '</div>';
    }

    // Scenarios List
    if (scenarios.length === 0) {
      html += UI.emptyState('&#128200;', 'No scenarios yet', 'Run your first franchise analysis to see results here.',
        UI.button('+ New Analysis', "window.location.hash='new-analysis'", 'primary'));
    } else {
      html += '<div class="section-heading"><h3 class="font-semibold text-slate-300">All Scenarios</h3></div>';
      html += '<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">';
      scenarios.forEach(s => {
        const computed = Engine.calcScenario(s.inputs);
        const cashFlowColor = computed.monthlyCashFlow >= 0 ? 'text-emerald-400' : 'text-red-400';
        html += '<div class="card p-5 cursor-pointer" onclick="window.location.hash=\'scenario/' + UI.esc(s.id) + '\'">';
        html += '<div class="flex items-start justify-between"><h4 class="font-semibold text-white">' + UI.esc(s.name) + '</h4>';
        html += '<span class="badge badge-' + UI.esc(s.entryPoint) + '">' + UI.esc(s.entryPoint).toUpperCase() + '</span></div>';
        html += '<p class="text-xs text-slate-500 mt-1">' + UI.esc(s.templateName) + ' &middot; ' + UI.esc(s.created) + '</p>';
        html += '<div class="mt-3 grid grid-cols-2 gap-2 text-sm">';
        html += '<div><span class="text-slate-500">Investment:</span><br><strong class="text-slate-200">' + UI.currency(s.inputs.totalInvestment) + '</strong></div>';
        html += '<div><span class="text-slate-500">Cash Flow:</span><br><strong class="' + cashFlowColor + '">' + UI.currency(computed.monthlyCashFlow) + '/mo</strong></div>';
        html += '<div><span class="text-slate-500">Break-Even:</span><br><strong class="text-slate-200">' + UI.months(computed.breakEvenMonth) + '</strong></div>';
        html += '<div><span class="text-slate-500">ROI:</span><br><strong class="text-slate-200">' + UI.pct(computed.firstYearROI) + '</strong></div>';
        html += '</div></div>';
      });
      html += '</div>';
    }

    el.innerHTML = html;
  }
};
