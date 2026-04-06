"use strict";

const Dashboard = {
  _dismissed: new Set(),

  dismissAlert(idx) {
    Dashboard._dismissed.add(idx);
    Dashboard.render(document.getElementById('content'));
  },

  render(el) {
    const accounts = Store.getAccounts().filter(a => a.status === 'active');
    const journal = Store.getJournal();

    if (accounts.length === 0) {
      el.innerHTML = '<div style="text-align:center;padding:80px 0">' +
        '<div style="font-size:48px;margin-bottom:16px;opacity:0.3">📊</div>' +
        '<h3 style="font-size:18px;font-weight:600;margin-bottom:8px">No Accounts Yet</h3>' +
        '<p style="color:var(--text-secondary);margin-bottom:24px">Add your first trading account to get started.</p>' +
        '<button class="btn btn-primary" onclick="App.navigate(\'accounts\')">Go to Accounts</button>' +
      '</div>';
      return;
    }

    let html = '';

    const totalEquity = accounts.reduce((sum, a) => {
      const entries = journal.filter(j => j.accountId === a.id);
      return sum + a.startingBalance + entries.reduce((s, e) => s + e.pnl, 0);
    }, 0);

    const today = UI.today();
    const todayPnl = journal.filter(j => j.date === today).reduce((s, e) => s + e.pnl, 0);
    const totalPnl = journal.reduce((s, e) => s + e.pnl, 0);
    const totalFees = journal.reduce((s, e) => {
      const c = e.contracts || 0;
      const r = typeof FUTURES !== 'undefined' && FUTURES[e.symbol] ? FUTURES[e.symbol].fee : 0;
      return s + c * r;
    }, 0);
    const netAfterFees = totalPnl - totalFees;
    const wins = journal.filter(j => j.pnl > 0).length;
    const winRate = journal.length > 0 ? wins / journal.length : 0;

    html += '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:16px;margin-bottom:24px">';
    html += '<div class="stat-card" style="animation-delay:0ms"><div class="stat-label">Total Equity</div><div class="stat-value">' + UI.currency(totalEquity) + '</div><div style="font-size:12px;color:var(--text-secondary);margin-top:4px">across ' + accounts.length + ' account' + (accounts.length !== 1 ? 's' : '') + '</div></div>';
    html += '<div class="stat-card" style="animation-delay:50ms"><div class="stat-label">Today\'s P&L</div><div class="stat-value" style="' + UI.pnlClass(todayPnl) + '">' + UI.currencySign(todayPnl) + '</div></div>';
    html += '<div class="stat-card" style="animation-delay:100ms"><div class="stat-label">Total P&L</div><div class="stat-value" style="' + UI.pnlClass(totalPnl) + '">' + UI.currencySign(totalPnl) + '</div>' + (totalFees > 0 ? '<div style="font-size:12px;color:var(--text-muted);margin-top:4px">Fees: $' + totalFees.toFixed(2) + '</div>' : '') + '</div>';
    html += '<div class="stat-card" style="animation-delay:150ms"><div class="stat-label">Net After Fees</div><div class="stat-value" style="' + UI.pnlClass(netAfterFees) + '">' + UI.currencySign(netAfterFees) + '</div></div>';
    html += '<div class="stat-card" style="animation-delay:200ms"><div class="stat-label">Win Rate</div><div class="stat-value">' + UI.pct(winRate * 100) + '</div><div style="font-size:12px;color:var(--text-secondary);margin-top:4px">' + wins + ' of ' + journal.length + ' trades</div></div>';
    html += '</div>';

    // Payout Tracker
    const payouts = Store.getPayouts();
    const allAccounts = Store.getAccounts();
    const totalPayouts = payouts.reduce((s, p) => s + p.amount, 0);
    if (totalPayouts > 0 || payouts.length > 0) {
      const firmTotals = {};
      payouts.forEach(p => {
        const acct = allAccounts.find(a => a.id === p.accountId);
        const firm = acct ? acct.firm : 'unknown';
        firmTotals[firm] = (firmTotals[firm] || 0) + p.amount;
      });
      const firmLabels = { topstep: 'Topstep', apex: 'Apex', mff: 'MFF', alpha: 'Alpha', lucid: 'Lucid' };
      html += '<div class="panel" style="padding:20px 24px;margin-bottom:24px">';
      html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">';
      html += '<div style="font-size:14px;font-weight:600">Payout Tracker</div>';
      html += '<div style="font-family:\'DM Sans\',sans-serif;font-weight:800;font-size:24px;color:var(--green)">' + UI.currency(totalPayouts) + '</div>';
      html += '</div>';
      html += '<div style="display:flex;gap:16px;flex-wrap:wrap">';
      Object.keys(firmTotals).sort().forEach(firm => {
        html += '<div style="display:flex;align-items:center;gap:8px;background:var(--deep);border-radius:8px;padding:10px 16px">';
        html += UI.firmBadgeHtml(firm);
        html += '<span style="font-size:13px;color:var(--text-secondary)">' + UI.esc(firmLabels[firm] || firm) + '</span>';
        html += '<span style="font-family:\'DM Sans\',sans-serif;font-weight:800;font-size:15px;color:var(--green)">' + UI.currency(firmTotals[firm]) + '</span>';
        html += '</div>';
      });
      html += '</div></div>';
    }

    // Bot sync banner (non-blocking check)
    html += '<div id="dash-sync-banner"></div>';
    Dashboard.checkSyncBanner();

    const alerts = Rules.alerts(accounts, journal);
    const visible = alerts.filter((a, i) => !Dashboard._dismissed.has(i));
    if (visible.length > 0) {
      alerts.forEach((a, i) => {
        if (Dashboard._dismissed.has(i)) return;
        html += '<div class="alert-banner" style="margin-bottom:8px;justify-content:space-between"><div style="display:flex;align-items:center;gap:8px"><div style="width:6px;height:6px;border-radius:50%;background:var(--red);flex-shrink:0"></div>' + UI.esc(a.message) + '</div><span style="cursor:pointer;color:var(--text-muted);font-size:16px;padding:0 4px;flex-shrink:0" onclick="Dashboard.dismissAlert(' + i + ')">&times;</span></div>';
      });
      html += '<div style="margin-bottom:16px"></div>';
    }

    const funded = accounts.filter(a => a.phase === 'funded');
    const evals = accounts.filter(a => a.phase === 'eval');
    const live = accounts.filter(a => a.phase === 'live');

    let cardIdx = 0;
    if (funded.length > 0) {
      html += '<div class="section-title">Funded Accounts</div>';
      html += '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:16px;margin-bottom:8px">';
      funded.forEach(a => { html += Dashboard.accountCard(a, journal, cardIdx++); });
      html += '</div>';
    }

    if (evals.length > 0) {
      html += '<div class="section-title">Eval Accounts</div>';
      html += '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:16px;margin-bottom:8px">';
      evals.forEach(a => { html += Dashboard.accountCard(a, journal, cardIdx++); });
      html += '</div>';
    }

    if (live.length > 0) {
      html += '<div class="section-title">Live Accounts</div>';
      html += '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:16px;margin-bottom:8px">';
      live.forEach(a => { html += Dashboard.accountCard(a, journal, cardIdx++); });
      html += '</div>';
    }

    el.innerHTML = html;
  },

  async checkSyncBanner() {
    const el = document.getElementById('dash-sync-banner');
    if (!el) return;
    try {
      const status = await EmailSync.checkStatus();
      if (status && status.unsynced_trades > 0) {
        el.innerHTML = '<div style="display:flex;align-items:center;justify-content:space-between;padding:12px 16px;background:rgba(139,92,246,0.08);border:1px solid rgba(139,92,246,0.2);border-radius:10px;margin-bottom:16px;font-size:13px">' +
          '<div><span style="color:var(--violet);font-weight:600">' + status.unsynced_trades + ' bot trade(s)</span> ready to sync from email monitor</div>' +
          '<button class="btn btn-ghost btn-sm" style="border-color:var(--violet);color:var(--violet)" onclick="App.navigate(\'settings\')">Go to Sync</button>' +
          '</div>';
      }
    } catch {
      // Server not running — no banner
    }
  },

  accountCard(account, journal, idx) {
    const entries = journal.filter(j => j.accountId === account.id);
    const stats = Rules.compute(account, entries);
    const preset = Rules.getPreset(account.rules);
    const delay = (idx || 0) * 60;

    let card = '<div class="account-card" style="animation-delay:' + delay + 'ms">';

    card += '<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:12px">';
    card += '<div style="font-weight:600;font-size:15px">' + UI.esc(account.name) + (account.tradedBy === 'bot' ? ' <span style="font-size:9px;padding:1px 4px;border-radius:3px;background:rgba(139,92,246,0.15);color:var(--violet);font-weight:500">BOT</span>' : '') + '</div>';
    card += UI.badgeHtml(account.phase);
    card += '</div>';

    card += '<div style="font-family:\'DM Sans\',sans-serif;font-weight:800;font-size:22px;margin-bottom:4px">' + UI.currency(stats.currentBalance) + '</div>';
    card += '<div style="font-size:13px;margin-bottom:14px">Today: <span style="font-family:\'DM Sans\',sans-serif;font-weight:800;' + UI.pnlClass(stats.todayPnl) + '">' + UI.currencySign(stats.todayPnl) + '</span></div>';

    if (preset && preset.profitTarget) {
      card += Charts.progressBar(stats.totalPnl, preset.profitTarget);
      card += '<div style="height:10px"></div>';
    }

    const ddAmt = account.trailingDrawdown != null ? account.trailingDrawdown : (preset ? preset.trailingDrawdown : 0);

    // For evals, show gauge before payout section (no payout section on evals anyway)
    if (account.phase !== 'funded' && ddAmt > 0) {
      card += Charts.gauge(stats.cushion, ddAmt);
    }

    if (account.phase === 'funded' && preset && preset.minTradingDays > 0) {
      if (stats.payoutEligible) {
        card += '<div style="display:inline-flex;align-items:center;gap:6px;font-size:12px;margin-top:10px;padding:4px 10px;border-radius:6px;background:rgba(52,211,153,0.1);color:var(--green)">&#10003; Payout eligible</div>';
      } else {
        card += '<div style="display:inline-flex;align-items:center;gap:6px;font-size:12px;margin-top:10px;padding:4px 10px;border-radius:6px;background:rgba(154,148,168,0.1);color:var(--text-secondary)">&#9679; ' + stats.tradingDays + ' of ' + preset.minTradingDays + ' days for payout</div>';
      }
    }

    // For funded accounts, show drawdown gauge below payout status
    if (account.phase === 'funded' && ddAmt > 0) {
      card += '<div style="margin-top:10px"></div>';
      card += Charts.gauge(stats.cushion, ddAmt);
    }

    card += '</div>';
    return card;
  },
};
