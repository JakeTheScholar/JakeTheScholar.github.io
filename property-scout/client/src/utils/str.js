/**
 * STR (Short-Term Rental) market intel + scoring + Year-1 ROI.
 *
 * An STR with average guest stay <=7 days is a non-passive activity
 * (IRS Reg 1.469-1T(e)(3)(ii)(A)). With cost segregation, year-one bonus depreciation
 * can offset active W-2/business income directly. That tax shield is the *reason*
 * to STR — the cash-on-cash return alone rarely justifies it.
 */

// Directional ADR + occupancy + seasonality by market. Values reflect public AirDNA /
// Rabbu market snapshots (2024–2025 observations) and are medians, not forecasts.
// Seasonality is a 12-element multiplier array (Jan..Dec) centered around 1.0.
// Always override per-property with real comps — this is a starting point.
const MARKET_STATS = {
  gatlinburg: {
    medianADR: 285,
    adrByBeds: { 1: 165, 2: 215, 3: 285, 4: 355, 5: 430, 6: 510 },
    occPct: 62,
    seasonality: [0.70, 0.70, 0.90, 1.00, 1.10, 1.30, 1.30, 1.10, 1.10, 1.30, 1.00, 1.00],
    source: 'AirDNA/Rabbu Gatlinburg snapshot',
  },
  pigeonForge: {
    medianADR: 275,
    adrByBeds: { 1: 155, 2: 205, 3: 275, 4: 340, 5: 410, 6: 490 },
    occPct: 60,
    seasonality: [0.70, 0.70, 0.90, 1.00, 1.10, 1.30, 1.30, 1.10, 1.10, 1.30, 1.00, 1.00],
    source: 'AirDNA/Rabbu Pigeon Forge snapshot',
  },
  brokenBow: {
    medianADR: 245,
    adrByBeds: { 1: 140, 2: 185, 3: 245, 4: 305, 5: 370, 6: 440 },
    occPct: 58,
    seasonality: [0.60, 0.65, 0.85, 0.95, 1.10, 1.25, 1.30, 1.20, 1.00, 1.15, 0.95, 1.00],
    source: 'AirDNA/Rabbu Broken Bow snapshot',
  },
  panhandle30a: {
    medianADR: 400,
    adrByBeds: { 1: 230, 2: 310, 3: 400, 4: 510, 5: 640, 6: 780 },
    occPct: 55,
    seasonality: [0.55, 0.60, 0.80, 0.95, 1.20, 1.50, 1.55, 1.40, 1.10, 0.90, 0.70, 0.75],
    source: 'AirDNA/Rabbu 30A / Destin snapshot',
  },
  poconos: {
    medianADR: 265,
    adrByBeds: { 1: 150, 2: 200, 3: 265, 4: 330, 5: 400, 6: 475 },
    occPct: 54,
    seasonality: [1.25, 1.25, 1.00, 0.80, 0.85, 1.00, 1.20, 1.10, 0.90, 1.00, 0.95, 1.30],
    source: 'AirDNA/Rabbu Poconos snapshot',
  },
  lakeMi: {
    medianADR: 290,
    adrByBeds: { 1: 170, 2: 225, 3: 290, 4: 365, 5: 445, 6: 530 },
    occPct: 52,
    seasonality: [0.45, 0.45, 0.55, 0.70, 1.00, 1.50, 1.70, 1.50, 1.10, 0.80, 0.55, 0.50],
    source: 'AirDNA/Rabbu Lake Michigan shoreline snapshot',
  },
  rochesterMn: {
    medianADR: 160,
    adrByBeds: { 1: 100, 2: 130, 3: 160, 4: 200, 5: 245 },
    occPct: 68,
    seasonality: [1.00, 1.00, 1.00, 1.00, 1.00, 1.00, 1.00, 1.00, 1.00, 1.00, 1.00, 1.00],
    source: 'AirDNA Rochester (Mayo travel-nurse demand) snapshot',
  },
  houstonMed: {
    medianADR: 140,
    adrByBeds: { 1: 90, 2: 115, 3: 140, 4: 175, 5: 210 },
    occPct: 65,
    seasonality: [0.95, 0.95, 1.00, 1.05, 1.05, 1.00, 0.95, 0.95, 1.05, 1.10, 1.00, 0.95],
    source: 'AirDNA Houston Medical Center snapshot',
  },
  nashville: {
    medianADR: 230,
    adrByBeds: { 1: 130, 2: 175, 3: 230, 4: 290, 5: 355 },
    occPct: 60,
    seasonality: [0.80, 0.85, 1.00, 1.10, 1.15, 1.15, 1.10, 1.00, 1.00, 1.10, 1.00, 0.95],
    source: 'AirDNA Nashville snapshot',
  },
};

