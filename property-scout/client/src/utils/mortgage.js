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
  };
}

export function formatCurrency(n) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);
}

export function formatPct(n) {
  return `${n >= 0 ? '' : ''}${n.toFixed(1)}%`;
}
