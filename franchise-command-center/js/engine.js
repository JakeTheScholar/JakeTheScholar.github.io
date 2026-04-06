"use strict";

const Engine = {
  calcScenario(inputs) {
    const revenue = inputs.monthlyRevenue;
    const foodCost = revenue * (inputs.foodCostPct / 100);
    const labor = revenue * (inputs.laborPct / 100);
    const royalty = revenue * (inputs.royaltyPct / 100);
    const adFund = revenue * (inputs.adFundPct / 100);
    const rent = inputs.rentMonthly;
    const utilities = inputs.utilitiesMonthly;
    const insurance = inputs.insuranceMonthly;
    const other = inputs.otherMonthly;

    const totalExpenses = foodCost + labor + royalty + adFund + rent + utilities + insurance + other;
    const monthlyCashFlow = revenue - totalExpenses;

    const totalInvestment = inputs.totalInvestment;
    const breakEvenMonth = monthlyCashFlow > 0 ? Math.ceil(totalInvestment / monthlyCashFlow) : -1;
    const annualCashFlow = monthlyCashFlow * 12;
    const firstYearROI = totalInvestment > 0 ? (annualCashFlow / totalInvestment) * 100 : 0;
    const annualOwnerEarnings = annualCashFlow;

    return {
      monthlyCashFlow: Math.round(monthlyCashFlow * 100) / 100,
      breakEvenMonth,
      firstYearROI: Math.round(firstYearROI * 100) / 100,
      annualOwnerEarnings: Math.round(annualOwnerEarnings * 100) / 100,
      lineItems: {
        revenue,
        foodCost: Math.round(foodCost * 100) / 100,
        labor: Math.round(labor * 100) / 100,
        royalty: Math.round(royalty * 100) / 100,
        adFund: Math.round(adFund * 100) / 100,
        rent,
        utilities,
        insurance,
        other,
        totalExpenses: Math.round(totalExpenses * 100) / 100,
        netCashFlow: Math.round(monthlyCashFlow * 100) / 100,
      }
    };
  },

  buildPnL(lineItems) {
    const rev = lineItems.revenue;
    const pct = (val) => rev > 0 ? Math.round((val / rev) * 1000) / 10 : 0;
    return [
      { label: 'Gross Revenue',  amount: rev,                  pctOfRevenue: 100 },
      { label: 'Food Cost',      amount: -lineItems.foodCost,  pctOfRevenue: pct(lineItems.foodCost) },
      { label: 'Labor',          amount: -lineItems.labor,     pctOfRevenue: pct(lineItems.labor) },
      { label: 'Royalty Fee',    amount: -lineItems.royalty,    pctOfRevenue: pct(lineItems.royalty) },
      { label: 'Ad Fund',        amount: -lineItems.adFund,    pctOfRevenue: pct(lineItems.adFund) },
      { label: 'Rent',           amount: -lineItems.rent,      pctOfRevenue: pct(lineItems.rent) },
      { label: 'Utilities',      amount: -lineItems.utilities, pctOfRevenue: pct(lineItems.utilities) },
      { label: 'Insurance',      amount: -lineItems.insurance, pctOfRevenue: pct(lineItems.insurance) },
      { label: 'Other',          amount: -lineItems.other,     pctOfRevenue: pct(lineItems.other) },
      { label: 'Net Cash Flow',  amount: lineItems.netCashFlow, pctOfRevenue: pct(Math.abs(lineItems.netCashFlow)), isTotal: true },
    ];
  },

  calcPortfolioTimeline(locations, months) {
    months = months || 60;
    const monthly = [];
    let cumulativeCashFlow = 0;
    let totalInvestment = 0;
    const milestones = [];
    const locationBreakEven = {};

    for (let m = 0; m < months; m++) {
      let monthCashFlow = 0;
      const byLocation = [];

      locations.forEach((loc, idx) => {
        const monthsSinceOpen = m - loc.openMonth;
        if (monthsSinceOpen < 0) {
          byLocation.push(0);
          return;
        }
        if (monthsSinceOpen === 0) {
          totalInvestment += loc.scenario.inputs.totalInvestment;
          milestones.push({ month: m, text: loc.scenario.name + ' opens' });
        }
        const computed = Engine.calcScenario(loc.scenario.inputs);
        const cf = computed.monthlyCashFlow;
        monthCashFlow += cf;
        byLocation.push(cf);

        if (!locationBreakEven[idx]) locationBreakEven[idx] = { cumulative: 0, done: false };
        if (!locationBreakEven[idx].done) {
          locationBreakEven[idx].cumulative += cf;
          if (locationBreakEven[idx].cumulative >= loc.scenario.inputs.totalInvestment) {
            locationBreakEven[idx].done = true;
            milestones.push({ month: m, text: loc.scenario.name + ' breaks even' });
          }
        }
      });

      cumulativeCashFlow += monthCashFlow;
      monthly.push({ month: m, cashFlow: Math.round(monthCashFlow * 100) / 100, cumulative: Math.round(cumulativeCashFlow * 100) / 100, byLocation });

      const nextUnopened = locations.find(l => l.openMonth > m);
      if (nextUnopened && cumulativeCashFlow >= nextUnopened.scenario.inputs.totalInvestment) {
        const existing = milestones.find(ms => ms.text.includes('cash flow covers'));
        if (!existing) {
          milestones.push({ month: m, text: 'Cash flow covers ' + nextUnopened.scenario.name + ' investment' });
        }
      }
    }

    return {
      monthly,
      milestones: milestones.sort((a, b) => a.month - b.month),
      totalInvestment,
      combinedMonthlyCashFlow: monthly.length > 0 ? monthly[monthly.length - 1].cashFlow : 0,
      portfolioROI: totalInvestment > 0 ? Math.round(((cumulativeCashFlow / totalInvestment) * 100) * 100) / 100 : 0
    };
  },

  calcCapitalFeasibility(template, capital, maxDown, minCashFlow) {
    const investmentLevels = ['low', 'mid', 'high'];
    const results = investmentLevels.map(level => {
      const investment = template.investmentRange[level];
      const revenue = template.revenueBenchmarks[level];
      const inputs = {
        totalInvestment: investment,
        downPayment: Math.min(maxDown, investment),
        monthlyRevenue: revenue,
        rentMonthly: 4500,
        foodCostPct: template.costDefaults.foodCostPct.mid,
        laborPct: template.costDefaults.laborPct.mid,
        royaltyPct: template.fees.royaltyPct,
        adFundPct: template.fees.adFundPct,
        utilitiesMonthly: template.costDefaults.utilitiesMonthly,
        insuranceMonthly: template.costDefaults.insuranceMonthly,
        otherMonthly: template.costDefaults.otherMonthly,
      };
      const computed = Engine.calcScenario(inputs);
      return {
        level,
        investment,
        revenue,
        feasible: investment <= capital && computed.monthlyCashFlow >= minCashFlow,
        monthlyCashFlow: computed.monthlyCashFlow,
        breakEvenMonth: computed.breakEvenMonth,
        inputs,
        computed,
      };
    });

    const midInvestment = template.investmentRange.mid;
    const expensePct = (template.costDefaults.foodCostPct.mid + template.costDefaults.laborPct.mid + template.fees.royaltyPct + template.fees.adFundPct) / 100;
    const fixedExpenses = 4500 + template.costDefaults.utilitiesMonthly + template.costDefaults.insuranceMonthly + template.costDefaults.otherMonthly;
    const requiredRevenueForBreakEven = expensePct < 1 ? Math.ceil(fixedExpenses / (1 - expensePct)) : -1;

    return { results, requiredRevenueForBreakEven };
  }
};