// Whitelisted STR-friendly target markets.
// "score" is a baseline market quality (0-10): demand depth, seasonality smoothness,
// regulatory friendliness, and proven STR cash flow ratios.
const STR_MARKETS = [
  { name: 'Gatlinburg, TN',          statsKey: 'gatlinburg',   keywords: ['gatlinburg', 'sevierville'],           tier: 'A', score: 10, theme: 'Smokies tourism, year-round demand' },
  { name: 'Pigeon Forge, TN',        statsKey: 'pigeonForge',  keywords: ['pigeon forge'],                         tier: 'A', score: 10, theme: 'Smokies + Dollywood, family demand' },
  { name: 'Broken Bow, OK',          statsKey: 'brokenBow',    keywords: ['broken bow', 'hochatown'],              tier: 'A', score:  9, theme: 'Cabin market, Texas drive-to' },
  { name: '30A / Florida Panhandle', statsKey: 'panhandle30a', keywords: ['santa rosa beach', 'seaside', 'rosemary', '30a', 'panama city beach'], tier: 'A', score: 9, theme: 'Beach premium ADR' },
  { name: 'Pocono Mountains, PA',    statsKey: 'poconos',      keywords: ['poconos', 'pocono', 'tannersville', 'lake harmony'], tier: 'B', score: 8, theme: 'NYC drive-to, ski + summer' },
  { name: 'Lake Michigan Shoreline', statsKey: 'lakeMi',       keywords: ['south haven', 'saugatuck', 'glen arbor', 'traverse city'], tier: 'B', score: 8, theme: 'Summer beach, Chicago drive-to' },
  { name: 'Rochester, MN (Mayo)',    statsKey: 'rochesterMn',  keywords: ['rochester, mn', 'rochester mn'],        tier: 'B', score: 8, theme: 'Mayo Clinic traveling-nurse demand' },
  { name: 'Houston Med Center',      statsKey: 'houstonMed',   keywords: ['houston, tx', '77030'],                 tier: 'B', score: 7, theme: 'Texas Medical Center proximity' },
  { name: 'Nashville, TN',           statsKey: 'nashville',    keywords: ['nashville'],                            tier: 'B', score: 7, theme: 'Tourism + Vanderbilt hospital' },
];

// Hard regulatory blockers — properties here cannot run as a flexible STR.
const STR_BANNED = [
  { name: 'New York City',      keywords: ['new york, ny', 'nyc', 'manhattan', 'brooklyn', 'queens', 'bronx', 'staten island'], reason: 'Local Law 18 effectively bans <30-day rentals' },
  { name: 'San Francisco',      keywords: ['san francisco'],                                                                    reason: 'SF requires resident host + 90-day cap on un-hosted' },
  { name: 'New Orleans',        keywords: ['new orleans'],                                                                      reason: 'Whole-home STRs banned in residential zones' },
  { name: 'Honolulu, HI',       keywords: ['honolulu', 'oahu', 'waikiki'],                                                      reason: 'Bill 41 — 90-day minimum outside resort zones' },
  { name: 'Most of California', keywords: ['santa monica', 'los angeles', 'pasadena', 'oakland', 'berkeley', 'malibu'],         reason: 'Strict primary-residence rules in most CA cities' },
];

