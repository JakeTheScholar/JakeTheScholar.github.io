"use strict";

const Settings = {
  render(el) {
    let html = '';

    // Email Sync
    html += '<div class="panel" style="padding:24px;margin-bottom:16px">';
    html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">';
    html += '<div style="font-size:15px;font-weight:600"><span style="color:var(--violet)">&#9889;</span> Bot Trade Sync</div>';
    html += '<div id="sync-status" style="font-size:12px;color:var(--text-muted)">Checking...</div>';
    html += '</div>';
    html += '<p style="font-size:13px;color:var(--text-secondary);margin-bottom:16px">Automatically import trades from TradingView email alerts into your journal. Requires the email monitor server running locally.</p>';

    html += '<div id="sync-body" style="margin-bottom:12px">';
    html += '<div style="font-size:12px;color:var(--text-muted)">Connecting to email monitor...</div>';
    html += '</div>';

    html += '<div style="display:flex;gap:8px;flex-wrap:wrap">';
    html += '<button class="btn btn-primary btn-sm" id="sync-btn" onclick="Settings.syncNow()" disabled>Sync Bot Trades</button>';
    html += '<button class="btn btn-ghost btn-sm" id="poll-btn" onclick="Settings.pollNow()" disabled>Check Email Now</button>';
    html += '</div>';
    html += '</div>';

    // Export
    html += '<div class="panel" style="padding:24px;margin-bottom:16px">';
    html += '<div style="font-size:15px;font-weight:600;margin-bottom:8px">Export Data</div>';
    html += '<p style="font-size:13px;color:var(--text-secondary);margin-bottom:16px">Download all accounts and journal entries as a JSON file for backup.</p>';
    html += '<button class="btn btn-primary btn-sm" onclick="App.exportAll()">Download JSON Backup</button>';
    html += '</div>';

    // Import
    html += '<div class="panel" style="padding:24px;margin-bottom:16px">';
    html += '<div style="font-size:15px;font-weight:600;margin-bottom:8px">Import Data</div>';
    html += '<p style="font-size:13px;color:var(--text-secondary);margin-bottom:16px">Restore from a previously exported JSON file. This will overwrite current data.</p>';
    html += '<label class="btn btn-ghost btn-sm" style="display:inline-flex;cursor:pointer">Choose JSON File <input type="file" accept=".json" style="display:none" onchange="App.importAll(event)"></label>';
    html += '</div>';

    // Reset
    html += '<div class="panel" style="padding:24px;margin-bottom:16px">';
    html += '<div style="font-size:15px;font-weight:600;margin-bottom:8px">Reset All Data</div>';
    html += '<p style="font-size:13px;color:var(--text-secondary);margin-bottom:16px">Permanently delete all accounts and journal entries. This cannot be undone.</p>';
    html += '<button class="btn btn-danger btn-sm" onclick="Settings.resetAll()">Reset Everything</button>';
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

    // Initialize email sync status (non-blocking)
    Settings.initSync();
  },

  resetAll() {
    if (confirm('Are you sure? This will permanently delete ALL accounts and trade journal entries.')) {
      if (confirm('Really? This cannot be undone. Export a backup first if unsure.')) {
        Object.keys(localStorage).filter(k => k.startsWith('tcc_')).forEach(k => localStorage.removeItem(k));
        App.navigate('dashboard');
      }
    }
  },

  // ── Email Sync ─────────────────────────────────────────
  async initSync() {
    const statusEl = document.getElementById('sync-status');
    const bodyEl = document.getElementById('sync-body');
    const syncBtn = document.getElementById('sync-btn');
    const pollBtn = document.getElementById('poll-btn');
    if (!statusEl) return;

    const status = await EmailSync.checkStatus();
    if (!status) {
      statusEl.innerHTML = '<span style="color:var(--red)">&#9679;</span> Offline';
      bodyEl.innerHTML = '<div style="font-size:12px;color:var(--text-muted)">Email monitor server not running.<br>Start it with: <code style="background:var(--deep);padding:2px 6px;border-radius:4px">cd server && python email_monitor.py</code></div>';
      return;
    }

    statusEl.innerHTML = '<span style="color:var(--green)">&#9679;</span> Connected';
    syncBtn.disabled = false;
    pollBtn.disabled = false;

    let info = '';
    info += '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:8px;font-size:13px">';
    info += '<div style="background:var(--deep);border-radius:8px;padding:10px 14px"><span style="color:var(--text-muted);font-size:11px;display:block">Total Signals</span><span style="font-weight:600">' + status.total_signals + '</span></div>';
    info += '<div style="background:var(--deep);border-radius:8px;padding:10px 14px"><span style="color:var(--text-muted);font-size:11px;display:block">Completed Trades</span><span style="font-weight:600">' + status.total_trades + '</span></div>';
    info += '<div style="background:var(--deep);border-radius:8px;padding:10px 14px"><span style="color:var(--text-muted);font-size:11px;display:block">Ready to Sync</span><span style="font-weight:600;color:' + (status.unsynced_trades > 0 ? 'var(--gold)' : 'var(--text)') + '">' + status.unsynced_trades + '</span></div>';
    info += '<div style="background:var(--deep);border-radius:8px;padding:10px 14px"><span style="color:var(--text-muted);font-size:11px;display:block">Last Signal</span><span style="font-weight:600;font-size:11px">' + (status.last_signal ? status.last_signal.slice(0, 16).replace('T', ' ') : 'None') + '</span></div>';
    info += '</div>';

    if (status.unsynced_trades > 0) {
      info += '<div style="margin-top:12px;font-size:13px">';
      info += '<div style="font-weight:500;margin-bottom:8px">Import ' + status.unsynced_trades + ' trade(s) to:</div>';
      const accounts = Store.getAccounts().filter(a => a.status === 'active' && a.tradedBy === 'bot');
      const allActive = Store.getAccounts().filter(a => a.status === 'active');
      const showAccounts = accounts.length > 0 ? accounts : allActive;
      info += '<div id="sync-accounts" style="display:flex;flex-wrap:wrap;gap:6px">';
      showAccounts.forEach(a => {
        info += '<label style="display:flex;align-items:center;gap:4px;cursor:pointer;font-size:12px;padding:4px 10px;border:1px solid var(--glass-border);border-radius:6px;background:var(--deep)">';
        info += '<input type="checkbox" class="sync-account-cb" value="' + a.id + '" checked style="accent-color:var(--violet)"> ' + UI.esc(a.name);
        info += '</label>';
      });
      info += '</div></div>';
    }

    bodyEl.innerHTML = info;
  },

  async syncNow() {
    const btn = document.getElementById('sync-btn');
    if (!btn) return;
    btn.disabled = true;
    btn.textContent = 'Syncing...';

    try {
      const checkboxes = document.querySelectorAll('.sync-account-cb:checked');
      const accountIds = Array.from(checkboxes).map(cb => cb.value);

      if (accountIds.length === 0) {
        alert('Select at least one account to sync trades to.');
        btn.disabled = false;
        btn.textContent = 'Sync Bot Trades';
        return;
      }

      const result = await EmailSync.syncToMultipleAccounts(accountIds);

      if (result.imported > 0) {
        btn.textContent = result.imported + ' trade(s) synced!';
        btn.style.borderColor = 'var(--green)';
        btn.style.color = 'var(--green)';
        // Refresh after short delay
        setTimeout(() => {
          Settings.render(document.getElementById('content'));
          Settings.initSync();
        }, 1500);
      } else {
        btn.textContent = 'No new trades';
        setTimeout(() => {
          btn.textContent = 'Sync Bot Trades';
          btn.disabled = false;
        }, 2000);
      }

      if (result.errors.length > 0) {
        console.warn('Sync errors:', result.errors);
      }
    } catch (e) {
      btn.textContent = 'Sync failed';
      btn.style.color = 'var(--red)';
      console.error('Sync error:', e);
      setTimeout(() => {
        btn.textContent = 'Sync Bot Trades';
        btn.style.color = '';
        btn.disabled = false;
      }, 2000);
    }
  },

  async pollNow() {
    const btn = document.getElementById('poll-btn');
    if (!btn) return;
    btn.disabled = true;
    btn.textContent = 'Checking...';

    try {
      await EmailSync.triggerPoll();
      btn.textContent = 'Checking email...';
      // Wait a few seconds for the poll to complete, then refresh status
      setTimeout(async () => {
        btn.textContent = 'Check Email Now';
        btn.disabled = false;
        await Settings.initSync();
      }, 5000);
    } catch (e) {
      btn.textContent = 'Failed';
      console.error('Poll error:', e);
      setTimeout(() => {
        btn.textContent = 'Check Email Now';
        btn.disabled = false;
      }, 2000);
    }
  },
};
