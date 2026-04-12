"use strict";

const Charts = {
  // SVG donut chart
  donut(containerId, data, opts = {}) {
    const el = document.getElementById(containerId);
    if (!el) return;

    const { size = 180, thickness = 28 } = opts;
    const total = data.reduce((s, d) => s + d.value, 0);
    if (total === 0) { el.innerHTML = '<p style="color:var(--text-muted);font-size:0.85rem;">No data</p>'; return; }

    const cx = size / 2;
    const cy = size / 2;
    const r = (size - thickness) / 2;
    const circ = 2 * Math.PI * r;

    let offset = 0;
    const paths = data.map(d => {
      const pct = d.value / total;
      const dashLen = pct * circ;
      const dash = `${dashLen} ${circ - dashLen}`;
      const html = `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${UI.esc(d.color)}" stroke-width="${thickness}" stroke-dasharray="${dash}" stroke-dashoffset="${-offset}" stroke-linecap="butt" style="transition:stroke-dashoffset 0.6s ease"/>`;
      offset += dashLen;
      return html;
    });

    el.innerHTML = `
      <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" style="transform:rotate(-90deg)">
        ${paths.join('')}
      </svg>
    `;

    // Render legend
    const legendEl = document.getElementById(containerId.replace('donut', 'legend'));
    if (legendEl) {
      legendEl.innerHTML = data.map(d => `
        <div class="donut-legend-item">
          <span class="donut-legend-dot" style="background:${UI.esc(d.color)}"></span>
          <span>${UI.esc(d.label)}</span>
          <span class="donut-legend-count">${d.value}</span>
        </div>
      `).join('');
    }
  },

  // SVG bar chart (horizontal timeline)
  barChart(containerId, data, opts = {}) {
    const el = document.getElementById(containerId);
    if (!el) return;

    const { height = 200, barColor = '#ec6d8c' } = opts;
    const maxVal = Math.max(...data.map(d => d.value), 1);
    const barWidth = Math.floor(600 / data.length) - 8;
    const svgWidth = data.length * (barWidth + 8);

    const bars = data.map((d, i) => {
      const barH = (d.value / maxVal) * (height - 40);
      const x = i * (barWidth + 8) + 4;
      const y = height - barH - 24;
      return `
        <rect x="${x}" y="${y}" width="${barWidth}" height="${barH}" rx="4" fill="${barColor}" opacity="0.8">
          <title>${UI.esc(d.label)}: ${d.value}</title>
        </rect>
        <text x="${x + barWidth / 2}" y="${height - 6}" text-anchor="middle" fill="#5a5468" font-size="10" font-family="Outfit, sans-serif">${UI.esc(d.label)}</text>
        <text x="${x + barWidth / 2}" y="${y - 6}" text-anchor="middle" fill="#9a94a8" font-size="11" font-family="Share Tech Mono, monospace" font-weight="600">${d.value}</text>
      `;
    }).join('');

    el.innerHTML = `<svg width="100%" height="${height}" viewBox="0 0 ${svgWidth} ${height}" preserveAspectRatio="xMidYMid meet">${bars}</svg>`;
  },

  // SVG gauge (semicircle arc)
  gauge(svgId, value, max = 100) {
    const svg = document.getElementById(svgId);
    if (!svg) return;

    const pct = Math.max(0, Math.min(value / max, 1));
    const cx = 80, cy = 85, r = 65;
    const startAngle = Math.PI;
    const endAngle = startAngle + Math.PI * pct;

    const startX = cx + r * Math.cos(startAngle);
    const startY = cy + r * Math.sin(startAngle);
    const endX = cx + r * Math.cos(endAngle);
    const endY = cy + r * Math.sin(endAngle);
    const largeArc = pct > 0.5 ? 1 : 0;

    // Color based on score
    let color;
    if (value <= 10) color = '#10b981';
    else if (value <= 30) color = '#f59e0b';
    else if (value <= 60) color = '#f97316';
    else color = '#ef4444';

    svg.innerHTML = `
      <path d="M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}" fill="none" stroke="rgba(255,255,255,0.06)" stroke-width="10" stroke-linecap="round"/>
      <path d="M ${startX} ${startY} A ${r} ${r} 0 ${largeArc} 1 ${endX} ${endY}" fill="none" stroke="${color}" stroke-width="10" stroke-linecap="round" style="transition:all 0.6s ease"/>
    `;
  },
};
