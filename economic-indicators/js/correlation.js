"use strict";

const Correlation = {
  currentA: 'UNRATE',
  currentB: 'GDP',
  currentRange: '10Y',

  init() {
    this.populateSelects();
    this.renderPresets();
    this.bindEvents();
  },

  populateSelects() {
    const html = Indicators.all().map(ind =>
      `<option value="${ind.id}">${UI.esc(ind.name)}</option>`
    ).join('');
    document.getElementById('corr-select-a').innerHTML = html;
    document.getElementById('corr-select-b').innerHTML = html;
    document.getElementById('corr-select-a').value = this.currentA;
    document.getElementById('corr-select-b').value = this.currentB;
  },

  renderPresets() {
    const container = document.getElementById('corr-presets');
    container.innerHTML = Indicators.correlationPresets.map((p, i) =>
      `<button class="preset-chip${i === 0 ? ' active' : ''}" data-a="${p.a}" data-b="${p.b}">${UI.esc(p.label)}</button>`
    ).join('');
  },

  bindEvents() {
    const selA = document.getElementById('corr-select-a');
    const selB = document.getElementById('corr-select-b');

    selA.addEventListener('change', () => {
      if (!Indicators.get(selA.value)) return;
      this.currentA = selA.value;
      this._clearPresetActive();
      this.load();
    });

    selB.addEventListener('change', () => {
      if (!Indicators.get(selB.value)) return;
      this.currentB = selB.value;
      this._clearPresetActive();
      this.load();
    });

    document.getElementById('corr-presets').addEventListener('click', (e) => {
      const chip = e.target.closest('.preset-chip');
      if (!chip) return;
      document.querySelectorAll('#corr-presets .preset-chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      const a = chip.dataset.a;
      const b = chip.dataset.b;
      if (!Indicators.get(a) || !Indicators.get(b)) return;
      this.currentA = a;
      this.currentB = b;
      selA.value = this.currentA;
      selB.value = this.currentB;
      this.load();
    });

    document.getElementById('corr-range').addEventListener('click', (e) => {
      const pill = e.target.closest('.range-pill');
      if (!pill) return;
      const range = pill.dataset.range;
      if (!['5Y','10Y','20Y','MAX'].includes(range)) return;
      document.querySelectorAll('#corr-range .range-pill').forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      this.currentRange = range;
      this.load();
    });
  },

  _clearPresetActive() {
    document.querySelectorAll('#corr-presets .preset-chip').forEach(c => c.classList.remove('active'));
  },

  async load() {
    const indA = Indicators.get(this.currentA);
    const indB = Indicators.get(this.currentB);
    if (!indA || !indB) return;

    document.getElementById('corr-stat-box').style.display = 'none';
    Charts.destroy('corr-chart');

    try {
      const [dataA, dataB] = await Promise.all([
        API.fetchRange(this.currentA, this.currentRange),
        API.fetchRange(this.currentB, this.currentRange),
      ]);

      if (!dataA?.length || !dataB?.length) return;

      const result = Charts.dualAxis('corr-chart', dataA, dataB,
        { label: indA.name, unit: indA.unit },
        { label: indB.name, unit: indB.unit },
      );

      if (result && result.valuesA.length > 2) {
        const r = this._pearson(result.valuesA, result.valuesB);
        this._renderCorrelation(r);
      }
    } catch (err) {
      console.error('Correlation load error:', err);
    }
  },

  _pearson(x, y) {
    const n = Math.min(x.length, y.length);
    if (n < 3) return null;
    const xArr = x.slice(0, n).filter((_, i) => x[i] != null && y[i] != null);
    const yArr = y.slice(0, n).filter((_, i) => x[i] != null && y[i] != null);
    const len = xArr.length;
    if (len < 3) return null;

    const meanX = xArr.reduce((s, v) => s + v, 0) / len;
    const meanY = yArr.reduce((s, v) => s + v, 0) / len;

    let sumXY = 0, sumX2 = 0, sumY2 = 0;
    for (let i = 0; i < len; i++) {
      const dx = xArr[i] - meanX;
      const dy = yArr[i] - meanY;
      sumXY += dx * dy;
      sumX2 += dx * dx;
      sumY2 += dy * dy;
    }

    const denom = Math.sqrt(sumX2 * sumY2);
    return denom === 0 ? 0 : sumXY / denom;
  },

  _renderCorrelation(r) {
    if (r == null) return;
    const box = document.getElementById('corr-stat-box');
    const rEl = document.getElementById('corr-r-value');
    const descEl = document.getElementById('corr-r-desc');

    box.style.display = 'inline-flex';
    rEl.textContent = r.toFixed(3);

    const abs = Math.abs(r);
    if (abs >= 0.8) {
      rEl.style.color = r > 0 ? Charts.colors.emerald : Charts.colors.rose;
      descEl.textContent = r > 0 ? 'Strong positive correlation' : 'Strong negative correlation';
    } else if (abs >= 0.5) {
      rEl.style.color = Charts.colors.amber;
      descEl.textContent = r > 0 ? 'Moderate positive correlation' : 'Moderate negative correlation';
    } else if (abs >= 0.3) {
      rEl.style.color = Charts.colors.textSecondary;
      descEl.textContent = r > 0 ? 'Weak positive correlation' : 'Weak negative correlation';
    } else {
      rEl.style.color = Charts.colors.textMuted;
      descEl.textContent = 'No meaningful correlation';
    }
  },
};