// Permit-constrained markets — don't auto-fail but flag strongly. These aren't bans;
// they require deeper zoning / HOA / permit diligence before you buy.
const STR_CAUTION = [
  { name: 'Charleston, SC',  keywords: ['charleston, sc', 'charleston sc', 'mount pleasant, sc'], reason: 'Historic District cap + primary-residence rule in most zones' },
  { name: 'Austin, TX',      keywords: ['austin, tx', 'austin tx'],                                reason: 'Type 2 non-owner-occupied STRs restricted; Type 6 needs commercial zoning' },
  { name: 'Savannah, GA',    keywords: ['savannah, ga', 'savannah ga'],                            reason: 'Historic District non-owner-occupied cap reached — no new permits' },
  { name: 'Park City, UT',   keywords: ['park city'],                                              reason: 'Nightly rental varies by condo project and HOA — confirm zoning + HOA docs' },
  { name: 'Asheville, NC',   keywords: ['asheville'],                                              reason: 'Whole-home STRs limited outside Resort Lodging district' },
  { name: 'Scottsdale, AZ',  keywords: ['scottsdale'],                                             reason: 'AZ HB 2672 — permit, insurance, ADA, two-incident rule' },
  { name: 'Hilton Head, SC', keywords: ['hilton head'],                                            reason: 'New STR ordinance tightening license tiers — confirm district' },
  { name: 'Miami Beach, FL', keywords: ['miami beach'],                                            reason: 'STR banned in most single-family zones; fines escalate' },
  { name: 'Palm Springs, CA',keywords: ['palm springs'],                                           reason: '32-day cap per property per year outside vacation-rental zones' },
  { name: 'Galveston, TX',   keywords: ['galveston'],                                              reason: 'HOA/POA restrictions vary heavily — confirm deed restrictions' },
  { name: 'Destin, FL',      keywords: ['destin'],                                                 reason: 'County STR ordinance requires registration + inspection (also in 30A target zone)' },
  { name: 'Myrtle Beach, SC',keywords: ['myrtle beach'],                                           reason: 'Zoning-dependent; many POA/HOA restrictions' },
];

function locationMatches(location, keywords) {
  const haystack = (location || '').toLowerCase();
  return keywords.some(k => haystack.includes(k));
}

export function classifyLocation(location) {
  for (const banned of STR_BANNED) {
    if (locationMatches(location, banned.keywords)) {
      return { kind: 'banned', name: banned.name, reason: banned.reason, score: 1 };
    }
  }
  for (const market of STR_MARKETS) {
    if (locationMatches(location, market.keywords)) {
      return { kind: 'target', name: market.name, theme: market.theme, tier: market.tier, score: market.score, statsKey: market.statsKey };
    }
  }
  for (const caution of STR_CAUTION) {
    if (locationMatches(location, caution.keywords)) {
      return { kind: 'caution', name: caution.name, reason: caution.reason, score: 4 };
    }
  }
  return { kind: 'neutral', score: 5 };
}

export function getSuggestedMarkets() {
  return STR_MARKETS.map(m => ({ name: m.name, tier: m.tier, theme: m.theme, query: m.name, statsKey: m.statsKey }));
}

export function getMarketStats(location) {
  const cls = classifyLocation(location);
  if (cls.kind !== 'target' || !cls.statsKey) return null;
  return MARKET_STATS[cls.statsKey] || null;
}

// Bedroom-scaled ADR from market stats; falls back to 0.18% of price heuristic.
export function estimateADR(property, location) {
  const stats = getMarketStats(location);
  if (stats) {
    const beds = Math.max(1, Math.min(6, property?.bedrooms || 3));
    return (stats.adrByBeds && stats.adrByBeds[beds]) || stats.medianADR;
  }
  return Math.max(120, Math.round((property?.price || 250000) * 0.0018));
}

