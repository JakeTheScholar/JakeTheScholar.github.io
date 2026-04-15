"use strict";

const Charts = {
  // Design system colors for Chart.js
  colors: {
    gold: '#c9a96e',
    goldBright: '#e4c87e',
    goldFade: 'rgba(201,169,110,0.15)',
    violet: '#8b5cf6',
    violetFade: 'rgba(139,92,246,0.15)',
    rose: '#ec6d8c',
    emerald: '#10b981',
    amber: '#f59e0b',
    text: '#ede8e0',
    textSecondary: '#9a94a8',
    textMuted: '#5a5468',
    gridColor: 'rgba(255,255,255,0.04)',
    recessionBand: 'rgba(236,109,140,0.08)',
  },

  instances: {},

  destroy(id) {
    if (this.instances[id]) {
      this.instances[id].destroy();
      delete this.instances[id];
    }
  },

  _baseConfig() {
    return {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: 'index',
        intersect: false,
      },
      plugins: {
        legend: {
          display: false,
        },
        tooltip: {
          backgroundColor: 'rgba(22,20,31,0.95)',
          titleFont: { family: "'Outfit', system-ui, sans-serif", size: 12, weight: 400 },
          bodyFont: { family: "'Outfit', system-ui, sans-serif", size: 13, weight: 600 },
          titleColor: '#9a94a8',
          bodyColor: '#ede8e0',
          borderColor: 'rgba(255,255,255,0.08)',
          borderWidth: 1,
          padding: { x: 14, y: 10 },
          cornerRadius: 8,
          displayColors: true,
          boxWidth: 8,
          boxHeight: 8,
          boxPadding: 4,
        },
      },
      scales: {
        x: {
          grid: { color: this.colors.gridColor, drawBorder: false },
          ticks: {
            color: this.colors.textMuted,
            font: { family: "'Outfit', system-ui, sans-serif", size: 11 },
            maxTicksLimit: 10,
            maxRotation: 0,
          },
          border: { display: false },
        },
        y: {
          grid: { color: this.colors.gridColor, drawBorder: false },
          ticks: {
            color: this.colors.textMuted,
            font: { family: "'Outfit', system-ui, sans-serif", size: 11 },
            maxTicksLimit: 8,
          },
          border: { display: false },
        },
      },
    };
  },

  sparkline(canvasEl, data, color) {
    const ctx = canvasEl.getContext('2d');
    const values = data.map(d => d.value);
    const labels = data.map(d => d.date);
    const c = color || this.colors.gold;

    return new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [{
          data: values,
          borderColor: c,
          borderWidth: 1.5,
          pointRadius: 0,
          pointHitRadius: 0,
          tension: 0.4,
          fill: true,
          backgroundColor: c.replace(')', ',0.08)').replace('rgb', 'rgba'),
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false }, tooltip: { enabled: false } },
        scales: {
          x: { display: false },
          y: { display: false },
        },
        elements: { line: { borderWidth: 1.5 } },
        animation: { duration: 600, easing: 'easeOutQuart' },
      },
    });
  },

  timeSeries(canvasId, data, opts = {}) {
    this.destroy(canvasId);
    const canvas = document.getElementById(canvasId);
    if (!canvas) return null;
    const ctx = canvas.getContext('2d');

    const {
      label = 'Value',
      unit = '',
      color = this.colors.gold,
      showRecessions = true,
      fillGradient = true,
    } = opts;

    const labels = data.map(d => d.date);
    const values = data.map(d => d.value);

    // Build gradient fill
    let bgColor = 'transparent';
    if (fillGradient) {
      const r = parseInt(color.slice(1, 3), 16) || 201;
      const g = parseInt(color.slice(3, 5), 16) || 169;
      const b = parseInt(color.slice(5, 7), 16) || 110;
      const gradientFill = ctx.createLinearGradient(0, 0, 0, canvas.parentElement.offsetHeight || 400);
      gradientFill.addColorStop(0, `rgba(${r},${g},${b},0.2)`);
      gradientFill.addColorStop(1, `rgba(${r},${g},${b},0.0)`);
      bgColor = gradientFill;
    }

    // Recession band annotations
    const annotations = {};
    if (showRecessions) {
      Indicators.recessions.forEach((rec, i) => {
        annotations['rec' + i] = {
          type: 'box',
          xMin: rec.start,
          xMax: rec.end,
          backgroundColor: this.colors.recessionBand,
          borderWidth: 0,
          label: {
            display: false,
          },
        };
      });
    }

    const config = this._baseConfig();
    config.plugins.tooltip.callbacks = {
      title: (items) => UI.formatDate(items[0].label),
      label: (item) => `${label}: ${UI.formatValue(item.raw, unit)}`,
    };

    this.instances[canvasId] = new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [{
          label,
          data: values,
          borderColor: color,
          borderWidth: 2,
          pointRadius: 0,
          pointHoverRadius: 4,
          pointHoverBackgroundColor: color,
          pointHoverBorderColor: '#fff',
          pointHoverBorderWidth: 2,
          tension: 0.2,
          fill: true,
          backgroundColor: bgColor,
        }],
      },
      options: {
        ...config,
        plugins: {
          ...config.plugins,
          annotation: Object.keys(annotations).length > 0 ? { annotations } : undefined,
        },
        scales: {
          ...config.scales,
          x: {
            ...config.scales.x,
            type: 'category',
          },
        },
        animation: { duration: 800, easing: 'easeOutQuart' },
      },
    });

    return this.instances[canvasId];
  },

  dualAxis(canvasId, dataA, dataB, optsA = {}, optsB = {}) {
    this.destroy(canvasId);
    const canvas = document.getElementById(canvasId);
    if (!canvas) return null;
    const ctx = canvas.getContext('2d');

    // Align the two datasets to common dates
    const dateSetA = new Set(dataA.map(d => d.date));
    const dateSetB = new Set(dataB.map(d => d.date));
    const commonDates = [...dateSetA].filter(d => dateSetB.has(d)).sort();

    const mapA = Object.fromEntries(dataA.map(d => [d.date, d.value]));
    const mapB = Object.fromEntries(dataB.map(d => [d.date, d.value]));

    const labels = commonDates;
    const valuesA = commonDates.map(d => mapA[d]);
    const valuesB = commonDates.map(d => mapB[d]);

    const config = this._baseConfig();
    config.plugins.tooltip.callbacks = {
      title: (items) => UI.formatDate(items[0].label),
      label: (item) => {
        const opt = item.datasetIndex === 0 ? optsA : optsB;
        return `${opt.label || 'Value'}: ${UI.formatValue(item.raw, opt.unit)}`;
      },
    };

    // Recession annotations
    const annotations = {};
    Indicators.recessions.forEach((rec, i) => {
      annotations['rec' + i] = {
        type: 'box',
        xMin: rec.start,
        xMax: rec.end,
        backgroundColor: this.colors.recessionBand,
        borderWidth: 0,
      };
    });

    this.instances[canvasId] = new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: optsA.label || 'A',
            data: valuesA,
            borderColor: this.colors.gold,
            borderWidth: 2,
            pointRadius: 0,
            pointHoverRadius: 4,
            tension: 0.2,
            yAxisID: 'yA',
          },
          {
            label: optsB.label || 'B',
            data: valuesB,
            borderColor: this.colors.violet,
            borderWidth: 2,
            pointRadius: 0,
            pointHoverRadius: 4,
            tension: 0.2,
            yAxisID: 'yB',
          },
        ],
      },
      options: {
        ...config,
        plugins: {
          ...config.plugins,
          legend: {
            display: true,
            position: 'top',
            align: 'end',
            labels: {
              color: this.colors.textSecondary,
              font: { family: "'Outfit', system-ui, sans-serif", size: 12 },
              boxWidth: 12,
              boxHeight: 2,
              padding: 16,
              usePointStyle: false,
            },
          },
          annotation: Object.keys(annotations).length > 0 ? { annotations } : undefined,
        },
        scales: {
          x: {
            ...config.scales.x,
            type: 'category',
          },
          yA: {
            position: 'left',
            grid: { color: this.colors.gridColor, drawBorder: false },
            ticks: {
              color: this.colors.gold,
              font: { family: "'Outfit', system-ui, sans-serif", size: 11 },
              maxTicksLimit: 8,
            },
            border: { display: false },
          },
          yB: {
            position: 'right',
            grid: { display: false },
            ticks: {
              color: this.colors.violet,
              font: { family: "'Outfit', system-ui, sans-serif", size: 11 },
              maxTicksLimit: 8,
            },
            border: { display: false },
          },
        },
        animation: { duration: 800, easing: 'easeOutQuart' },
      },
    });

    return { chart: this.instances[canvasId], valuesA, valuesB };
  },
};
