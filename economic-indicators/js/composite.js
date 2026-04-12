"use strict";

const Composite = {
  async init() {
    // Nothing to bind - load on view activation
  },

  async load() {
    const components = Indicators.leadingComponents;

    try {
      // Fetch 10 years of data for each component
      const dataMap = {};
      await Promise.all(components.map(async (comp) => {
        try {
          dataMap[comp.id] = await API.fetchRange(comp.id, '10Y');
        } catch {
          dataMap[comp.id] = null;
        }
      }));

      // Build composite index
      const composite = this._buildComposite(dataMap, components);
      if (!composite || composite.series.length === 0) return;

      // Render chart
      Charts.timeSeries('composite-chart', composite.series, {
        label: 'Leading Composite Index',
        unit: 'index',
        color: Charts.colors.gold,
        showRecessions: true,
        fillGradient: true,
      });

      // Render recession probability
      this._renderProbability(composite.probability);

      // Render component signals
      this._renderComponents(composite.signals);

    } catch (err) {
      console.error('Composite load error:', err);
    }
  },

  _buildComposite(dataMap, components) {
    // Find common date range (monthly granularity)
    const allDates = new Set();
    const dataMaps = {};

    components.forEach(comp => {
      const data = dataMap[comp.id];
      if (!data) return;
      dataMaps[comp.id] = {};
      // Aggregate to monthly: take last observation per month
      const byMonth = {};
      data.forEach(d => {
        const month = d.date.slice(0, 7); // YYYY-MM
        byMonth[month] = d.value;
      });
      Object.keys(byMonth).forEach(m => {
        dataMaps[comp.id][m] = byMonth[m];
        allDates.add(m);
      });
    });

    const sortedMonths = [...allDates].sort();
    if (sortedMonths.length < 12) return null;

    // For each component, normalize using z-score over full history
    const normalized = {};
    components.forEach(comp => {
      const map = dataMaps[comp.id];
      if (!map) return;
      const values = sortedMonths.map(m => map[m]).filter(v => v != null);
      if (values.length < 12) return;

      const mean = values.reduce((s, v) => s + v, 0) / values.length;
      const std = Math.sqrt(values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length) || 1;

      normalized[comp.id] = {};
      sortedMonths.forEach(m => {
        if (map[m] != null) {
          let z = (map[m] - mean) / std;
          // Invert if higher = worse (unemployment, initial claims)
          const ind = Indicators.get(comp.id);
          if (ind && ind.inverted) z = -z;
          normalized[comp.id][m] = z;
        }
      });
    });

    // Build weighted composite
    const series = [];
    sortedMonths.forEach(month => {
      let weightedSum = 0;
      let totalWeight = 0;

      components.forEach(comp => {
        if (normalized[comp.id] && normalized[comp.id][month] != null) {
          weightedSum += normalized[comp.id][month] * comp.weight;
          totalWeight += comp.weight;
        }
      });

      if (totalWeight > 0) {
        // Rescale to 0-100 index (50 = neutral, >50 = expansion, <50 = contraction)
        const raw = weightedSum / totalWeight;
        const indexValue = 50 + (raw * 15); // Scale z-scores to readable range
        series.push({
          date: month + '-01',
          value: Math.max(0, Math.min(100, indexValue)),
        });
      }
    });

    // Calculate recession probability from recent values
    const recent = series.slice(-6);
    const avgRecent = recent.reduce((s, d) => s + d.value, 0) / recent.length;
    const trend = recent.length > 1 ? recent[recent.length - 1].value - recent[0].value : 0;

    // Simple probability model: below 40 = high risk, 40-50 = moderate, >50 = low
    let probability;
    if (avgRecent < 35) probability = Math.min(85, 90 - avgRecent);
    else if (avgRecent < 45) probability = Math.max(20, 60 - avgRecent);
    else probability = Math.max(5, 35 - (avgRecent - 45) * 0.8);

    // Adjust for trend
    if (trend < -5) probability = Math.min(90, probability + 10);
    else if (trend > 5) probability = Math.max(5, probability - 10);

    probability = Math.round(probability);

    // Component signals
    const signals = components.map(comp => {
      const norm = normalized[comp.id];
      if (!norm) return { id: comp.id, name: comp.name, signal: 'neutral' };
      const recentMonths = sortedMonths.slice(-3);
      const recentVals = recentMonths.map(m => norm[m]).filter(v => v != null);
      const avg = recentVals.length > 0 ? recentVals.reduce((s, v) => s + v, 0) / recentVals.length : 0;
      return {
        id: comp.id,
        name: comp.name,
        signal: avg > 0.3 ? 'bullish' : avg < -0.3 ? 'bearish' : 'neutral',
      };
    });

    return { series, probability, signals };
  },

  _renderProbability(prob) {
    const el = document.getElementById('recession-value');
    const desc = document.getElementById('recession-desc');

    el.textContent = prob + '%';
    el.className = 'recession-prob-value';

    if (prob <= 25) {
      el.classList.add('low');
      desc.textContent = 'Economic expansion likely continues';
    } else if (prob <= 50) {
      el.classList.add('moderate');
      desc.textContent = 'Mixed signals — monitor closely';
    } else {
      el.classList.add('high');
      desc.textContent = 'Elevated recession risk — leading indicators deteriorating';
    }
  },

  _renderComponents(signals) {
    const list = document.getElementById('component-list');
    list.innerHTML = signals.map(s => `
      <div class="component-item">
        <span class="component-name">${UI.esc(s.name)}</span>
        <span class="component-signal ${s.signal}">${s.signal}</span>
      </div>
    `).join('');
  },
};
