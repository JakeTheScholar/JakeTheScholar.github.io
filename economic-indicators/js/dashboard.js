"use strict";

const Dashboard = {
  sparkCharts: {},

  async init() {
    this.renderSkeletons();
    await this.loadData();
  },

  renderSkeletons() {
    const grid = document.getElementById('stats-grid');
    grid.innerHTML = Indicators.displayOrder.map(id => {
      const ind = Indicators.get(id);
      return `
        <div class="stat-card" data-indicator="${id}">
          <div class="stat-card-header">
            <span class="stat-label">${UI.esc(ind.name)}</span>
            <span class="stat-freq">${UI.esc(ind.frequency)}</span>
          </div>
          <div class="skeleton skeleton-value"></div>
          <div class="skeleton skeleton-change"></div>
          <div class="skeleton skeleton-spark"></div>
        </div>
      `;
    }).join('');

    // Wire click handlers
    grid.querySelectorAll('.stat-card').forEach(card => {
      card.addEventListener('click', () => {
        const id = card.dataset.indicator;
        App.navigate('explorer');
        const sel = document.getElementById('explorer-select');
        if (sel) {
          sel.value = id;
          sel.dispatchEvent(new Event('change'));
        }
      });
    });
  },

  async loadData() {
    try {
      // Fetch latest values and sparkline data in parallel
      const [latestMap, sparkMap] = await Promise.all([
        API.fetchAllLatest(),
        this._fetchAllSparklines(),
      ]);

      this.renderCards(latestMap, sparkMap);
      document.getElementById('dashboard-updated').textContent =
        'Last updated: ' + new Date().toLocaleTimeString();
    } catch (err) {
      console.error('Dashboard load error:', err);
      document.getElementById('error-banner').style.display = 'block';
      document.getElementById('error-banner').textContent =
        'Failed to load indicator data. FRED API may be temporarily unavailable.';
    }
  },

  async _fetchAllSparklines() {
    const results = {};
    const promises = Indicators.displayOrder.map(async (id) => {
      try {
        results[id] = await API.fetchSparkline(id);
      } catch {
        results[id] = null;
      }
    });
    await Promise.all(promises);
    return results;
  },

  renderCards(latestMap, sparkMap) {
    Indicators.displayOrder.forEach(id => {
      const ind = Indicators.get(id);
      const card = document.querySelector(`.stat-card[data-indicator="${id}"]`);
      if (!card) return;

      const obs = latestMap[id];
      if (!obs || obs.length === 0) {
        card.querySelector('.skeleton-value').textContent = '--';
        return;
      }

      const current = obs[obs.length - 1];
      const previous = obs.length > 1 ? obs[obs.length - 2] : null;

      const changeVal = previous ? current.value - previous.value : null;
      const changePct = previous && previous.value !== 0
        ? ((current.value - previous.value) / Math.abs(previous.value)) * 100
        : null;

      const cls = changeVal != null
        ? (ind.inverted ? (changeVal > 0 ? 'negative' : changeVal < 0 ? 'positive' : 'neutral') : UI.changeClass(current.value, previous?.value))
        : 'neutral';

      const arrow = changeVal != null
        ? (changeVal > 0 ? '\u25B2' : changeVal < 0 ? '\u25BC' : '')
        : '';

      card.innerHTML = `
        <div class="stat-card-header">
          <span class="stat-label">${UI.esc(ind.name)}</span>
          <span class="stat-freq">${UI.esc(ind.frequency)}</span>
        </div>
        <div class="stat-value">${UI.formatValue(current.value, ind.unit)}</div>
        <div class="stat-change ${cls}">
          <span class="stat-arrow">${arrow}</span>
          ${changePct != null ? UI.pct(Math.abs(changePct)) : ''}
          ${changeVal != null ? '(' + (changeVal >= 0 ? '+' : '') + UI.num(changeVal, 2) + ')' : ''}
        </div>
        <div class="stat-sparkline"><canvas id="spark-${id}"></canvas></div>
        <div class="stat-date">${UI.formatDate(current.date)}</div>
      `;

      // Render sparkline
      const sparkData = sparkMap[id];
      if (sparkData && sparkData.length > 2) {
        const canvas = document.getElementById(`spark-${id}`);
        if (canvas) {
          const sparkColor = cls === 'positive' ? Charts.colors.emerald
            : cls === 'negative' ? Charts.colors.rose
            : Charts.colors.gold;
          if (this.sparkCharts[id]) this.sparkCharts[id].destroy();
          this.sparkCharts[id] = Charts.sparkline(canvas, sparkData, sparkColor);
        }
      }
    });
  },
};
