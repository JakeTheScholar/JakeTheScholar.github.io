/**
 * Core financial math for house hack analysis.
 */

export function monthlyPayment(principal, annualRate, years = 30) {
  const r = annualRate / 100 / 12;
  const n = years * 12;
  if (r === 0) return principal / n;
  return principal * (r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
}

export function totalMonthlyHousing(price, downPct, rate, taxRate = 1.1, insuranceAnnual = 1200) {
  const loanAmount = price * (1 - downPct / 100);
  const pi = monthlyPayment(loanAmount, rate);
  const tax = (price * taxRate / 100) / 12;
  const insurance = insuranceAnnual / 12;
  return { pi, tax, insurance, total: pi + tax + insurance, loanAmount };
}

export function cashFlow(monthlyRent, monthlyHousing, vacancyPct = 8, maintenancePct = 10) {
  const vacancy = monthlyRent * vacancyPct / 100;
  const maintenance = monthlyRent * maintenancePct / 100;
  const effectiveRent = monthlyRent - vacancy - maintenance;
  const net = effectiveRent - monthlyHousing;
  return { effectiveRent, vacancy, maintenance, net, annual: net * 12 };
}

export function cashOnCash(annualCashFlow, downPayment, closingCosts) {
  const invested = downPayment + closingCosts;
  if (invested === 0) return 0;
  return (annualCashFlow / invested) * 100;
}

export function equityAfterYears(price, loanAmount, rate, years = 2, appreciationPct = 3) {
  const r = rate / 100 / 12;
  const n = 30 * 12;
  const monthlyPmt = monthlyPayment(loanAmount, rate);

  let balance = loanAmount;
  for (let i = 0; i < years * 12; i++) {
    const interest = balance * r;
    const principalPaid = monthlyPmt - interest;
    balance -= principalPaid;
  }

  const principalPaydown = loanAmount - balance;
  const futureValue = price * Math.pow(1 + appreciationPct / 100, years);
  const appreciation = futureValue - price;

  return { principalPaydown, appreciation, totalEquity: principalPaydown + appreciation, futureValue };
}

export function breakEvenRent(monthlyHousing, vacancyPct = 8, maintenancePct = 10) {
  // effectiveRent = rent * (1 - vacancy% - maintenance%) = monthlyHousing
  const factor = 1 - vacancyPct / 100 - maintenancePct / 100;
  return monthlyHousing / factor;
}

export function capRate(annualNOI, purchasePrice) {
  if (purchasePrice === 0) return 0;
  return (annualNOI / purchasePrice) * 100;
}

// Discounted Cash Flow — NPV of future cash flows over a hold period
export function dcfAnalysis(price, loanAmount, rate, rentPerUnit, units, holdYears, assumptions) {
  const {
    vacancyPct = 8, maintenancePct = 10, appreciationPct = 3,
    rentGrowthPct = 2, discountRate = 10, taxRate = 1.1,
    insuranceAnnual = 1200, closingCostPct = 3, downPct = 3.5,
    sellingCostPct = 6,
  } = assumptions;

  const downPayment = price * downPct / 100;
  const closingCosts = price * closingCostPct / 100;
  const totalInvested = downPayment + closingCosts;
  const monthlyPmt = monthlyPayment(loanAmount, rate);
  const r = rate / 100 / 12;

  const annualCashFlows = [];
  let balance = loanAmount;
  let currentRent = rentPerUnit;

  for (let year = 1; year <= holdYears; year++) {
    // Revenue
    const grossRent = currentRent * units * 12;
    const effectiveGross = grossRent * (1 - vacancyPct / 100);

    // Expenses
    const maintenance = grossRent * maintenancePct / 100;
    const taxes = price * Math.pow(1 + appreciationPct / 100, year) * taxRate / 100;
    const insurance = insuranceAnnual;
    const totalExpenses = maintenance + taxes + insurance;

    // NOI
    const noi = effectiveGross - totalExpenses;

    // Debt service
    const annualDebtService = monthlyPmt * 12;

    // Principal paydown this year
    let yearPrincipal = 0;
    for (let m = 0; m < 12; m++) {
      const interest = balance * r;
      const principal = monthlyPmt - interest;
      yearPrincipal += principal;
      balance -= principal;
    }

    // Cash flow after debt service
    const cashFlowBeforeTax = noi - annualDebtService;

    annualCashFlows.push({
      year,
      grossRent,
      effectiveGross,
      totalExpenses,
      noi,
      debtService: annualDebtService,
      cashFlow: cashFlowBeforeTax,
      principalPaydown: yearPrincipal,
      loanBalance: balance,
    });

    // Grow rent for next year
    currentRent = currentRent * (1 + rentGrowthPct / 100);
  }

  // Sale proceeds at exit
  const exitValue = price * Math.pow(1 + appreciationPct / 100, holdYears);
  const sellingCosts = exitValue * sellingCostPct / 100;
  const saleProceeds = exitValue - balance - sellingCosts;

  // NPV calculation
  const dr = discountRate / 100;
  let npv = -totalInvested;
  for (let i = 0; i < annualCashFlows.length; i++) {
    npv += annualCashFlows[i].cashFlow / Math.pow(1 + dr, i + 1);
  }
  npv += saleProceeds / Math.pow(1 + dr, holdYears);

  // IRR via Newton's method
  const irr = calcIRR(totalInvested, annualCashFlows.map(y => y.cashFlow), saleProceeds);

  // Total return
  const totalCashFlow = annualCashFlows.reduce((sum, y) => sum + y.cashFlow, 0);
  const totalReturn = totalCashFlow + saleProceeds;
  const totalROI = totalInvested > 0 ? ((totalReturn - totalInvested) / totalInvested) * 100 : 0;
  const equityMultiple = totalInvested > 0 ? totalReturn / totalInvested : 0;

  // DSCR (year 1)
  const dscr = annualCashFlows[0].debtService > 0
    ? annualCashFlows[0].noi / annualCashFlows[0].debtService : 0;

  // GRM
  const grm = annualCashFlows[0].grossRent > 0 ? price / annualCashFlows[0].grossRent : 0;

  return {
    annualCashFlows,
    exitValue,
    sellingCosts,
    saleProceeds,
    npv,
    irr,
    totalCashFlow,
    totalReturn,
    totalROI,
    equityMultiple,
    dscr,
    grm,
    totalInvested,
  };
}

function calcIRR(initialInvestment, cashFlows, terminalValue, maxIter = 100) {
  let guess = 0.15;
  for (let i = 0; i < maxIter; i++) {
    let npv = -initialInvestment;
    let dnpv = 0;
    for (let t = 0; t < cashFlows.length; t++) {
      const factor = Math.pow(1 + guess, t + 1);
      npv += cashFlows[t] / factor;
      dnpv -= (t + 1) * cashFlows[t] / Math.pow(1 + guess, t + 2);
    }
    const n = cashFlows.length;
    npv += terminalValue / Math.pow(1 + guess, n);
    dnpv -= n * terminalValue / Math.pow(1 + guess, n + 1);

    if (Math.abs(dnpv) < 1e-10) break;
    const newGuess = guess - npv / dnpv;
    if (Math.abs(newGuess - guess) < 1e-8) { guess = newGuess; break; }
    guess = newGuess;
    if (guess < -0.99) guess = -0.5;
    if (guess > 10) guess = 5;
  }
  return guess * 100;
}

// Loan amortization schedule
export function amortizationSchedule(loanAmount, rate, years = 30) {
  const monthlyPmt = monthlyPayment(loanAmount, rate);
  const r = rate / 100 / 12;
  let balance = loanAmount;
  const yearly = [];

  for (let year = 1; year <= years; year++) {
    let yearInterest = 0, yearPrincipal = 0;
    for (let m = 0; m < 12; m++) {
      const interest = balance * r;
      const principal = monthlyPmt - interest;
      yearInterest += interest;
      yearPrincipal += principal;
      balance -= principal;
    }
    yearly.push({ year, principal: yearPrincipal, interest: yearInterest, balance: Math.max(0, balance) });
  }
  return yearly;
}

export function fullAnalysis(property, assumptions = {}) {
  const {
    downPct = 3.5,
    rate = 6.75,
    taxRate = 1.1,
    insuranceAnnual = 1200,
    vacancyPct = 8,
    maintenancePct = 10,
    closingCostPct = 3,
    appreciationPct = 3,
    rentPerUnit = null,
    holdYears = 5,
    rentGrowthPct = 2,
    discountRate = 10,
    sellingCostPct = 6,
  } = assumptions;

  const price = property.price || 0;
  const units = property.units || 2;
  const estimatedRent = rentPerUnit || property.rentEstimate || Math.round(price * 0.008);

  const housing = totalMonthlyHousing(price, downPct, rate, taxRate, insuranceAnnual);
  const downPayment = price * downPct / 100;
  const closingCosts = price * closingCostPct / 100;

  // Scenario 1: Live in one unit, rent the other(s)
  const liveInRent = estimatedRent * (units - 1);
  const liveInCF = cashFlow(liveInRent, housing.total, vacancyPct, maintenancePct);
  const liveInCoC = cashOnCash(liveInCF.annual, downPayment, closingCosts);

  // Scenario 2: Rent all units (after moving out)
  const fullRent = estimatedRent * units;
  const fullCF = cashFlow(fullRent, housing.total, vacancyPct, maintenancePct);
  const fullCoC = cashOnCash(fullCF.annual, downPayment, closingCosts);

  const equity = equityAfterYears(price, housing.loanAmount, rate, 2, appreciationPct);
  const breakEven = breakEvenRent(housing.total, vacancyPct, maintenancePct);
  const noi = fullCF.effectiveRent * 12;
  const cap = capRate(noi, price);

  // DCF Analysis
  const dcf = dcfAnalysis(price, housing.loanAmount, rate, estimatedRent, units, holdYears, {
    vacancyPct, maintenancePct, appreciationPct, rentGrowthPct,
    discountRate, taxRate, insuranceAnnual, closingCostPct, downPct, sellingCostPct,
  });

  // Expense ratio
  const grossRentAnnual = estimatedRent * units * 12;
  const totalExpensesAnnual = (estimatedRent * units * maintenancePct / 100 * 12)
    + (price * taxRate / 100) + insuranceAnnual;
  const expenseRatio = grossRentAnnual > 0 ? (totalExpensesAnnual / grossRentAnnual) * 100 : 0;

  // Rent-to-price ratio (monthly rent / price * 100)
  const rentToPriceRatio = price > 0 ? (estimatedRent * units / price) * 100 : 0;

  return {
    price,
    units,
    estimatedRent,
    downPayment,
    closingCosts,
    totalInvested: downPayment + closingCosts,
    housing,
    liveIn: { ...liveInCF, coc: liveInCoC },
    fullRental: { ...fullCF, coc: fullCoC },
    equity,
    breakEvenRent: breakEven,
    capRate: cap,
    dcf,
    expenseRatio,
    rentToPriceRatio,
  };
}

// Sensitivity analysis — vary one assumption while holding others constant
export function sensitivityAnalysis(property, baseAssumptions) {
  const scenarios = {};
  const base = fullAnalysis(property, baseAssumptions);

  // Interest rate sensitivity
  scenarios.rate = [];
  for (let r = 5.0; r <= 9.0; r += 0.5) {
    const a = fullAnalysis(property, { ...baseAssumptions, rate: r });
    scenarios.rate.push({ value: r, label: `${r}%`, cashFlow: a.liveIn.net, coc: a.liveIn.coc, npv: a.dcf.npv, dscr: a.dcf.dscr });
  }

  // Vacancy sensitivity
  scenarios.vacancy = [];
  for (let v = 0; v <= 20; v += 2) {
    const a = fullAnalysis(property, { ...baseAssumptions, vacancyPct: v });
    scenarios.vacancy.push({ value: v, label: `${v}%`, cashFlow: a.liveIn.net, coc: a.liveIn.coc, npv: a.dcf.npv, dscr: a.dcf.dscr });
  }

  // Appreciation sensitivity
  scenarios.appreciation = [];
  for (let ap = 0; ap <= 6; ap += 1) {
    const a = fullAnalysis(property, { ...baseAssumptions, appreciationPct: ap });
    scenarios.appreciation.push({ value: ap, label: `${ap}%`, cashFlow: a.liveIn.net, totalROI: a.dcf.totalROI, npv: a.dcf.npv, irr: a.dcf.irr });
  }

  // Rent sensitivity
  const baseRent = baseAssumptions.rentPerUnit || property.rentEstimate || Math.round((property.price || 0) * 0.008);
  scenarios.rent = [];
  for (let pct = -30; pct <= 30; pct += 10) {
    const rent = Math.round(baseRent * (1 + pct / 100));
    const a = fullAnalysis(property, { ...baseAssumptions, rentPerUnit: rent });
    scenarios.rent.push({ value: rent, label: `$${rent}`, pctChange: pct, cashFlow: a.liveIn.net, coc: a.liveIn.coc, npv: a.dcf.npv });
  }

  return { base, scenarios };
}

// Monte Carlo cash flow simulation
export function monteCarloSimulation(property, baseAssumptions, numSims = 2000) {
  const price = property.price || 0;
  const units = property.units || 2;
  const baseRent = baseAssumptions.rentPerUnit || property.rentEstimate || Math.round(price * 0.008);
  const holdYears = baseAssumptions.holdYears || 5;

  const results = [];
  for (let sim = 0; sim < numSims; sim++) {
    // Randomize assumptions within realistic ranges
    const rate = baseAssumptions.rate + (Math.random() - 0.5) * 2; // +/- 1%
    const vacancy = Math.max(0, baseAssumptions.vacancyPct + (Math.random() - 0.5) * 16); // +/- 8%
    const maintenance = Math.max(0, baseAssumptions.maintenancePct + (Math.random() - 0.5) * 10); // +/- 5%
    const appreciation = baseAssumptions.appreciationPct + (Math.random() - 0.5) * 6; // +/- 3%
    const rentGrowth = baseAssumptions.rentGrowthPct + (Math.random() - 0.5) * 4; // +/- 2%
    const rentVariation = baseRent * (1 + (Math.random() - 0.5) * 0.2); // +/- 10%

    const a = fullAnalysis(property, {
      ...baseAssumptions,
      rate: Math.max(3, rate),
      vacancyPct: vacancy,
      maintenancePct: maintenance,
      appreciationPct: appreciation,
      rentGrowthPct: rentGrowth,
      rentPerUnit: Math.round(rentVariation),
    });

    results.push({
      totalROI: a.dcf.totalROI,
      npv: a.dcf.npv,
      irr: a.dcf.irr,
      monthlyCF: a.liveIn.net,
      annualCF: a.liveIn.annual,
      totalReturn: a.dcf.totalReturn,
    });
  }

  // Sort and compute percentiles
  const sorted = (arr) => [...arr].sort((a, b) => a - b);
  const percentile = (arr, p) => { const s = sorted(arr); const i = Math.floor(s.length * p / 100); return s[Math.min(i, s.length - 1)]; };

  const roiArr = results.map(r => r.totalROI);
  const npvArr = results.map(r => r.npv);
  const cfArr = results.map(r => r.monthlyCF);
  const irrArr = results.map(r => r.irr);

  return {
    numSims,
    roi: {
      p5: percentile(roiArr, 5), p25: percentile(roiArr, 25),
      median: percentile(roiArr, 50), p75: percentile(roiArr, 75),
      p95: percentile(roiArr, 95), mean: roiArr.reduce((a, b) => a + b, 0) / roiArr.length,
    },
    npv: {
      p5: percentile(npvArr, 5), p25: percentile(npvArr, 25),
      median: percentile(npvArr, 50), p75: percentile(npvArr, 75),
      p95: percentile(npvArr, 95), mean: npvArr.reduce((a, b) => a + b, 0) / npvArr.length,
      probPositive: npvArr.filter(v => v > 0).length / npvArr.length * 100,
    },
    cashFlow: {
      p5: percentile(cfArr, 5), p25: percentile(cfArr, 25),
      median: percentile(cfArr, 50), p75: percentile(cfArr, 75),
      p95: percentile(cfArr, 95), mean: cfArr.reduce((a, b) => a + b, 0) / cfArr.length,
      probPositive: cfArr.filter(v => v > 0).length / cfArr.length * 100,
    },
    irr: {
      p5: percentile(irrArr, 5), median: percentile(irrArr, 50), p95: percentile(irrArr, 95),
    },
    // Histogram buckets for NPV
    npvHistogram: buildHistogram(npvArr, 20),
    cfHistogram: buildHistogram(cfArr, 20),
  };
}

function buildHistogram(arr, buckets) {
  const min = Math.min(...arr);
  const max = Math.max(...arr);
  const range = max - min || 1;
  const bucketSize = range / buckets;
  const hist = Array(buckets).fill(0);
  arr.forEach(v => {
    const idx = Math.min(Math.floor((v - min) / bucketSize), buckets - 1);
    hist[idx]++;
  });
  return hist.map((count, i) => ({
    min: min + i * bucketSize,
    max: min + (i + 1) * bucketSize,
    count,
    pct: count / arr.length * 100,
  }));
}

// 5-Year wealth projection
export function wealthProjection(property, assumptions) {
  const analysis = fullAnalysis(property, assumptions);
  const { dcf } = analysis;
  const downPayment = analysis.downPayment;
  const closingCosts = analysis.closingCosts;
  const price = property.price || 0;
  const rate = assumptions.rate || 6.75;
  const appreciationPct = assumptions.appreciationPct || 3;

  const years = [];
  let cumulativeCF = 0;

  for (let i = 0; i < dcf.annualCashFlows.length; i++) {
    const yr = dcf.annualCashFlows[i];
    cumulativeCF += yr.cashFlow;

    const propertyValue = price * Math.pow(1 + appreciationPct / 100, i + 1);
    const equityFromAppreciation = propertyValue - price;
    const principalPaid = analysis.housing.loanAmount - yr.loanBalance;
    const totalEquity = equityFromAppreciation + principalPaid;
    const totalWealth = totalEquity + cumulativeCF - downPayment - closingCosts;

    years.push({
      year: i + 1,
      propertyValue,
      loanBalance: yr.loanBalance,
      equity: totalEquity,
      cumulativeCashFlow: cumulativeCF,
      totalWealth,
      cashFlow: yr.cashFlow,
    });
  }

  return years;
}

export function formatCurrency(n) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);
}

export function formatPct(n) {
  return `${n >= 0 ? '' : ''}${n.toFixed(1)}%`;
}