export function estimateOccupancy(location) {
  const stats = getMarketStats(location);
  return stats ? stats.occPct : 65;
}

// 12-element seasonality — flat curve if no market match
export function seasonalityFor(location) {
  const stats = getMarketStats(location);
  return stats ? stats.seasonality : new Array(12).fill(1);
}

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const DAYS_IN_MONTH = [31,28,31,30,31,30,31,31,30,31,30,31];

// Build a 12-month revenue curve. Seasonality multipliers reshape both ADR and occupancy
// around the user's annual-average targets so the yearly totals match the blended inputs.
export function monthlyRevenueCurve({ nightlyRate, occupancyPct, seasonality }) {
  const curve = seasonality && seasonality.length === 12 ? seasonality : new Array(12).fill(1);
  const avgMult = curve.reduce((s, m) => s + m, 0) / 12 || 1;
  return DAYS_IN_MONTH.map((days, i) => {
    const mult = curve[i];
    const monthOcc = Math.min(100, (occupancyPct * mult / avgMult));
    const nights = Math.round(days * monthOcc / 100);
    const adr = Math.round(nightlyRate * mult);
    return {
      month: MONTHS[i],
      days,
      mult,
      occupancyPct: Math.round(monthOcc),
      nights,
      adr,
      revenue: nights * adr,
    };
  });
}

// LTR (long-term rental) baseline for the same property — no cost-seg shield (passive activity).
// Used as the apples-to-apples comparison against STR.
export function ltrBaseline(property, assumptions = {}) {
  const {
    avgRate        = 6.75,
    downPct        = 25,
    taxRatePct     = 1.1,
    ltrInsuranceAnnual = 1200,
    ltrMgmtPct     = 5,
    ltrVacancyPct  = 8,
    ltrMaintenancePct = 10,
  } = assumptions;

  const price = property.price || 0;
  const downPayment = price * downPct / 100;
  const loanAmount = price - downPayment;
  const r = avgRate / 100 / 12;
  const n = 360;
  const monthlyPI = r === 0 ? loanAmount / n : loanAmount * (r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);

  const rentMonthly = property.rentEstimate || Math.round(price * 0.007);
  const annualRent = rentMonthly * 12;
  const vacancy = annualRent * ltrVacancyPct / 100;
  const mgmt = annualRent * ltrMgmtPct / 100;
  const maintenance = annualRent * ltrMaintenancePct / 100;
  const tax = price * taxRatePct / 100;
  const opex = vacancy + mgmt + maintenance + ltrInsuranceAnnual + tax;
  const noi = annualRent - opex;
  const cashFlowAnnual = noi - monthlyPI * 12;

  return {
    rentMonthly,
    annualRent,
    opex,
    noi,
    cashFlowAnnual,
    cashFlowMonthly: cashFlowAnnual / 12,
    capRate: price > 0 ? (noi / price) * 100 : 0,
  };
}

/**
 * STR location score (0-10). Combines:
 *  - Market quality (regulatory + proven demand)
 *  - Property fit for STR (single-family / condo > multi-family for STR)
 *  - Price band (mid-tier $250K-$550K is the sweet spot for cost-seg leverage)
 */
