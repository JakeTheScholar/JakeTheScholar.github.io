"use strict";

const Charts = {
  gauge(cushion, maxDrawdown, width) {
    width = width || '100%';
    const pct = Math.max(0, Math.min(100, (cushion / maxDrawdown) * 100));
    const color = UI.cushionColor(cushion);
    return '<div style="width:' + width + '">' +
      '<div style="display:flex;justify-content:space-between;font-size:11px;color:var(--text-muted);margin-bottom:6px">' +
        '<span>Drawdown Cushion</span>' +
        '<span style="color:' + color + ';font-weight:500">' + UI.currency(cushion) + ' / ' + UI.currency(maxDrawdown) + '</span>' +
      '</div>' +
      '<div style="height:6px;background:var(--deep);border-radius:3px;overflow:hidden">' +
        '<div class="gauge-fill" style="height:100%;width:' + pct + '%;border-radius:3px;background:' + color + ';box-shadow:0 0 8px ' + color + '40"></div>' +
      '</div>' +
    '</div>';
  },

  progressBar(current, target) {
    const pct = Math.max(0, Math.min(100, (current / target) * 100));
    return '<div>' +
      '<div style="display:flex;justify-content:space-between;font-size:11px;color:var(--text-muted);margin-bottom:6px">' +
        '<span>Profit Target</span>' +
        '<span style="font-weight:500">' + UI.currency(current) + ' / ' + UI.currency(target) + '</span>' +
      '</div>' +
      '<div style="height:6px;background:var(--deep);border-radius:3px;overflow:hidden">' +
        '<div class="progress-fill" style="height:100%;width:' + pct + '%;border-radius:3px;background:linear-gradient(90deg,var(--violet),var(--gold));box-shadow:0 0 10px rgba(201,169,110,0.3)"></div>' +
      '</div>' +
    '</div>';
  },

  equityCurve(data, options) {
    const w = options.width || 600;
    const h = options.height || 180;
    const pad = { top: 10, right: 10, bottom: 30, left: 55 };
    const plotW = w - pad.left - pad.right;
    const plotH = h - pad.top - pad.bottom;

    if (data.length < 2) {
      return '<div style="height:' + h + 'px;display:flex;align-items:center;justify-content:center;color:var(--text-muted);font-size:13px">Not enough data for chart</div>';
    }

    const balances = data.map(d => d.balance);
    const floors = options.showFloor ? data.map(d => d.floor) : [];
    const allVals = balances.concat(floors);
    const minVal = Math.min(...allVals);
    const maxVal = Math.max(...allVals);
    const range = maxVal - minVal || 1;

    function x(i) { return pad.left + (i / (data.length - 1)) * plotW; }
    function y(val) { return pad.top + plotH - ((val - minVal) / range) * plotH; }

    const balancePath = data.map((d, i) => (i === 0 ? 'M' : 'L') + x(i).toFixed(1) + ',' + y(d.balance).toFixed(1)).join(' ');
    const fillPath = balancePath + ' L' + x(data.length - 1).toFixed(1) + ',' + (pad.top + plotH) + ' L' + pad.left + ',' + (pad.top + plotH) + ' Z';

    let floorPath = '';
    if (options.showFloor && data[0].floor !== undefined) {
      floorPath = data.map((d, i) => (i === 0 ? 'M' : 'L') + x(i).toFixed(1) + ',' + y(d.floor).toFixed(1)).join(' ');
    }

    const gridLines = [0.25, 0.5, 0.75].map(pct => {
      const val = minVal + range * (1 - pct);
      const yPos = pad.top + plotH * pct;
      return '<line x1="' + pad.left + '" y1="' + yPos.toFixed(1) + '" x2="' + (w - pad.right) + '" y2="' + yPos.toFixed(1) + '" stroke="rgba(255,255,255,0.03)"/>' +
        '<text x="' + (pad.left - 5) + '" y="' + (yPos + 3).toFixed(1) + '" text-anchor="end" font-size="9" fill="#5a5468" font-family="Outfit">' + UI.currency(val) + '</text>';
    }).join('');

    const xLabels = '<text x="' + pad.left + '" y="' + (h - 5) + '" font-size="10" fill="#5a5468" font-family="Outfit">' + UI.formatDate(data[0].date || '') + '</text>' +
      '<text x="' + (w - pad.right) + '" y="' + (h - 5) + '" text-anchor="end" font-size="10" fill="#5a5468" font-family="Outfit">' + UI.formatDate(data[data.length - 1].date || '') + '</text>';

    let svg = '<svg viewBox="0 0 ' + w + ' ' + h + '" style="width:100%;height:' + h + 'px">';
    svg += '<defs><linearGradient id="eq-grad-' + data.length + '" x1="0" y1="0" x2="0" y2="1">';
    svg += '<stop offset="0%" stop-color="rgba(201,169,110,0.25)"/><stop offset="100%" stop-color="rgba(201,169,110,0)"/>';
    svg += '</linearGradient></defs>';
    svg += gridLines;
    svg += '<path d="' + fillPath + '" fill="url(#eq-grad-' + data.length + ')"/>';
    svg += '<path d="' + balancePath + '" fill="none" stroke="var(--gold)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>';

    if (floorPath) {
      svg += '<path d="' + floorPath + '" fill="none" stroke="var(--red)" stroke-width="1" stroke-dasharray="4,4" opacity="0.4"/>';
    }

    data.forEach((d, i) => {
      if (data.length <= 30 || i === 0 || i === data.length - 1) {
        svg += '<circle cx="' + x(i).toFixed(1) + '" cy="' + y(d.balance).toFixed(1) + '" r="3" fill="var(--void)" stroke="var(--gold)" stroke-width="1.5"/>';
      }
    });

    svg += xLabels;
    svg += '</svg>';
    return svg;
  },

  barChart(data, options) {
    const w = options.width || 600;
    const h = options.height || 160;
    const pad = { top: 15, right: 10, bottom: 25, left: 55 };
    const plotW = w - pad.left - pad.right;
    const plotH = h - pad.top - pad.bottom;

    if (data.length === 0) {
      return '<div style="height:' + h + 'px;display:flex;align-items:center;justify-content:center;color:var(--text-muted);font-size:13px">No trades in this period</div>';
    }

    const pnls = data.map(d => d.pnl);
    const maxPnl = Math.max(...pnls, 0);
    const minPnl = Math.min(...pnls, 0);
    const pnlRange = maxPnl - minPnl || 1;

    const barW = Math.max(4, Math.min(40, (plotW / data.length) * 0.7));
    const gap = (plotW - barW * data.length) / (data.length + 1);
    const zeroY = pad.top + (maxPnl / pnlRange) * plotH;

    function barX(i) { return pad.left + gap + i * (barW + gap); }
    function barY(val) { return pad.top + ((maxPnl - val) / pnlRange) * plotH; }

    let svg = '<svg viewBox="0 0 ' + w + ' ' + h + '" style="width:100%;height:' + h + 'px">';

    svg += '<line x1="' + pad.left + '" y1="' + zeroY.toFixed(1) + '" x2="' + (w - pad.right) + '" y2="' + zeroY.toFixed(1) + '" stroke="rgba(255,255,255,0.06)"/>';

    data.forEach((d, i) => {
      const bx = barX(i);
      const color = d.pnl >= 0 ? 'var(--green)' : 'var(--red)';
      const top = d.pnl >= 0 ? barY(d.pnl) : zeroY;
      const barH = Math.abs(barY(d.pnl) - zeroY);
      svg += '<rect x="' + bx.toFixed(1) + '" y="' + top.toFixed(1) + '" width="' + barW.toFixed(1) + '" height="' + Math.max(1, barH).toFixed(1) + '" rx="2" fill="' + color + '" opacity="0.6"/>';
    });

    if (options.showLine && data[0].balance !== undefined) {
      const balances = data.map(d => d.balance);
      const allVals = pnls.concat(balances);
      const maxAll = Math.max(...allVals, 0);
      const minAll = Math.min(...allVals, 0);
      const allRange = maxAll - minAll || 1;

      function ly(val) { return pad.top + ((maxAll - val) / allRange) * plotH; }

      const linePath = data.map((d, i) => {
        const cx = barX(i) + barW / 2;
        return (i === 0 ? 'M' : 'L') + cx.toFixed(1) + ',' + ly(d.balance).toFixed(1);
      }).join(' ');

      const fillEnd = barX(data.length - 1) + barW / 2;
      const fillStart = barX(0) + barW / 2;
      const fillPath = linePath + ' L' + fillEnd.toFixed(1) + ',' + (pad.top + plotH) + ' L' + fillStart.toFixed(1) + ',' + (pad.top + plotH) + ' Z';

      svg += '<defs><linearGradient id="bar-line-grad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="rgba(201,169,110,0.2)"/><stop offset="100%" stop-color="rgba(201,169,110,0)"/></linearGradient></defs>';
      svg += '<path d="' + fillPath + '" fill="url(#bar-line-grad)"/>';
      svg += '<path d="' + linePath + '" fill="none" stroke="var(--gold)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>';

      data.forEach((d, i) => {
        if (data.length <= 15 || i === 0 || i === data.length - 1) {
          const cx = barX(i) + barW / 2;
          svg += '<circle cx="' + cx.toFixed(1) + '" cy="' + ly(d.balance).toFixed(1) + '" r="3" fill="var(--void)" stroke="var(--gold)" stroke-width="1.5"/>';
        }
      });
    }

    if (data.length > 0) {
      svg += '<text x="' + barX(0).toFixed(1) + '" y="' + (h - 4) + '" font-size="10" fill="#5a5468" font-family="Outfit">' + UI.formatDate(data[0].date) + '</text>';
      if (data.length > 1) {
        svg += '<text x="' + (barX(data.length - 1) + barW).toFixed(1) + '" y="' + (h - 4) + '" text-anchor="end" font-size="10" fill="#5a5468" font-family="Outfit">' + UI.formatDate(data[data.length - 1].date) + '</text>';
      }
    }

    svg += '</svg>';
    return svg;
  },
};
