"use strict";

const Explorer = {
  currentId: 'GDP',
  currentRange: '10Y',

  init() {
    this.populateSelect();
    this.bindEvents();
  },

  populateSelect() {
    const sel = document.getElementById('explorer-select');
    sel.innerHTML = Indicators.all().map(ind =>
      `<option value="${ind.id}">${UI.esc(ind.name)} (${UI.esc(ind.frequency)})</option>`
    ).join('');
    sel.value = this.currentId;
  },

  bindEvents() {
    document.getElementById('explorer-select').addEventListener('change', (e) => {
      const val = e.target.value;
      if (!Indicators.get(val)) return;
      this.currentId = val;
      this.load();
    });

    document.getElementById('explorer-range').addEventListener('click', (e) => {
      const pill = e.target.closest('.range-pill');
      if (!pill) return;
      const range = pill.dataset.range;
      if (!['1Y','5Y','10Y','20Y','MAX'].includes(range)) return;
      document.querySelectorAll('#explorer-range .range-pill').forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      this.currentRange = range;
      this.load();
    });
  },

  async load() {
    const indicator = Indicators.get(this.currentId);
    if (!indicator) return;

    // Show loading
    Charts.destroy('explorer-chart');
    document.getElementById('explorer-updated').textContent = 'Loading...';

    try {
      const data = await API.fetchRange(this.currentId, this.currentRange);

      if (!data || data.length === 0) {
        document.getElementById('explorer-updated').textContent = 'No data available for this range.';
        return;
      }

      Charts.timeSeries('explorer-chart', data, {
        label: indicator.name,
        unit: indicator.unit,
        color: Charts.colors.gold,
        showRecessions: true,
        fillGradient: true,
      });

      const latest = data[data.length - 1];
      document.getElementById('explorer-updated').textContent =
        `${data.length} observations | Latest: ${UI.formatValue(latest.value, indicator.unit)} (${UI.formatDate(latest.date)})`;
    } catch (err) {
      document.getElementById('explorer-updated').textContent = 'Error loading data. Try again.';
      console.error('Explorer load error:', err);
    }
  },
};
