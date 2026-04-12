"use strict";

const Settings = {
  render(el) {
    let html = '';

    // Export
    html += '<div class="panel" style="padding:24px;margin-bottom:16px">';
    html += '<div style="font-size:15px;font-weight:600;margin-bottom:8px">Export Data</div>';
    html += '<p style="font-size:13px;color:var(--text-secondary);margin-bottom:16px">Download all accounts, journal entries, and payouts as a JSON file for backup.</p>';
    html += '<button class="btn btn-primary btn-sm" onclick="App.exportAll()">Download JSON Backup</button>';
    html += '</div>';

    // Import from TCC v1
    html += '<div class="panel" style="padding:24px;margin-bottom:16px">';
    html += '<div style="font-size:15px;font-weight:600;margin-bottom:8px">Import from TCC v1</div>';
    html += '<p style="font-size:13px;color:var(--text-secondary);margin-bottom:16px">Import accounts and trades from a Trading Command Center v1 JSON export. Existing data will not be overwritten.</p>';
    html += '<label class="btn btn-ghost btn-sm" style="display:inline-flex;cursor:pointer">Choose JSON File <input type="file" accept=".json" style="display:none" onchange="App.importTCCv1(event)"></label>';
    html += '</div>';

    // Firm Rules Reference
    html += '<div class="panel" style="padding:24px">';
    html += '<div style="font-size:15px;font-weight:600;margin-bottom:16px">Firm Rules Reference</div>';

    Object.keys(Rules.PRESETS).forEach(key => {
      const p = Rules.PRESETS[key];
      html += '<div style="background:var(--deep);border-radius:8px;padding:16px;margin-bottom:12px">';
      html += '<div style="font-weight:600;margin-bottom:8px">' + UI.esc(p.name) + '</div>';
      html += '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:8px;font-size:13px">';
      html += '<div><span style="color:var(--text-muted)">Starting Balance:</span> ' + UI.currency(p.startingBalance) + '</div>';
      if (p.profitTarget) html += '<div><span style="color:var(--text-muted)">Profit Target:</span> ' + UI.currency(p.profitTarget) + '</div>';
      html += '<div><span style="color:var(--text-muted)">Trailing Drawdown:</span> ' + UI.currency(p.trailingDrawdown) + '</div>';
      html += '<div><span style="color:var(--text-muted)">Daily Loss Limit:</span> ' + (p.dailyLossLimit ? UI.currency(p.dailyLossLimit) : 'None') + '</div>';
      html += '<div><span style="color:var(--text-muted)">Consistency Rule:</span> ' + (p.consistencyPct ? 'Best day < ' + (p.consistencyPct * 100) + '% of total' : 'None') + '</div>';
      html += '<div><span style="color:var(--text-muted)">Min Trading Days:</span> ' + (p.minTradingDays || 'None') + '</div>';
      html += '<div><span style="color:var(--text-muted)">DD Stops at Target:</span> ' + (p.drawdownStopsAtTarget ? 'Yes' : 'No') + '</div>';
      html += '</div></div>';
    });

    html += '</div>';

    el.innerHTML = html;
  },
};