export function strLocationScore({ location, property }) {
  const loc = classifyLocation(location);

  let propertyFit = 6;
  const type = (property?.propertyType || '').toLowerCase();
  if (/(single|sfh|sfr|condo|cabin|townhouse|townhome)/.test(type)) propertyFit = 9;
  else if (/(multi|duplex|triplex|fourplex|2-?unit|3-?unit|4-?unit)/.test(type)) propertyFit = 4;

  let priceBand = 5;
  const price = property?.price || 0;
  if (price >= 250000 && price <= 550000) priceBand = 10;
  else if (price >= 180000 && price < 250000) priceBand = 8;
  else if (price > 550000 && price <= 800000) priceBand = 6;
  else if (price > 0) priceBand = 3;

  const overall = Math.round((loc.score * 0.55 + propertyFit * 0.25 + priceBand * 0.20) * 10) / 10;

  let badge;
  if (loc.kind === 'banned') {
    badge = { label: `Banned: ${loc.name}`, class: 'badge-too-risky', danger: true };
  } else if (loc.kind === 'caution') {
    badge = { label: `Permit Risk: ${loc.name}`, class: 'badge-caution' };
  } else if (loc.kind === 'target' && overall >= 8) {
    badge = { label: `STR Target ${loc.tier}`, class: 'badge-sweet-spot' };
  } else if (overall >= 7) {
    badge = { label: 'STR Viable', class: 'badge-hidden-gem' };
  } else if (overall >= 5) {
    badge = { label: 'STR Marginal', class: 'badge-hidden-gem' };
  } else {
    badge = { label: 'STR Weak', class: 'badge-too-risky' };
  }

  return {
    overall,
    scores: { market: loc.score, propertyFit, priceBand },
    location: loc,
    badge,
  };
}

/**
 * STR Year-1 economics.
 *
 *   gross   = nights booked * ADR + cleaning recovery
 *   ops     = mgmt + cleaning costs + utilities + supplies + insurance + tax + maintenance
 *   noi     = gross - ops
 *   debtSvc = annual mortgage payment
 *   cashFlow = noi - debtSvc
 *
 *   Cost-seg tax shield (Y1, the *reason* to STR):
 *     buildingBasis     = price * 0.85   (assume 15% land)
 *     accelDepreciation = buildingBasis * costSegPct   (default 25-30%)
 *     taxShieldY1       = accelDepreciation * marginalTaxRate
 *
 *   Active-income shelter: activeIncome > 0 opts into a back-solve for how much
 *   of your ordinary income this single property shelters, and how many identical
 *   properties would be needed to fully offset it.
 *
 *   Eligibility for non-passive treatment requires avgStayDays <= 7 AND material
 *   participation — we surface both as gating checks, not silent assumptions.
 */
