"use strict";

const Wizards = {
  state: {},

  BLANK_TEMPLATE: {
    name: 'Custom',
    fees: { royaltyPct: 0, adFundPct: 0, otherFees: [] },
    costDefaults: {
      foodCostPct: { low: 0, mid: 0, high: 0 },
      laborPct: { low: 0, mid: 0, high: 0 },
      utilitiesMonthly: 0,
      insuranceMonthly: 0,
      otherMonthly: 0
    },
    investmentRange: { low: 0, mid: 0, high: 0 },
    revenueBenchmarks: { low: 0, mid: 0, high: 0 },
    termYears: 10
  },

  getTemplate() {
    if (Wizards.state.templateId === '_custom') return Wizards.BLANK_TEMPLATE;
    return Store.getTemplate(Wizards.state.templateId) || Wizards.BLANK_TEMPLATE;
  },

  render() {
    const el = App.getContent();
    let html = UI.pageHeader('New Analysis', 'Choose how you want to start your evaluation');

    html += '<div class="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">';

    html += '<div class="entry-card" onclick="Wizards.start(\'fdd\')">';
    html += '<div class="text-3xl mb-3 relative z-10">&#128196;</div>';
    html += '<h3 class="font-semibold text-white text-lg relative z-10">Start from FDD</h3>';
    html += '<p class="text-sm text-slate-400 mt-2 relative z-10">You have the Franchise Disclosure Document. Input Item 7 costs, Item 19 earnings, and fee structure.</p>';
    html += '</div>';

    html += '<div class="entry-card" onclick="Wizards.start(\'location\')">';
    html += '<div class="text-3xl mb-3 relative z-10">&#128205;</div>';
    html += '<h3 class="font-semibold text-white text-lg relative z-10">Start from Location</h3>';
    html += '<p class="text-sm text-slate-400 mt-2 relative z-10">You found a spot. Estimate revenue and rent, and the template fills in the franchise cost structure.</p>';
    html += '</div>';

    html += '<div class="entry-card" onclick="Wizards.start(\'capital\')">';
    html += '<div class="text-3xl mb-3 relative z-10">&#128176;</div>';
    html += '<h3 class="font-semibold text-white text-lg relative z-10">Start from Capital</h3>';
    html += '<p class="text-sm text-slate-400 mt-2 relative z-10">You know what you can invest. See which scenarios are feasible and what revenue you need.</p>';
    html += '</div>';

    html += '</div>';
    el.innerHTML = html;
  },

  start(entryPoint) {
    const templates = Store.getTemplates();
    Wizards.state = { entryPoint, step: 1, templateId: templates.length > 0 ? templates[0].id : '_custom' };
    Wizards.renderStep();
  },

  renderStep() {
    const s = Wizards.state;
    if (s.step === 1) Wizards.renderStep1();
    else if (s.step === 2) Wizards.renderStep2();
    else if (s.step === 3) Wizards.renderStep3();
  },

  renderStep1() {
    const el = App.getContent();
    const templates = Store.getTemplates();
    const opts = [{ value: '_custom', label: 'Custom (Start Fresh)' }, ...templates.map(t => ({ value: t.id, label: t.name }))];
    const label = { fdd: 'FDD Analysis', location: 'Location Analysis', capital: 'Capital Analysis' }[Wizards.state.entryPoint];

    let html = UI.pageHeader(label + ' — Step 1 of 3', 'Select a template or start fresh',
      UI.button('&larr; Back', 'Wizards.render()', 'secondary'));
    html += '<div class="form-panel p-6 max-w-xl">';
    html += UI.selectField('Franchise Template', 'templateId', opts, Wizards.state.templateId);
    html += '<div class="mt-4">' + UI.inputField('Scenario Name', 'scenarioName', Wizards.state.scenarioName || '', 'text') + '</div>';
    html += '<div class="mt-6">' + UI.button('Next &rarr;', 'Wizards.saveStep1()', 'primary') + '</div>';
    html += '</div>';
    el.innerHTML = html;
  },

  saveStep1() {
    const form = App.getContent();
    Wizards.state.templateId = form.querySelector('[name="templateId"]').value;
    Wizards.state.scenarioName = form.querySelector('[name="scenarioName"]').value || 'Untitled Scenario';
    Wizards.state.step = 2;
    Wizards.renderStep();
  },

  renderStep2() {
    const ep = Wizards.state.entryPoint;
    if (ep === 'fdd') Wizards.renderStep2FDD();
    else if (ep === 'location') Wizards.renderStep2Location();
    else if (ep === 'capital') Wizards.renderStep2Capital();
  },

  renderStep2FDD() {
    const el = App.getContent();
    const t = Wizards.getTemplate();
    const s = Wizards.state;

    let html = UI.pageHeader('FDD Analysis — Step 2 of 3', 'Enter numbers from the Franchise Disclosure Document',
      UI.button('&larr; Back', 'Wizards.goBack()', 'secondary'));
    html += '<div class="form-panel p-6 max-w-2xl space-y-4">';

    html += '<h3 class="font-semibold text-slate-200">Item 7 — Initial Investment</h3>';
    html += '<div class="grid grid-cols-1 sm:grid-cols-2 gap-4">';
    html += UI.inputField('Total Investment', 'totalInvestment', s.totalInvestment || t.investmentRange.mid, 'number', { prefix: '$' });
    html += UI.inputField('Down Payment', 'downPayment', s.downPayment || Math.round(t.investmentRange.mid * 0.3), 'number', { prefix: '$' });
    html += '</div>';

    html += '<h3 class="font-semibold text-slate-200 mt-4">Item 19 — Earnings (optional)</h3>';
    html += '<div class="grid grid-cols-1 gap-4">';
    html += UI.inputField('Estimated Monthly Revenue', 'monthlyRevenue', s.monthlyRevenue || t.revenueBenchmarks.mid, 'number', { prefix: '$' });
    html += '</div>';

    html += '<h3 class="font-semibold text-slate-200 mt-4">Fee Structure</h3>';
    html += '<div class="grid grid-cols-1 sm:grid-cols-2 gap-4">';
    html += UI.inputField('Royalty', 'royaltyPct', s.royaltyPct || t.fees.royaltyPct, 'number', { suffix: '%', step: '0.1' });
    html += UI.inputField('Ad Fund', 'adFundPct', s.adFundPct || t.fees.adFundPct, 'number', { suffix: '%', step: '0.1' });
    html += '</div>';

    html += '<div class="mt-6">' + UI.button('Next &rarr;', 'Wizards.saveStep2FDD()', 'primary') + '</div>';
    html += '</div>';
    el.innerHTML = html;
  },

  saveStep2FDD() {
    const form = App.getContent();
    const n = (name) => parseFloat(form.querySelector('[name="' + name + '"]').value) || 0;
    Object.assign(Wizards.state, {
      totalInvestment: n('totalInvestment'), downPayment: n('downPayment'),
      monthlyRevenue: n('monthlyRevenue'), royaltyPct: n('royaltyPct'), adFundPct: n('adFundPct'),
    });
    Wizards.state.step = 3;
    Wizards.renderStep();
  },

  renderStep2Location() {
    const el = App.getContent();
    const t = Wizards.getTemplate();
    const s = Wizards.state;

    let html = UI.pageHeader('Location Analysis — Step 2 of 3', 'Describe the location',
      UI.button('&larr; Back', 'Wizards.goBack()', 'secondary'));
    html += '<div class="form-panel p-6 max-w-2xl space-y-4">';

    html += '<h3 class="font-semibold text-slate-200">Revenue Estimate</h3>';
    if (Wizards.state.templateId !== '_custom' && t.revenueBenchmarks.mid > 0) {
      html += '<div class="flex gap-2 mb-3">';
      ['low', 'mid', 'high'].forEach(level => {
        html += '<button type="button" onclick="Wizards.setRevenue(' + t.revenueBenchmarks[level] + ')" class="px-3 py-1 text-xs rounded-full border border-slate-700/50 text-slate-400 hover:bg-emerald-500/10 hover:border-emerald-500/30 hover:text-emerald-400 transition-colors">' + level.charAt(0).toUpperCase() + level.slice(1) + ': ' + UI.currencyCompact(t.revenueBenchmarks[level]) + '/mo</button>';
      });
      html += '</div>';
    }
    html += UI.inputField('Monthly Revenue', 'monthlyRevenue', s.monthlyRevenue || t.revenueBenchmarks.mid, 'number', { prefix: '$' });

    html += '<h3 class="font-semibold text-slate-200 mt-4">Location Costs</h3>';
    html += '<div class="grid grid-cols-1 sm:grid-cols-2 gap-4">';
    html += UI.inputField('Monthly Rent', 'rentMonthly', s.rentMonthly || 4500, 'number', { prefix: '$' });
    html += UI.inputField('Total Investment', 'totalInvestment', s.totalInvestment || t.investmentRange.mid, 'number', { prefix: '$' });
    html += '</div>';

    html += '<div class="mt-6">' + UI.button('Next &rarr;', 'Wizards.saveStep2Location()', 'primary') + '</div>';
    html += '</div>';
    el.innerHTML = html;
  },

  setRevenue(val) {
    const input = document.querySelector('[name="monthlyRevenue"]');
    if (input) input.value = val;
  },

  saveStep2Location() {
    const form = App.getContent();
    const n = (name) => parseFloat(form.querySelector('[name="' + name + '"]').value) || 0;
    const t = Wizards.getTemplate();
    Object.assign(Wizards.state, {
      monthlyRevenue: n('monthlyRevenue'), rentMonthly: n('rentMonthly'),
      totalInvestment: n('totalInvestment'), downPayment: Math.round(n('totalInvestment') * 0.3),
      royaltyPct: t.fees.royaltyPct, adFundPct: t.fees.adFundPct,
    });
    Wizards.state.step = 3;
    Wizards.renderStep();
  },

  renderStep2Capital() {
    const el = App.getContent();
    const s = Wizards.state;

    let html = UI.pageHeader('Capital Analysis — Step 2 of 3', 'What do you have to work with?',
      UI.button('&larr; Back', 'Wizards.goBack()', 'secondary'));
    html += '<div class="form-panel p-6 max-w-2xl space-y-4">';

    html += '<div class="grid grid-cols-1 sm:grid-cols-2 gap-4">';
    html += UI.inputField('Total Available Capital', 'capital', s.capital || 200000, 'number', { prefix: '$' });
    html += UI.inputField('Max Down Payment', 'maxDown', s.maxDown || 100000, 'number', { prefix: '$' });
    html += '</div>';
    html += UI.inputField('Minimum Monthly Cash Flow', 'minCashFlow', s.minCashFlow || 5000, 'number', { prefix: '$' });

    html += '<div class="mt-6">' + UI.button('Analyze Feasibility &rarr;', 'Wizards.saveStep2Capital()', 'primary') + '</div>';
    html += '</div>';
    el.innerHTML = html;
  },

  saveStep2Capital() {
    const form = App.getContent();
    const n = (name) => parseFloat(form.querySelector('[name="' + name + '"]').value) || 0;
    const t = Wizards.getTemplate();
    const capital = n('capital');
    const maxDown = n('maxDown');
    const minCashFlow = n('minCashFlow');

    Object.assign(Wizards.state, { capital, maxDown, minCashFlow });

    if (Wizards.state.templateId !== '_custom' && t.investmentRange.mid > 0) {
      const feasibility = Engine.calcCapitalFeasibility(t, capital, maxDown, minCashFlow);
      Wizards.state.feasibility = feasibility;
      const best = feasibility.results.find(r => r.feasible) || feasibility.results[1];
      Object.assign(Wizards.state, {
        totalInvestment: best.investment, downPayment: Math.min(maxDown, best.investment),
        monthlyRevenue: best.revenue, royaltyPct: t.fees.royaltyPct, adFundPct: t.fees.adFundPct,
      });
    } else {
      Object.assign(Wizards.state, {
        totalInvestment: capital, downPayment: maxDown,
      });
    }
    Wizards.state.step = 3;
    Wizards.renderStep();
  },

  renderStep3() {
    const el = App.getContent();
    const t = Wizards.getTemplate();
    const s = Wizards.state;
    const label = { fdd: 'FDD', location: 'Location', capital: 'Capital' }[s.entryPoint];

    let html = UI.pageHeader(label + ' Analysis — Step 3 of 3', 'Review and adjust all assumptions',
      UI.button('&larr; Back', 'Wizards.goBack()', 'secondary'));

    if (s.entryPoint === 'capital' && s.feasibility) {
      html += '<div class="form-panel p-5 mb-6">';
      html += '<h3 class="font-semibold text-slate-200 mb-3">Feasibility Results</h3>';
      html += '<div class="grid grid-cols-1 sm:grid-cols-3 gap-3">';
      s.feasibility.results.forEach(r => {
        const color = r.feasible ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-red-500/20 bg-red-500/5';
        html += '<div class="p-3 rounded-xl border ' + color + '">';
        html += '<p class="text-xs font-medium uppercase text-slate-500">' + r.level + '</p>';
        html += '<p class="font-semibold text-white">' + UI.currency(r.investment) + '</p>';
        html += '<p class="text-sm text-slate-400">Cash flow: ' + UI.currency(r.monthlyCashFlow) + '/mo</p>';
        html += '<p class="text-xs mt-1 ' + (r.feasible ? 'text-emerald-400' : 'text-red-400') + '">' + (r.feasible ? 'Feasible' : 'Out of range') + '</p>';
        html += '</div>';
      });
      html += '</div>';
      if (s.feasibility.requiredRevenueForBreakEven > 0) {
        html += '<p class="text-sm text-slate-500 mt-2">Minimum revenue to break even at mid investment: <strong class="text-slate-300">' + UI.currency(s.feasibility.requiredRevenueForBreakEven) + '/mo</strong></p>';
      }
      html += '</div>';
    }

    html += '<form id="wizard-final" class="form-panel p-4 sm:p-6 space-y-4">';

    const d = {
      investment: s.totalInvestment || t.investmentRange.mid || '',
      down: s.downPayment || (t.investmentRange.mid ? Math.round(t.investmentRange.mid * 0.3) : ''),
      revenue: s.monthlyRevenue || t.revenueBenchmarks.mid || '',
      rent: s.rentMonthly || 4500,
      food: s.foodCostPct || t.costDefaults.foodCostPct.mid || '',
      labor: s.laborPct || t.costDefaults.laborPct.mid || '',
      royalty: s.royaltyPct || t.fees.royaltyPct || '',
      adFund: s.adFundPct || t.fees.adFundPct || '',
      utilities: s.utilitiesMonthly || t.costDefaults.utilitiesMonthly || '',
      insurance: s.insuranceMonthly || t.costDefaults.insuranceMonthly || '',
      other: s.otherMonthly || t.costDefaults.otherMonthly || '',
    };

    html += '<div class="grid grid-cols-1 sm:grid-cols-2 gap-4">';
    html += UI.inputField('Total Investment', 'totalInvestment', d.investment, 'number', { prefix: '$' });
    html += UI.inputField('Down Payment', 'downPayment', d.down, 'number', { prefix: '$' });
    html += '</div>';

    html += '<div class="grid grid-cols-1 sm:grid-cols-2 gap-4">';
    html += UI.inputField('Monthly Revenue', 'monthlyRevenue', d.revenue, 'number', { prefix: '$' });
    html += UI.inputField('Monthly Rent', 'rentMonthly', d.rent, 'number', { prefix: '$' });
    html += '</div>';

    html += '<div class="grid grid-cols-1 sm:grid-cols-2 gap-4">';
    html += UI.inputField('Food Cost %', 'foodCostPct', d.food, 'number', { suffix: '%' });
    html += UI.inputField('Labor %', 'laborPct', d.labor, 'number', { suffix: '%' });
    html += '</div>';

    html += '<div class="grid grid-cols-1 sm:grid-cols-2 gap-4">';
    html += UI.inputField('Royalty %', 'royaltyPct', d.royalty, 'number', { suffix: '%', step: '0.1' });
    html += UI.inputField('Ad Fund %', 'adFundPct', d.adFund, 'number', { suffix: '%', step: '0.1' });
    html += '</div>';

    html += '<div class="grid grid-cols-1 sm:grid-cols-3 gap-4">';
    html += UI.inputField('Utilities/mo', 'utilitiesMonthly', d.utilities, 'number', { prefix: '$' });
    html += UI.inputField('Insurance/mo', 'insuranceMonthly', d.insurance, 'number', { prefix: '$' });
    html += UI.inputField('Other/mo', 'otherMonthly', d.other, 'number', { prefix: '$' });
    html += '</div>';

    html += '<div class="mt-6 flex gap-3">';
    html += UI.button('Calculate & Save Scenario', 'Wizards.saveScenario()', 'primary');
    html += UI.button('Cancel', 'Wizards.render()', 'secondary');
    html += '</div></form>';

    el.innerHTML = html;
  },

  goBack() {
    Wizards.state.step = Math.max(1, Wizards.state.step - 1);
    Wizards.renderStep();
  },

  saveScenario() {
    const form = document.getElementById('wizard-final');
    const n = (name) => parseFloat(form.querySelector('[name="' + name + '"]').value) || 0;
    const t = Wizards.getTemplate();

    const inputs = {
      totalInvestment: n('totalInvestment'), downPayment: n('downPayment'),
      monthlyRevenue: n('monthlyRevenue'), rentMonthly: n('rentMonthly'),
      foodCostPct: n('foodCostPct'), laborPct: n('laborPct'),
      royaltyPct: n('royaltyPct'), adFundPct: n('adFundPct'),
      utilitiesMonthly: n('utilitiesMonthly'), insuranceMonthly: n('insuranceMonthly'),
      otherMonthly: n('otherMonthly'),
    };

    const computed = Engine.calcScenario(inputs);
    const scenario = Store.saveScenario({
      name: Wizards.state.scenarioName || 'Untitled Scenario',
      templateId: Wizards.state.templateId === '_custom' ? null : Wizards.state.templateId,
      templateName: t.name,
      entryPoint: Wizards.state.entryPoint,
      inputs,
      computed,
    });

    window.location.hash = 'scenario/' + scenario.id;
  }
};
