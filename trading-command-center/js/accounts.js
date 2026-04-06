"use strict";

const Accounts = {
  selectedId: null,
  showArchived: false,
  showAddForm: false,
  editingId: null,
  range: 'week',

  render(el) {
    const allAccounts = Store.getAccounts();
    const journal = Store.getJournal();
    const activeAccounts = allAccounts.filter(a => a.status === 'active');
    const archivedAccounts = allAccounts.filter(a => a.status === 'archived');

    let html = '';

    // Portfolio Performance Summary
    const dateRange = Rules.dateRange(Accounts.range);
    const pStats = Rules.portfolioStats(allAccounts, journal, dateRange.start, dateRange.end);

    html += '<div class="panel" style="padding:20px 24px;margin-bottom:20px">';
    html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">';
    html += '<div style="font-size:14px;font-weight:600">Portfolio Performance</div>';
    html += '<div style="display:flex;gap:4px">';
    ['today', 'week', 'month', 'year', 'all'].forEach(r => {
      const labels = { today: 'Today', week: 'This Week', month: 'This Month', year: 'This Year', all: 'All Time' };
      html += '<div class="range-pill' + (Accounts.range === r ? ' active' : '') + '" onclick="Accounts.setRange(\'' + r + '\')">' + labels[r] + '</div>';
    });
    html += '</div></div>';

    // Stats row
    html += '<div style="display:grid;grid-template-columns:repeat(5,1fr);gap:16px;margin-bottom:20px">';
    html += '<div><div class="stat-label">Total P&L</div><div class="stat-value" style="font-size:24px;' + UI.pnlClass(pStats.totalPnl) + '">' + UI.currencySign(pStats.totalPnl) + '</div><div style="font-size:11px;color:var(--text-secondary);margin-top:2px">across all accounts</div></div>';
    html += '<div><div class="stat-label">Win Rate</div><div class="stat-value" style="font-size:24px">' + UI.pct(pStats.winRate * 100) + '</div><div style="font-size:11px;color:var(--text-secondary);margin-top:2px">' + pStats.tradeCount + ' trades</div></div>';
    html += '<div><div class="stat-label">Avg Daily</div><div class="stat-value" style="font-size:24px;' + UI.pnlClass(pStats.avgDaily) + '">' + UI.currencySign(pStats.avgDaily) + '</div><div style="font-size:11px;color:var(--text-secondary);margin-top:2px">' + pStats.tradingDays + ' trading days</div></div>';
    html += '<div><div class="stat-label">Best Day</div><div class="stat-value" style="font-size:24px;color:var(--green)">' + (pStats.bestDay ? UI.currencySign(pStats.bestDay.pnl) : '-') + '</div><div style="font-size:11px;color:var(--text-secondary);margin-top:2px">' + (pStats.bestDay ? UI.formatDate(pStats.bestDay.date) : '') + '</div></div>';
    html += '<div><div class="stat-label">Worst Day</div><div class="stat-value" style="font-size:24px;color:var(--red)">' + (pStats.worstDay ? UI.currencySign(pStats.worstDay.pnl) : '-') + '</div><div style="font-size:11px;color:var(--text-secondary);margin-top:2px">' + (pStats.worstDay ? UI.formatDate(pStats.worstDay.date) : '') + '</div></div>';
    html += '</div>';

    // Portfolio chart
    if (pStats.equityCurve.length > 0) {
      html += '<div style="background:var(--deep);border-radius:10px;padding:16px">';
      html += '<div style="display:flex;justify-content:space-between;font-size:12px;color:var(--text-secondary);margin-bottom:12px">';
      html += '<span>Combined Equity</span>';
      html += '<div style="display:flex;gap:14px;font-size:11px"><span style="display:flex;align-items:center;gap:5px"><span style="width:8px;height:3px;border-radius:2px;background:var(--gold)"></span>Cumulative</span><span style="display:flex;align-items:center;gap:5px"><span style="width:8px;height:3px;border-radius:2px;background:var(--green)"></span>Daily P&L</span></div>';
      html += '</div>';
      html += Charts.barChart(pStats.equityCurve, { width: 700, height: 180, showLine: true });
      html += '</div>';
    }

    html += '</div>';

    // Sub-tabs: Active / Archived
    html += '<div style="display:flex;gap:8px;margin-bottom:20px">';
    html += '<div class="filter-chip' + (!Accounts.showArchived ? ' active' : '') + '" onclick="Accounts.showArchived=false;Accounts.selectedId=null;Accounts.editingId=null;Accounts.render(document.getElementById(\'content\'))">Active (' + activeAccounts.length + ')</div>';
    html += '<div class="filter-chip' + (Accounts.showArchived ? ' active' : '') + '" onclick="Accounts.showArchived=true;Accounts.selectedId=null;Accounts.editingId=null;Accounts.render(document.getElementById(\'content\'))">Archived (' + archivedAccounts.length + ')</div>';
    html += '</div>';

    // Top actions
    html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">';
    html += '<div style="font-size:13px;color:var(--text-secondary)">Click an account to view details</div>';
    html += '<button class="btn btn-primary btn-sm" onclick="Accounts.toggleAddForm()">+ Add Account</button>';
    html += '</div>';

    // Add account form
    if (Accounts.showAddForm) {
      html += '<div class="panel" style="padding:24px;margin-bottom:16px">';
      html += '<div style="font-size:15px;font-weight:600;margin-bottom:16px"><span style="color:var(--gold)">+</span> New Account</div>';
      html += '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:12px;margin-bottom:12px">';
      html += '<div><div class="form-label">Name</div><input class="form-input" id="acc-name" placeholder="Topstep Funded 1"></div>';
      html += '<div><div class="form-label">Firm</div><select class="form-input" id="acc-firm" onchange="Accounts.onFirmChange()">';
      html += '<option value="topstep">Topstep</option><option value="apex">Apex</option>';
      html += '<option value="mff">MyFundedFutures</option><option value="alpha">Alpha Futures</option><option value="lucid">Lucid Trading</option>';
      html += '</select></div>';
      html += '<div><div class="form-label">Phase</div><select class="form-input" id="acc-phase"><option value="funded">Funded</option><option value="eval">Eval</option><option value="live">Live</option></select></div>';
      html += '<div id="acc-subtype-wrap" style="display:block"><div class="form-label">Account Type</div><select class="form-input" id="acc-subtype">' + Accounts._subtypeOptions('topstep', null) + '</select></div>';
      html += '<div><div class="form-label">Starting Balance</div><input class="form-input" id="acc-balance" type="number" value="50000"></div>';
      html += '<div><div class="form-label">Trailing Drawdown</div><input class="form-input" id="acc-drawdown" type="number" value="2000"></div>';
      html += '<div><div class="form-label">Traded By</div><select class="form-input" id="acc-traded-by"><option value="manual">Manual</option><option value="bot">Bot</option></select></div>';
      html += '</div>';
      html += '<div style="display:flex;justify-content:flex-end;gap:8px">';
      html += '<button class="btn btn-ghost btn-sm" onclick="Accounts.toggleAddForm()">Cancel</button>';
      html += '<button class="btn btn-primary btn-sm" onclick="Accounts.createAccount()">Create Account</button>';
      html += '</div></div>';
    }

    // Account list
    const displayAccounts = Accounts.showArchived ? archivedAccounts : activeAccounts;

    html += '<div style="display:grid;grid-template-columns:200px 70px 110px 110px 70px 1fr;padding:8px 20px;font-size:11px;text-transform:uppercase;letter-spacing:1px;color:var(--text-muted)">';
    html += '<div>Account</div><div>Phase</div><div>Balance</div><div>Total P&L</div><div>Trades</div><div>Cushion</div>';
    html += '</div>';

    displayAccounts.forEach(a => {
      const entries = journal.filter(j => j.accountId === a.id);
      const stats = Rules.compute(a, entries);
      const preset = Rules.getPreset(a.rules);
      const isSelected = Accounts.selectedId === a.id;

      html += '<div class="account-row" style="display:grid;grid-template-columns:200px 70px 110px 110px 70px 1fr;align-items:center;padding:12px 20px;background:var(--surface);border:1px solid ' + (isSelected ? 'var(--gold)' : 'var(--glass-border)') + ';border-radius:10px;font-size:13px;cursor:pointer;margin-bottom:8px' + (isSelected ? ';background:rgba(201,169,110,0.04);box-shadow:0 0 20px rgba(201,169,110,0.06)' : '') + '" onclick="Accounts.selectAccount(\'' + a.id + '\')">';
      html += '<div style="font-weight:600;font-size:14px">' + UI.esc(a.name) + (a.tradedBy === 'bot' ? ' <span style="font-size:9px;padding:1px 4px;border-radius:3px;background:rgba(139,92,246,0.15);color:var(--violet);font-weight:500">BOT</span>' : '') + '</div>';
      html += '<div>' + UI.badgeHtml(a.phase) + '</div>';
      html += '<div>' + UI.currency(stats.currentBalance) + '</div>';
      html += '<div style="' + UI.pnlClass(stats.totalPnl) + '">' + UI.currencySign(stats.totalPnl) + '</div>';
      html += '<div>' + entries.length + '</div>';
      html += '<div style="color:' + UI.cushionColor(stats.cushion) + '">' + UI.currency(stats.cushion) + '</div>';
      html += '</div>';
    });

    // Detail panel
    if (Accounts.selectedId) {
      const acct = Store.getAccount(Accounts.selectedId);
      if (acct) {
        html += Accounts.detailPanel(acct, journal);
      }
    }

    el.innerHTML = html;
    if (Accounts.showAddForm) Accounts.onFirmChange();
  },

  detailPanel(account, journal) {
    const entries = journal.filter(j => j.accountId === account.id);
    const stats = Rules.compute(account, entries);
    const preset = Rules.getPreset(account.rules);

    let html = '<div class="panel" style="padding:24px;margin-top:24px">';

    // Header
    html += '<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:24px">';
    html += '<div>';
    html += '<div style="font-family:\'DM Sans\',sans-serif;font-weight:800;font-size:22px">' + UI.esc(account.name) + '</div>';
    html += '<div style="display:flex;gap:12px;align-items:center;margin-top:6px">';
    html += UI.badgeHtml(account.phase);
    html += '<span style="font-size:12px;color:var(--text-secondary)">Created ' + UI.formatDate(account.createdAt.slice(0, 10)) + '</span>';
    html += '<span style="font-size:12px;color:var(--text-secondary)">&middot; ' + stats.tradingDays + ' trading days</span>';
    html += '</div></div>';
    html += '<div style="display:flex;gap:8px">';
    html += '<button class="btn btn-ghost btn-sm" onclick="Accounts.toggleEdit(\'' + account.id + '\')">Edit</button>';
    html += '<button class="btn btn-ghost btn-sm" onclick="Accounts.duplicateAccount(\'' + account.id + '\')">Duplicate</button>';
    if (account.status === 'active') {
      html += '<button class="btn btn-danger btn-sm" onclick="Accounts.archiveAccount(\'' + account.id + '\')">Archive</button>';
    }
    html += '</div></div>';

    // Edit form
    if (Accounts.editingId === account.id) {
      const dd = account.trailingDrawdown != null ? account.trailingDrawdown : (preset ? preset.trailingDrawdown : 2000);
      html += '<div style="background:var(--deep);border:1px solid rgba(201,169,110,0.2);border-radius:10px;padding:20px;margin-bottom:24px">';
      html += '<div style="font-size:13px;font-weight:600;color:var(--gold);margin-bottom:12px">Edit Account</div>';
      html += '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:12px;margin-bottom:12px">';
      html += '<div><div class="form-label">Name</div><input class="form-input" id="edit-name" value="' + UI.esc(account.name) + '"></div>';
      html += '<div><div class="form-label">Firm</div><select class="form-input" id="edit-firm" onchange="Accounts.onEditFirmChange()">';
      ['topstep','apex','mff','alpha','lucid'].forEach(f => {
        const labels = { topstep:'Topstep', apex:'Apex', mff:'MyFundedFutures', alpha:'Alpha Futures', lucid:'Lucid Trading' };
        html += '<option value="' + f + '"' + (account.firm === f ? ' selected' : '') + '>' + labels[f] + '</option>';
      });
      html += '</select></div>';
      html += '<div><div class="form-label">Phase</div><select class="form-input" id="edit-phase"><option value="funded"' + (account.phase === 'funded' ? ' selected' : '') + '>Funded</option><option value="eval"' + (account.phase === 'eval' ? ' selected' : '') + '>Eval</option><option value="live"' + (account.phase === 'live' ? ' selected' : '') + '>Live</option></select></div>';
      const curSub = account.subtype || (account.firm === 'mff' ? 'core' : 'normal');
      html += '<div id="edit-subtype-wrap" style="display:' + (Accounts._hasSubtype(account.firm) ? 'block' : 'none') + '"><div class="form-label">Account Type</div><select class="form-input" id="edit-subtype">' + Accounts._subtypeOptions(account.firm, curSub) + '</select></div>';
      html += '<div><div class="form-label">Starting Balance</div><input class="form-input" id="edit-balance" type="number" value="' + account.startingBalance + '"></div>';
      html += '<div><div class="form-label">Trailing Drawdown</div><input class="form-input" id="edit-drawdown" type="number" value="' + dd + '"></div>';
      const curTradedBy = account.tradedBy || 'manual';
      html += '<div><div class="form-label">Traded By</div><select class="form-input" id="edit-traded-by"><option value="manual"' + (curTradedBy === 'manual' ? ' selected' : '') + '>Manual</option><option value="bot"' + (curTradedBy === 'bot' ? ' selected' : '') + '>Bot</option></select></div>';
      html += '</div>';
      html += '<div style="display:flex;justify-content:flex-end;gap:8px">';
      html += '<button class="btn btn-ghost btn-sm" onclick="Accounts.toggleEdit(null)">Cancel</button>';
      html += '<button class="btn btn-primary btn-sm" onclick="Accounts.saveEdit(\'' + account.id + '\')">Save</button>';
      html += '</div></div>';
    }

    // Stats grid
    html += '<div style="display:grid;grid-template-columns:repeat(6,1fr);gap:12px;margin-bottom:24px">';
    html += '<div style="background:var(--deep);border-radius:8px;padding:14px"><div class="stat-label">Balance</div><div style="font-family:\'DM Sans\',sans-serif;font-weight:800;font-size:20px">' + UI.currency(stats.currentBalance) + '</div></div>';
    html += '<div style="background:var(--deep);border-radius:8px;padding:14px"><div class="stat-label">Total P&L</div><div style="font-family:\'DM Sans\',sans-serif;font-weight:800;font-size:20px;' + UI.pnlClass(stats.totalPnl) + '">' + UI.currencySign(stats.totalPnl) + '</div></div>';
    html += '<div style="background:var(--deep);border-radius:8px;padding:14px"><div class="stat-label">Win Rate</div><div style="font-family:\'DM Sans\',sans-serif;font-weight:800;font-size:20px">' + UI.pct(stats.winRate * 100) + '</div></div>';
    html += '<div style="background:var(--deep);border-radius:8px;padding:14px"><div class="stat-label">Avg Win</div><div style="font-family:\'DM Sans\',sans-serif;font-weight:800;font-size:20px;color:var(--green)">' + UI.currencySign(stats.avgWin) + '</div></div>';
    html += '<div style="background:var(--deep);border-radius:8px;padding:14px"><div class="stat-label">Avg Loss</div><div style="font-family:\'DM Sans\',sans-serif;font-weight:800;font-size:20px;color:var(--red)">' + UI.currency(stats.avgLoss) + '</div></div>';
    html += '<div style="background:var(--deep);border-radius:8px;padding:14px"><div class="stat-label">Profit Factor</div><div style="font-family:\'DM Sans\',sans-serif;font-weight:800;font-size:20px">' + (stats.profitFactor === Infinity ? '&#8734;' : stats.profitFactor.toFixed(2)) + '</div></div>';
    html += '</div>';

    // Equity curve
    if (stats.equityCurve.length >= 2) {
      html += '<div style="background:var(--deep);border-radius:10px;padding:20px;margin-bottom:24px">';
      html += '<div style="display:flex;justify-content:space-between;font-size:13px;font-weight:500;margin-bottom:16px">';
      html += '<span>Equity Curve</span>';
      html += '<div style="display:flex;gap:14px;font-size:11px"><span style="color:var(--gold)">&#9644; Balance</span><span style="color:var(--red)">- - Drawdown Floor</span></div>';
      html += '</div>';
      html += Charts.equityCurve(stats.equityCurve, { width: 700, height: 200, showFloor: true });
      html += '</div>';
    }

    // Two columns: payout status + daily P&L bars
    html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:24px">';

    // Payout status
    html += '<div style="background:var(--deep);border-radius:10px;padding:20px">';
    html += '<div style="font-size:12px;text-transform:uppercase;letter-spacing:1.5px;color:var(--text-muted);margin-bottom:12px">' + (preset && preset.profitTarget ? 'Eval Progress' : 'Payout Status') + '</div>';
    html += '<div style="display:flex;flex-direction:column;gap:10px;font-size:13px">';

    if (preset && preset.minTradingDays > 0) {
      const daysMet = stats.tradingDays >= preset.minTradingDays;
      html += '<div style="display:flex;justify-content:space-between"><span style="color:var(--text-secondary)">Trading Days</span><span>' + stats.tradingDays + ' of ' + preset.minTradingDays + ' required ' + (daysMet ? '<span style="color:var(--green)">&#10003;</span>' : '') + '</span></div>';
    }
    if (preset && preset.consistencyPct) {
      html += '<div style="display:flex;justify-content:space-between"><span style="color:var(--text-secondary)">Consistency Rule</span><span>Best day ' + UI.pct(stats.bestDayPct * 100) + ' of total ' + (stats.consistencyOk ? '<span style="color:var(--green)">&#10003;</span>' : '<span style="color:var(--red)">&#10007;</span>') + '</span></div>';
      if (stats.consistencyTarget && !stats.consistencyOk) {
        html += '<div style="display:flex;justify-content:space-between"><span style="color:var(--text-secondary)">Need Total P&L</span><span style="color:var(--yellow)">' + UI.currency(stats.consistencyTarget) + ' <span style="font-size:11px;color:var(--text-muted)">(best day ' + UI.currency(stats.bestDayPnl) + ' / ' + (preset.consistencyPct * 100) + '%)</span></span></div>';
        html += '<div style="margin-top:4px">' + Charts.progressBar(stats.totalPnl, stats.consistencyTarget) + '</div>';
      }
    }
    if (preset && preset.profitTarget) {
      html += '<div style="display:flex;justify-content:space-between"><span style="color:var(--text-secondary)">Progress</span><span style="color:var(--gold)">' + UI.currency(stats.totalPnl) + ' / ' + UI.currency(preset.profitTarget) + '</span></div>';
      if (stats.projectedDays !== null) {
        html += '<div style="display:flex;justify-content:space-between"><span style="color:var(--text-secondary)">Projected Days Left</span><span>' + stats.projectedDays + '</span></div>';
      }
    }
    if (account.phase === 'funded') {
      html += '<div style="display:flex;justify-content:space-between"><span style="color:var(--text-secondary)">Withdrawable</span><span style="color:var(--gold);font-weight:600">' + UI.currency(Math.max(0, stats.totalPnl)) + '</span></div>';
    }
    const ddAmt = account.trailingDrawdown != null ? account.trailingDrawdown : (preset ? preset.trailingDrawdown : 0);
    html += '<div style="display:flex;justify-content:space-between"><span style="color:var(--text-secondary)">Drawdown Cushion</span><span style="color:' + UI.cushionColor(stats.cushion) + '">' + UI.currency(stats.cushion) + ' / ' + UI.currency(ddAmt) + '</span></div>';
    html += '</div></div>';

    // Daily P&L bars
    html += '<div style="background:var(--deep);border-radius:10px;padding:20px">';
    html += '<div style="font-size:12px;text-transform:uppercase;letter-spacing:1.5px;color:var(--text-muted);margin-bottom:12px">Daily P&L Distribution</div>';
    html += Charts.barChart(stats.dailyPnl, { width: 350, height: 120, showLine: false });
    html += '</div>';

    html += '</div>';

    // Payout History
    const acctPayouts = Store.getPayoutsForAccount(account.id);
    const totalPaid = acctPayouts.reduce((s, p) => s + p.amount, 0);

    html += '<div style="background:var(--deep);border-radius:10px;padding:20px;margin-bottom:24px">';
    html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">';
    html += '<div style="font-size:12px;text-transform:uppercase;letter-spacing:1.5px;color:var(--text-muted)">Payouts</div>';
    html += '<div style="display:flex;align-items:center;gap:12px">';
    html += '<span style="font-family:\'DM Sans\',sans-serif;font-weight:800;font-size:18px;color:var(--green)">' + UI.currency(totalPaid) + '</span>';
    html += '<button class="btn btn-primary btn-sm" onclick="Accounts.showPayoutForm(\'' + account.id + '\')">+ Log Payout</button>';
    html += '</div></div>';

    // Payout add form
    if (Accounts._showPayoutFormId === account.id) {
      html += '<div style="display:flex;gap:12px;align-items:flex-end;margin-bottom:16px;padding:12px;background:rgba(201,169,110,0.04);border:1px solid rgba(201,169,110,0.15);border-radius:8px">';
      html += '<div style="flex:1"><div class="form-label">Date</div><input type="date" class="form-input" id="payout-date" value="' + UI.today() + '"></div>';
      html += '<div style="flex:1"><div class="form-label">Amount ($)</div><input type="text" class="form-input" id="payout-amount" placeholder="1,250"></div>';
      html += '<div style="flex:2"><div class="form-label">Note</div><input type="text" class="form-input" id="payout-note" placeholder="First payout, monthly split, etc."></div>';
      html += '<button class="btn btn-primary btn-sm" onclick="Accounts.savePayout(\'' + account.id + '\')">Save</button>';
      html += '<button class="btn btn-ghost btn-sm" onclick="Accounts._showPayoutFormId=null;Accounts.render(document.getElementById(\'content\'))">Cancel</button>';
      html += '</div>';
    }

    if (acctPayouts.length === 0) {
      html += '<div style="color:var(--text-muted);font-size:13px">No payouts recorded yet</div>';
    } else {
      const sorted = acctPayouts.slice().sort((a, b) => b.date.localeCompare(a.date));
      sorted.forEach(p => {
        html += '<div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid rgba(255,255,255,0.03);font-size:13px">';
        html += '<div style="display:flex;align-items:center;gap:12px">';
        html += '<span style="color:var(--text-secondary)">' + UI.formatDate(p.date) + '</span>';
        if (p.note) html += '<span style="color:var(--text-muted);font-size:12px">' + UI.esc(p.note) + '</span>';
        html += '</div>';
        html += '<div style="display:flex;align-items:center;gap:10px">';
        html += '<span style="font-family:\'DM Sans\',sans-serif;font-weight:800;color:var(--green)">' + UI.currency(p.amount) + '</span>';
        html += '<span style="cursor:pointer;color:var(--text-muted);font-size:12px;opacity:0.5;transition:opacity 0.2s" onmouseenter="this.style.opacity=1" onmouseleave="this.style.opacity=0.5" onclick="Accounts.deletePayout(\'' + p.id + '\')">&#128465;</span>';
        html += '</div></div>';
      });
    }
    html += '</div>';

    // Recent trades
    html += '<div style="font-size:12px;text-transform:uppercase;letter-spacing:1.5px;color:var(--text-muted);margin-bottom:12px">Recent Trades</div>';
    const recent = entries.sort((a, b) => b.date.localeCompare(a.date)).slice(0, 10);
    if (recent.length === 0) {
      html += '<div style="color:var(--text-muted);font-size:13px;padding:16px 0">No trades recorded yet</div>';
    } else {
      html += '<table style="width:100%;font-size:13px;border-collapse:collapse">';
      html += '<thead><tr style="text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:1px;color:var(--text-muted)">';
      html += '<th style="padding:8px 12px;border-bottom:1px solid var(--glass-border);font-weight:500">Date</th>';
      html += '<th style="padding:8px 12px;border-bottom:1px solid var(--glass-border);font-weight:500">P&L</th>';
      html += '<th style="padding:8px 12px;border-bottom:1px solid var(--glass-border);font-weight:500">Entry</th>';
      html += '<th style="padding:8px 12px;border-bottom:1px solid var(--glass-border);font-weight:500">Exit</th>';
      html += '<th style="padding:8px 12px;border-bottom:1px solid var(--glass-border);font-weight:500">In</th>';
      html += '<th style="padding:8px 12px;border-bottom:1px solid var(--glass-border);font-weight:500">Out</th>';
      html += '<th style="padding:8px 12px;border-bottom:1px solid var(--glass-border);font-weight:500">Notes</th>';
      html += '</tr></thead><tbody>';
      recent.forEach(e => {
        html += '<tr><td style="padding:10px 12px;border-bottom:1px solid rgba(255,255,255,0.02)">' + UI.formatDate(e.date) + '</td>';
        html += '<td style="padding:10px 12px;border-bottom:1px solid rgba(255,255,255,0.02);font-weight:500;' + UI.pnlClass(e.pnl) + '">' + UI.currencySign(e.pnl) + '</td>';
        html += '<td style="padding:10px 12px;border-bottom:1px solid rgba(255,255,255,0.02)">' + UI.formatPrice(e.entryPrice) + '</td>';
        html += '<td style="padding:10px 12px;border-bottom:1px solid rgba(255,255,255,0.02)">' + UI.formatPrice(e.exitPrice) + '</td>';
        html += '<td style="padding:10px 12px;border-bottom:1px solid rgba(255,255,255,0.02)">' + UI.esc(e.entryTime || '-') + '</td>';
        html += '<td style="padding:10px 12px;border-bottom:1px solid rgba(255,255,255,0.02)">' + UI.esc(e.exitTime || '-') + '</td>';
        html += '<td style="padding:10px 12px;border-bottom:1px solid rgba(255,255,255,0.02);color:var(--text-secondary);max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + UI.esc(e.notes || '') + '</td>';
        html += '</tr>';
      });
      html += '</tbody></table>';
    }

    html += '</div>';
    return html;
  },

  selectAccount(id) {
    Accounts.selectedId = Accounts.selectedId === id ? null : id;
    Accounts.render(document.getElementById('content'));
  },

  setRange(range) {
    Accounts.range = range;
    Accounts.render(document.getElementById('content'));
  },

  toggleAddForm() {
    Accounts.showAddForm = !Accounts.showAddForm;
    Accounts.render(document.getElementById('content'));
  },

  _resolveRules(firm, phase, subtype) {
    if (firm === 'topstep') {
      return subtype === 'consistency' ? 'topstep_50k_consistency' : 'topstep_50k_normal';
    }
    if (firm === 'apex') return phase === 'eval' ? 'apex_50k_eval' : 'apex_50k_funded';
    if (firm === 'mff') {
      const plan = subtype === 'rapid' ? 'rapid' : 'core';
      return phase === 'eval' ? 'mff_' + plan + '_50k_eval' : 'mff_' + plan + '_50k_funded';
    }
    if (firm === 'alpha') return phase === 'eval' ? 'alpha_50k_eval' : 'alpha_50k_funded';
    if (firm === 'lucid') return phase === 'eval' ? 'lucid_50k_eval' : 'lucid_50k_funded';
    return '';
  },

  _hasSubtype(firm) { return firm === 'topstep' || firm === 'mff'; },

  _subtypeOptions(firm, selected) {
    if (firm === 'topstep') {
      return '<option value="normal"' + (selected === 'normal' ? ' selected' : '') + '>Normal XFA</option>' +
             '<option value="consistency"' + (selected === 'consistency' ? ' selected' : '') + '>Consistency XFA</option>';
    }
    if (firm === 'mff') {
      return '<option value="core"' + (selected === 'core' || !selected ? ' selected' : '') + '>Core (EOD DD)</option>' +
             '<option value="rapid"' + (selected === 'rapid' ? ' selected' : '') + '>Rapid (Intraday DD)</option>';
    }
    return '';
  },

  onFirmChange() {
    const wrap = document.getElementById('acc-subtype-wrap');
    const firm = document.getElementById('acc-firm');
    const sel = document.getElementById('acc-subtype');
    if (wrap && firm) {
      const show = Accounts._hasSubtype(firm.value);
      wrap.style.display = show ? 'block' : 'none';
      if (show && sel) sel.innerHTML = Accounts._subtypeOptions(firm.value, null);
    }
  },

  onEditFirmChange() {
    const wrap = document.getElementById('edit-subtype-wrap');
    const firm = document.getElementById('edit-firm');
    const sel = document.getElementById('edit-subtype');
    if (wrap && firm) {
      const show = Accounts._hasSubtype(firm.value);
      wrap.style.display = show ? 'block' : 'none';
      if (show && sel) sel.innerHTML = Accounts._subtypeOptions(firm.value, null);
    }
  },

  createAccount() {
    const name = document.getElementById('acc-name').value.trim();
    const firm = document.getElementById('acc-firm').value;
    const phase = document.getElementById('acc-phase').value;
    const subtype = document.getElementById('acc-subtype') ? document.getElementById('acc-subtype').value : 'normal';
    const startingBalance = parseFloat(document.getElementById('acc-balance').value) || 50000;
    const trailingDrawdown = parseFloat(document.getElementById('acc-drawdown').value);
    const tradedBy = document.getElementById('acc-traded-by').value;

    if (!name) { alert('Account name is required.'); return; }

    const rules = Accounts._resolveRules(firm, phase, subtype);

    Store.saveAccount({ name, firm, phase, subtype: Accounts._hasSubtype(firm) ? subtype : null, status: 'active', startingBalance, trailingDrawdown: isNaN(trailingDrawdown) ? 2000 : trailingDrawdown, tradedBy, rules });
    Accounts.showAddForm = false;
    Accounts.render(document.getElementById('content'));
  },

  archiveAccount(id) {
    if (confirm('Archive this account? Trade history will be preserved.')) {
      Store.archiveAccount(id);
      Accounts.selectedId = null;
      Accounts.render(document.getElementById('content'));
    }
  },

  toggleEdit(id) {
    Accounts.editingId = Accounts.editingId === id ? null : id;
    if (Accounts.editingId) Accounts.selectedId = id;
    Accounts.render(document.getElementById('content'));
  },

  saveEdit(id) {
    const name = document.getElementById('edit-name').value.trim();
    const firm = document.getElementById('edit-firm').value;
    const phase = document.getElementById('edit-phase').value;
    const subtype = document.getElementById('edit-subtype') ? document.getElementById('edit-subtype').value : 'normal';
    const startingBalance = parseFloat(document.getElementById('edit-balance').value) || 50000;
    const trailingDrawdown = parseFloat(document.getElementById('edit-drawdown').value);
    const tradedBy = document.getElementById('edit-traded-by').value;

    if (!name) { alert('Account name is required.'); return; }

    const rules = Accounts._resolveRules(firm, phase, subtype);

    Store.saveAccount({ id, name, firm, phase, subtype: Accounts._hasSubtype(firm) ? subtype : null, startingBalance, trailingDrawdown: isNaN(trailingDrawdown) ? 2000 : trailingDrawdown, tradedBy, rules });
    Accounts.editingId = null;
    Accounts.render(document.getElementById('content'));
  },

  _nextName(src) {
    const firmLabels = { topstep: 'Topstep', apex: 'Apex', mff: 'MFF', alpha: 'Alpha', lucid: 'Lucid' };
    const phaseLabels = { funded: 'Funded', eval: 'Eval', live: 'Live' };
    const label = (firmLabels[src.firm] || src.firm) + ' ' + (phaseLabels[src.phase] || src.phase);
    const all = Store.getAccounts();
    const names = new Set(all.map(a => a.name));
    let n = all.filter(a => a.firm === src.firm && a.phase === src.phase).length + 1;
    while (names.has(label + ' ' + n)) n++;
    return label + ' ' + n;
  },

  duplicateAccount(id) {
    const src = Store.getAccount(id);
    if (!src) return;
    const copy = Store.saveAccount({
      name: Accounts._nextName(src),
      firm: src.firm,
      phase: src.phase,
      subtype: src.subtype || null,
      status: 'active',
      startingBalance: src.startingBalance,
      trailingDrawdown: src.trailingDrawdown != null ? src.trailingDrawdown : 2000,
      rules: src.rules,
    });
    Accounts.selectedId = copy.id;
    Accounts.render(document.getElementById('content'));
  },

  deleteAccount(id) {
    if (confirm('Permanently delete this account and all its trades? This cannot be undone.')) {
      Store.deleteAccount(id);
      if (Accounts.selectedId === id) Accounts.selectedId = null;
      Accounts.render(document.getElementById('content'));
    }
  },

  // Payout tracking
  _showPayoutFormId: null,

  showPayoutForm(accountId) {
    Accounts._showPayoutFormId = accountId;
    Accounts.render(document.getElementById('content'));
  },

  savePayout(accountId) {
    const date = document.getElementById('payout-date').value;
    const rawAmount = document.getElementById('payout-amount').value;
    const note = document.getElementById('payout-note').value.trim();
    const amount = parseFloat(rawAmount.replace(/[,$\s+]/g, '')) || 0;
    if (!date || amount <= 0) { alert('Date and a positive amount are required.'); return; }
    Store.savePayout({ accountId, date, amount, note });
    Accounts._showPayoutFormId = null;
    Accounts.render(document.getElementById('content'));
  },

  deletePayout(id) {
    if (confirm('Delete this payout record?')) {
      Store.deletePayout(id);
      Accounts.render(document.getElementById('content'));
    }
  },
};