export function strAnalysis(property, assumptions = {}) {
  const {
    nightlyRate       = 240,
    occupancyPct      = 65,
    cleaningPerStay   = 100,
    avgStayDays       = 4,
    mgmtPct           = 20,
    suppliesUtilitiesAnnual = 4800,
    strInsuranceAnnual = 2400,
    strMaintenancePct = 8,
    avgRate           = 6.75,
    downPct           = 25,
    closingCostPct    = 3,
    taxRatePct        = 1.1,
    marginalTaxRatePct = 35,
    costSegBonusPct   = 28,
    landPct           = 15,
    furnishingCost    = 25000,
    activeIncome     = 0,
  } = assumptions;

  const price = property.price || 0;
  const downPayment = price * downPct / 100;
  const loanAmount = price - downPayment;
  const closingCosts = price * closingCostPct / 100;
  const totalInvested = downPayment + closingCosts + furnishingCost;

  const r = avgRate / 100 / 12;
  const n = 360;
  const monthlyPI = r === 0 ? loanAmount / n : loanAmount * (r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);

  const nightsBookedAnnual = Math.round(365 * occupancyPct / 100);
  const stays = avgStayDays > 0 ? Math.round(nightsBookedAnnual / avgStayDays) : 0;
  const lodgingRevenue = nightsBookedAnnual * nightlyRate;
  const cleaningRevenue = stays * cleaningPerStay;
  const grossRevenue = lodgingRevenue + cleaningRevenue;

  const mgmtFee = lodgingRevenue * mgmtPct / 100;
  const cleaningCost = stays * cleaningPerStay;
  const propertyTaxAnnual = price * taxRatePct / 100;
  const maintenance = lodgingRevenue * strMaintenancePct / 100;
  const totalOpEx = mgmtFee + cleaningCost + suppliesUtilitiesAnnual + strInsuranceAnnual + propertyTaxAnnual + maintenance;

  const noi = grossRevenue - totalOpEx;
  const debtServiceAnnual = monthlyPI * 12;
  const cashFlowAnnual = noi - debtServiceAnnual;

  const buildingBasis = price * (1 - landPct / 100);
  const accelDepreciation = buildingBasis * costSegBonusPct / 100;
  const taxShieldY1 = accelDepreciation * marginalTaxRatePct / 100;

  const cocPure = totalInvested > 0 ? (cashFlowAnnual / totalInvested) * 100 : 0;
  const cocWithShield = totalInvested > 0 ? ((cashFlowAnnual + taxShieldY1) / totalInvested) * 100 : 0;

  // Shelter coverage vs explicit active income target
  const incomeShielded = Math.min(accelDepreciation, Math.max(0, activeIncome));
  const shelterCoveragePct = activeIncome > 0 ? Math.min(100, (accelDepreciation / activeIncome) * 100) : null;
  const incomeRemaining = Math.max(0, activeIncome - incomeShielded);
  const propertiesNeededForFullShelter = activeIncome > 0 && accelDepreciation > 0
    ? Math.ceil(activeIncome / accelDepreciation)
    : null;

  const eligibility = [
    {
      label: 'Avg stay <= 7 days',
      pass: avgStayDays <= 7,
      detail: `${avgStayDays} days — ${avgStayDays <= 7 ? 'qualifies as non-rental activity' : 'falls back to passive — shield wasted against W-2/business income'}`,
    },
    {
      label: 'Material participation (>100 hrs)',
      pass: mgmtPct < 20,
      detail: mgmtPct < 20 ? 'self-management implied — track hours' : 'full property mgmt may forfeit non-passive status',
    },
    {
      label: 'No personal use > 14 days / 10%',
      pass: true,
      detail: 'manual: keep personal stays under threshold or it becomes a residence',
    },
  ];

  const allEligibilityPass = eligibility.every(e => e.pass);

  return {
    price,
    downPayment,
    loanAmount,
    closingCosts,
    furnishingCost,
    totalInvested,
    monthlyPI,
    nightsBookedAnnual,
    stays,
    lodgingRevenue,
    cleaningRevenue,
    grossRevenue,
    mgmtFee,
    cleaningCost,
    propertyTaxAnnual,
    maintenance,
    suppliesUtilitiesAnnual,
    strInsuranceAnnual,
    totalOpEx,
    noi,
    debtServiceAnnual,
    cashFlowAnnual,
    cashFlowMonthly: cashFlowAnnual / 12,
    capRate: price > 0 ? (noi / price) * 100 : 0,
    cocPure,
    cocWithShield,
    buildingBasis,
    accelDepreciation,
    taxShieldY1,
    eligibility,
    allEligibilityPass,
    activeIncome,
    incomeShielded,
    shelterCoveragePct,
    incomeRemaining,
    propertiesNeededForFullShelter,
    nightlyRate,
    occupancyPct,
    avgStayDays,
    marginalTaxRatePct,
    costSegBonusPct,
  };
}

// Back-compat default nightly rate, now powered by estimateADR so it respects bedrooms.
export function defaultNightlyRate(property, location) {
  return estimateADR(property, location);
}

// Y1 tax shield per dollar invested — used to rank properties across markets.
// Higher = more active-income shelter per $1 you put down, which is the alpha
// we're optimizing for.
export function shieldEfficiency(property, { costSegBonusPct = 28, landPct = 15, marginalTaxRatePct = 35, downPct = 25, closingCostPct = 3, furnishingCost = 25000 } = {}) {
  const price = property.price || 0;
  if (price <= 0) return 0;
  const buildingBasis = price * (1 - landPct / 100);
  const shield = buildingBasis * costSegBonusPct / 100 * marginalTaxRatePct / 100;
  const cashIn = price * downPct / 100 + price * closingCostPct / 100 + furnishingCost;
  return cashIn > 0 ? shield / cashIn : 0;
}
