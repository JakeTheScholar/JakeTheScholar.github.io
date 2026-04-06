"use strict";

const Templates = {
  render() {
    const templates = Store.getTemplates();
    const el = App.getContent();

    if (templates.length === 0) {
      el.innerHTML = UI.pageHeader('Templates', 'Manage franchise brand profiles') +
        UI.emptyState('&#128203;', 'No templates yet', 'Create a franchise template to get started.',
          UI.button('Create Template', 'Templates.showForm()', 'primary'));
      return;
    }

    let html = UI.pageHeader('Templates', templates.length + ' franchise profile' + (templates.length > 1 ? 's' : ''),
      UI.button('+ New Template', 'Templates.showForm()', 'primary'));

    html += '<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">';
    templates.forEach(t => {
      html += '<div class="card p-5">';
      html += '<div class="flex items-start justify-between"><h3 class="font-semibold text-white">' + UI.esc(t.name) + '</h3>';
      html += '<span class="text-xs text-slate-500">' + UI.esc(t.created || '') + '</span></div>';
      html += '<div class="mt-3 space-y-1 text-sm text-slate-400">';
      html += '<p>Royalty: ' + t.fees.royaltyPct + '% &middot; Ad Fund: ' + t.fees.adFundPct + '%</p>';
      html += '<p>Investment: ' + UI.currencyCompact(t.investmentRange.low) + ' &ndash; ' + UI.currencyCompact(t.investmentRange.high) + '</p>';
      html += '<p>Revenue: ' + UI.currencyCompact(t.revenueBenchmarks.low) + ' &ndash; ' + UI.currencyCompact(t.revenueBenchmarks.high) + '/mo</p>';
      html += '</div>';
      html += '<div class="mt-4 flex gap-2">';
      html += UI.button('Edit', "Templates.showForm('" + UI.esc(t.id) + "')", 'secondary');
      html += UI.button('Duplicate', "Templates.duplicate('" + UI.esc(t.id) + "')", 'secondary');
      html += UI.button('Delete', "Templates.confirmDelete('" + UI.esc(t.id) + "')", 'danger');
      html += '</div></div>';
    });
    html += '</div>';
    el.innerHTML = html;
  },

  showForm(id) {
    const existing = id ? Store.getTemplate(id) : null;
    const t = existing || {
      name: '', fees: { royaltyPct: 5, adFundPct: 2, otherFees: [] },
      costDefaults: { foodCostPct: { low: 25, mid: 28, high: 32 }, laborPct: { low: 22, mid: 25, high: 28 }, utilitiesMonthly: 2000, insuranceMonthly: 700, otherMonthly: 400 },
      investmentRange: { low: 200000, mid: 300000, high: 400000 },
      revenueBenchmarks: { low: 40000, mid: 60000, high: 80000 },
      termYears: 10
    };

    const el = App.getContent();
    let html = UI.pageHeader(existing ? 'Edit Template' : 'New Template', 'Define franchise brand defaults',
      UI.button('&larr; Back', 'Templates.render()', 'secondary'));

    html += '<form id="template-form" class="form-panel p-4 sm:p-6 space-y-6">';

    html += '<div class="border-b border-slate-700/30 pb-4"><h3 class="font-semibold text-white mb-3">Basic Info</h3>';
    html += '<div class="grid grid-cols-1 sm:grid-cols-2 gap-4">';
    html += UI.inputField('Franchise Name', 'name', t.name, 'text');
    html += UI.inputField('Term (years)', 'termYears', t.termYears, 'number');
    html += '</div></div>';

    html += '<div class="border-b border-slate-700/30 pb-4"><h3 class="font-semibold text-white mb-3">Fee Structure</h3>';
    html += '<div class="grid grid-cols-1 sm:grid-cols-2 gap-4">';
    html += UI.inputField('Royalty', 'royaltyPct', t.fees.royaltyPct, 'number', { suffix: '%', step: '0.1' });
    html += UI.inputField('Ad Fund', 'adFundPct', t.fees.adFundPct, 'number', { suffix: '%', step: '0.1' });
    html += '</div></div>';

    html += '<div class="border-b border-slate-700/30 pb-4"><h3 class="font-semibold text-white mb-3">Cost Defaults</h3>';
    html += '<div class="grid grid-cols-1 sm:grid-cols-3 gap-4">';
    html += UI.inputField('Food Cost Low', 'foodCostLow', t.costDefaults.foodCostPct.low, 'number', { suffix: '%' });
    html += UI.inputField('Food Cost Mid', 'foodCostMid', t.costDefaults.foodCostPct.mid, 'number', { suffix: '%' });
    html += UI.inputField('Food Cost High', 'foodCostHigh', t.costDefaults.foodCostPct.high, 'number', { suffix: '%' });
    html += UI.inputField('Labor Low', 'laborLow', t.costDefaults.laborPct.low, 'number', { suffix: '%' });
    html += UI.inputField('Labor Mid', 'laborMid', t.costDefaults.laborPct.mid, 'number', { suffix: '%' });
    html += UI.inputField('Labor High', 'laborHigh', t.costDefaults.laborPct.high, 'number', { suffix: '%' });
    html += '</div>';
    html += '<div class="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-3">';
    html += UI.inputField('Utilities/mo', 'utilitiesMonthly', t.costDefaults.utilitiesMonthly, 'number', { prefix: '$' });
    html += UI.inputField('Insurance/mo', 'insuranceMonthly', t.costDefaults.insuranceMonthly, 'number', { prefix: '$' });
    html += UI.inputField('Other/mo', 'otherMonthly', t.costDefaults.otherMonthly, 'number', { prefix: '$' });
    html += '</div></div>';

    html += '<div class="border-b border-slate-700/30 pb-4"><h3 class="font-semibold text-white mb-3">Investment Range</h3>';
    html += '<div class="grid grid-cols-1 sm:grid-cols-3 gap-4">';
    html += UI.inputField('Low', 'investLow', t.investmentRange.low, 'number', { prefix: '$' });
    html += UI.inputField('Mid', 'investMid', t.investmentRange.mid, 'number', { prefix: '$' });
    html += UI.inputField('High', 'investHigh', t.investmentRange.high, 'number', { prefix: '$' });
    html += '</div></div>';

    html += '<div class="pb-4"><h3 class="font-semibold text-white mb-3">Revenue Benchmarks (monthly)</h3>';
    html += '<div class="grid grid-cols-1 sm:grid-cols-3 gap-4">';
    html += UI.inputField('Low', 'revLow', t.revenueBenchmarks.low, 'number', { prefix: '$' });
    html += UI.inputField('Mid', 'revMid', t.revenueBenchmarks.mid, 'number', { prefix: '$' });
    html += UI.inputField('High', 'revHigh', t.revenueBenchmarks.high, 'number', { prefix: '$' });
    html += '</div></div>';

    html += '<div class="flex gap-3">';
    html += UI.button(existing ? 'Save Changes' : 'Create Template', "Templates.save('" + UI.esc(id || '') + "')", 'primary');
    html += UI.button('Cancel', 'Templates.render()', 'secondary');
    html += '</div></form>';

    el.innerHTML = html;
  },

  save(id) {
    const form = document.getElementById('template-form');
    const f = (name) => form.querySelector('[name="' + name + '"]').value;
    const n = (name) => parseFloat(f(name)) || 0;

    const data = {
      name: f('name'),
      fees: { royaltyPct: n('royaltyPct'), adFundPct: n('adFundPct'), otherFees: [] },
      costDefaults: {
        foodCostPct: { low: n('foodCostLow'), mid: n('foodCostMid'), high: n('foodCostHigh') },
        laborPct: { low: n('laborLow'), mid: n('laborMid'), high: n('laborHigh') },
        utilitiesMonthly: n('utilitiesMonthly'),
        insuranceMonthly: n('insuranceMonthly'),
        otherMonthly: n('otherMonthly'),
      },
      investmentRange: { low: n('investLow'), mid: n('investMid'), high: n('investHigh') },
      revenueBenchmarks: { low: n('revLow'), mid: n('revMid'), high: n('revHigh') },
      termYears: n('termYears'),
    };

    if (id) data.id = id;
    Store.saveTemplate(data);
    Templates.render();
  },

  duplicate(id) {
    const original = Store.getTemplate(id);
    if (!original) return;
    const copy = { ...JSON.parse(JSON.stringify(original)), id: undefined, name: original.name + ' (Copy)' };
    delete copy.id;
    Store.saveTemplate(copy);
    Templates.render();
  },

  confirmDelete(id) {
    const t = Store.getTemplate(id);
    if (!t) return;
    if (confirm('Delete "' + t.name + '"? This cannot be undone.')) {
      Store.deleteTemplate(id);
      Templates.render();
    }
  }
};
