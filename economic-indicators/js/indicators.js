"use strict";

const Indicators = {
  registry: {
    GDP: {
      name: 'Real GDP',
      fred: 'GDP',
      unit: '$B',
      frequency: 'Quarterly',
      description: 'Gross Domestic Product, seasonally adjusted annual rate',
      category: 'output',
      inverted: false,
    },
    UNRATE: {
      name: 'Unemployment Rate',
      fred: 'UNRATE',
      unit: '%',
      frequency: 'Monthly',
      description: 'Civilian unemployment rate, seasonally adjusted',
      category: 'labor',
      inverted: true, // higher = worse
    },
    CPIAUCSL: {
      name: 'CPI (All Urban)',
      fred: 'CPIAUCSL',
      unit: 'index',
      frequency: 'Monthly',
      description: 'Consumer Price Index for All Urban Consumers, seasonally adjusted',
      category: 'prices',
      inverted: false,
    },
    FEDFUNDS: {
      name: 'Fed Funds Rate',
      fred: 'FEDFUNDS',
      unit: '%',
      frequency: 'Monthly',
      description: 'Effective Federal Funds Rate',
      category: 'rates',
      inverted: false,
    },
    DGS10: {
      name: '10-Year Treasury',
      fred: 'DGS10',
      unit: '%',
      frequency: 'Daily',
      description: '10-Year Treasury Constant Maturity Rate',
      category: 'rates',
      inverted: false,
    },
    SP500: {
      name: 'S&P 500',
      fred: 'SP500',
      unit: 'index',
      frequency: 'Daily',
      description: 'S&P 500 Index',
      category: 'markets',
      inverted: false,
    },
    UMCSENT: {
      name: 'Consumer Sentiment',
      fred: 'UMCSENT',
      unit: 'index',
      frequency: 'Monthly',
      description: 'University of Michigan Consumer Sentiment Index',
      category: 'confidence',
      inverted: false,
    },
    T10Y2Y: {
      name: 'Yield Curve (10Y-2Y)',
      fred: 'T10Y2Y',
      unit: '%',
      frequency: 'Daily',
      description: '10-Year minus 2-Year Treasury spread — negative values signal recession risk',
      category: 'rates',
      inverted: false,
    },
    HOUST: {
      name: 'Housing Starts',
      fred: 'HOUST',
      unit: 'K',
      frequency: 'Monthly',
      description: 'New privately-owned housing units started, thousands, seasonally adjusted',
      category: 'housing',
      inverted: false,
    },
    ICSA: {
      name: 'Initial Claims',
      fred: 'ICSA',
      unit: 'K',
      frequency: 'Weekly',
      description: 'Initial claims for unemployment insurance, seasonally adjusted',
      category: 'labor',
      inverted: true, // higher = worse
    },
  },

  // Order for dashboard display
  displayOrder: ['GDP', 'UNRATE', 'CPIAUCSL', 'FEDFUNDS', 'DGS10', 'SP500', 'UMCSENT', 'T10Y2Y', 'HOUST', 'ICSA'],

  // Leading indicators for composite
  leadingComponents: [
    { id: 'T10Y2Y', name: 'Yield Curve Spread', weight: 0.25 },
    { id: 'UMCSENT', name: 'Consumer Sentiment', weight: 0.15 },
    { id: 'HOUST', name: 'Housing Starts', weight: 0.15 },
    { id: 'ICSA', name: 'Initial Claims', weight: 0.20 },
    { id: 'SP500', name: 'S&P 500', weight: 0.15 },
    { id: 'UNRATE', name: 'Unemployment Rate', weight: 0.10 },
  ],

  // Preset correlation pairs
  correlationPresets: [
    { a: 'UNRATE', b: 'GDP', label: 'Unemployment vs GDP' },
    { a: 'FEDFUNDS', b: 'DGS10', label: 'Fed Rate vs 10Y Treasury' },
    { a: 'CPIAUCSL', b: 'FEDFUNDS', label: 'CPI vs Fed Rate' },
    { a: 'T10Y2Y', b: 'UNRATE', label: 'Yield Curve vs Unemployment' },
    { a: 'HOUST', b: 'FEDFUNDS', label: 'Housing vs Fed Rate' },
    { a: 'SP500', b: 'UMCSENT', label: 'S&P 500 vs Sentiment' },
  ],

  // NBER recession dates for shading
  recessions: [
    { start: '1969-12-01', end: '1970-11-01' },
    { start: '1973-11-01', end: '1975-03-01' },
    { start: '1980-01-01', end: '1980-07-01' },
    { start: '1981-07-01', end: '1982-11-01' },
    { start: '1990-07-01', end: '1991-03-01' },
    { start: '2001-03-01', end: '2001-11-01' },
    { start: '2007-12-01', end: '2009-06-01' },
    { start: '2020-02-01', end: '2020-04-01' },
  ],

  get(id) {
    return this.registry[id] || null;
  },

  all() {
    return this.displayOrder.map(id => ({ id, ...this.registry[id] }));
  },
};
