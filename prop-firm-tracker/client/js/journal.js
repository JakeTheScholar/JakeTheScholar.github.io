"use strict";

const FUTURES = {
  MNQ: { name: 'Micro Nasdaq-100',    fee: 0.74, group: 'Micro Equity' },
  MES: { name: 'Micro S&P 500',       fee: 0.74, group: 'Micro Equity' },
  MYM: { name: 'Micro Dow',           fee: 0.74, group: 'Micro Equity' },
  M2K: { name: 'Micro Russell 2000',  fee: 0.74, group: 'Micro Equity' },
  NQ:  { name: 'E-mini Nasdaq-100',   fee: 2.24, group: 'E-mini Equity' },
  ES:  { name: 'E-mini S&P 500',      fee: 2.24, group: 'E-mini Equity' },
  YM:  { name: 'E-mini Dow',          fee: 2.24, group: 'E-mini Equity' },
  RTY: { name: 'E-mini Russell 2000', fee: 2.24, group: 'E-mini Equity' },
  MGC: { name: 'Micro Gold',          fee: 0.90, group: 'Micro Metals' },
  SIL: { name: 'Micro Silver',        fee: 0.90, group: 'Micro Metals' },
  MHG: { name: 'Micro Copper',        fee: 0.90, group: 'Micro Metals' },
  GC:  { name: 'Gold (COMEX)',        fee: 2.50, group: 'Metals' },
  SI:  { name: 'Silver (COMEX)',      fee: 2.50, group: 'Metals' },
  HG:  { name: 'Copper (COMEX)',      fee: 2.50, group: 'Metals' },
  MCL: { name: 'Micro Crude Oil',     fee: 0.90, group: 'Micro Energy' },
  MNG: { name: 'Micro Natural Gas',   fee: 0.90, group: 'Micro Energy' },
  CL:  { name: 'Crude Oil (WTI)',     fee: 2.50, group: 'Energy' },
  NG:  { name: 'Natural Gas',         fee: 2.50, group: 'Energy' },
};

const Journal = {
  _accounts: [],
  _entries: [],
  filters: { firm: 'all', outcome: 'all', range: 'month' },
  selectedIds: [],
  bulkEditMode: false,
  expandedId: null,

  _getEntry(id) {
    return this._entries.find(e => e.id === id) || null;
  },

  _getAccount(id) {
    return this._accounts.find(a => a.id === id) || null;
  },

  symbolOptions() {
    let html = '';
    const groups = {};
    Object.entries(FUTURES).forEach(([sym, info]) => {
      if (!groups[info.group]) groups[info.group] = [];
      groups[info.group].push(sym);
    });
    Object.entries(groups).forEach(([group, syms]) => {
      html += '<optgroup label="' + group + '">';
      syms.forEach(sym => {
        html += '<option value="' + sym + '">' + sym + ' — ' + FUTURES[sym].name + ' ($' + FUTURES[sym].fee.toFixed(2) + '/ct)</option>';
      });
      html += '</optgroup>';
    });
    return html;
  },

  async render(el) {
    el.innerHTML = '<div style="text-align:center;padding:60px;color:var(--text-muted)">Loading...</div>';
    try {
      [this._accounts, this._entries] = await Promise.all([
        API.getAccounts(),
        API.getJournal(),
      ]);
    } catch (err) {
      el.innerHTML = '<div style="text-align:center;padding:60px;color:var(--red)">Failed to load: ' + UI.esc(err.message) + '</div>';
      return;
    }
    App.setHeaderCount(this._accounts);
    this._buildView(el);
  },

  _buildView(el) {
    const accounts = this._accounts.filter(a => a.status === 'active');
    let html = '';

    const isEditing = Journal.bulkEditMode && Journal.selectedIds.length > 0;
    const firstEntry = isEditing ? Journal._getEntry(Journal.selectedIds[0]) : null;

    // --- Form ---
    html += '<div class="panel" style="padding:24px;margin-bottom:24px' + (isEditing ? ';border-left:3px solid var(--gold)' : '') + '">';

    if (isEditing) {
      html += '<div style="font-size:15px;font-weight:600;margin-bottom:16px"><span style="color:var(--gold)">&#9998;</span> Edit ' + Journal.selectedIds.length + ' Selected Trade' + (Journal.selectedIds.length > 1 ? 's' : '') + '</div>';
    } else {
      html += '<div style="font-size:15px;font-weight:600;margin-bottom:16px"><span style="color:var(--gold)">+</span> Quick Trade Entry</div>';
    }

    html += '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:12px;margin-bottom:12px">';

    if (isEditing) {
      const selectedEntries = Journal.selectedIds.map(id => Journal._getEntry(id)).filter(Boolean);
      const uniqueAcctIds = [...new Set(selectedEntries.map(e => e.accountId))];
      const mixedAccounts = uniqueAcctIds.length > 1;
      html += '<div><div class="form-label">Account</div><select class="form-input" id="j-account">';
      if (mixedAccounts) {
        html += '<option value="__keep__" selected>&#8212; Keep Each Account &#8212;</option>';
      }
      accounts.forEach(a => {
        html += '<option value="' + a.id + '"' + (!mixedAccounts && firstEntry && a.id === firstEntry.accountId ? ' selected' : '') + '>' + UI.esc(a.name) + '</option>';
      });
      html += '</select></div>';
    } else {
      html += '<div><div class="form-label">Accounts <span style="font-size:9px;color:var(--text-muted);text-transform:none;letter-spacing:0">(select multiple)</span></div>';
      html += '<div id="j-accounts-wrap" style="display:flex;flex-wrap:wrap;gap:6px">';
      accounts.forEach(a => {
        html += '<label style="display:flex;align-items:center;gap:4px;cursor:pointer;font-size:12px;padding:4px 10px;border:1px solid var(--glass-border);border-radius:6px;background:var(--deep)">';
        html += '<input type="checkbox" class="j-account-cb" value="' + a.id + '" style="accent-color:var(--gold)"> ' + UI.esc(a.name);
        html += '</label>';
      });
      html += '</div></div>';
    }

    html += '<div><div class="form-label">Date</div><input type="date" class="form-input" id="j-date" value="' + (isEditing && firstEntry ? UI.esc(firstEntry.date) : UI.today()) + '"></div>';
    html += '<div><div class="form-label">P&L ($)</div><input type="text" class="form-input" id="j-pnl" placeholder="+275 or -150" value="' + (isEditing && firstEntry && firstEntry.pnl != null ? firstEntry.pnl : '') + '"></div>';
    html += '<div><div class="form-label">Entry Price</div><input type="text" class="form-input" id="j-entry-price" placeholder="21,450.25" value="' + (isEditing && firstEntry && firstEntry.entryPrice ? firstEntry.entryPrice : '') + '"></div>';
    html += '<div><div class="form-label">Exit Price</div><input type="text" class="form-input" id="j-exit-price" placeholder="21,462.50" value="' + (isEditing && firstEntry && firstEntry.exitPrice ? firstEntry.exitPrice : '') + '"></div>';
    html += '</div>';

    const initSymbol = isEditing && firstEntry && firstEntry.symbol ? firstEntry.symbol : 'MNQ';
    const initContracts = isEditing && firstEntry && firstEntry.contracts ? firstEntry.contracts : '';
    const feePerSide = FUTURES[initSymbol] ? FUTURES[initSymbol].fee : 0;
    const initFee = initContracts ? (parseFloat(initContracts) * feePerSide).toFixed(2) : '0.00';

    html += '<div style="display:grid;grid-template-columns:1fr 80px 90px 130px 130px 110px;gap:12px;margin-bottom:12px">';
    html += '<div><div class="form-label">Symbol</div><select class="form-input" id="j-symbol" onchange="Journal.updateFee()">' + Journal.symbolOptions().replace('value="' + initSymbol + '"', 'value="' + initSymbol + '" selected') + '</select></div>';
    html += '<div><div class="form-label">Contracts</div><input type="number" class="form-input" id="j-contracts" min="0" step="1" placeholder="1" value="' + initContracts + '" oninput="Journal.updateFee()"></div>';
    html += '<div><div class="form-label">Fees</div><div class="form-input" id="j-fees-display" style="background:var(--deep);color:var(--text-muted);cursor:default">$' + initFee + '</div></div>';
    html += '<div><div class="form-label">Entry Time</div><input type="text" class="form-input" id="j-entry-time" placeholder="e.g. 9:30 or 9.5" value="' + (isEditing && firstEntry ? UI.esc(firstEntry.entryTime || '') : '') + '"></div>';
    html += '<div><div class="form-label">Exit Time</div><input type="text" class="form-input" id="j-exit-time" placeholder="e.g. 10:15 or 10.25" value="' + (isEditing && firstEntry ? UI.esc(firstEntry.exitTime || '') : '') + '"></div>';
    html += '<div><div class="form-label">Traded By</div><select class="form-input" id="j-traded-by"><option value="manual"' + (isEditing && firstEntry && firstEntry.tradedBy === 'bot' ? '' : ' selected') + '>Manual</option><option value="bot"' + (isEditing && firstEntry && firstEntry.tradedBy === 'bot' ? ' selected' : '') + '>Bot</option></select></div>';
    html += '</div>';

    html += '<div style="margin-bottom:12px"><div class="form-label">Notes</div><textarea class="form-input" id="j-notes" rows="2" placeholder="What did you see? Why did you enter? What did you learn?" style="resize:vertical;min-height:42px">' + (isEditing && firstEntry ? UI.esc(firstEntry.notes || '') : '') + '</textarea></div>';

    html += '<div style="display:flex;justify-content:flex-end;gap:8px">';
    if (isEditing) {
      html += '<button class="btn btn-ghost btn-sm" onclick="Journal.cancelEdit()">Cancel</button>';
      html += '<button class="btn btn-primary btn-sm" onclick="Journal.saveEdit()">Update ' + Journal.selectedIds.length + ' Trade' + (Journal.selectedIds.length > 1 ? 's' : '') + '</button>';
    } else {
      html += '<button class="btn btn-ghost btn-sm" onclick="Journal.clearForm()">Clear</button>';
      html += '<button class="btn btn-primary btn-sm" onclick="Journal.saveEntry()">Log Trade</button>';
    }
    html += '</div></div>';

    // --- Filters ---
    html += '<div style="display:flex;gap:12px;align-items:center;margin-bottom:16px;flex-wrap:wrap">';
    ['all', 'topstep', 'apex', 'mff', 'alpha', 'lucid'].forEach(f => {
      const labels = { all: 'All Accounts', topstep: 'Topstep', apex: 'Apex', mff: 'MFF', alpha: 'Alpha', lucid: 'Lucid' };
      html += '<div class="filter-chip' + (Journal.filters.firm === f ? ' active' : '') + '" onclick="Journal.setFilter(\'firm\',\'' + f + '\')">' + labels[f] + '</div>';
    });
    html += '<span style="color:var(--text-muted)">|</span>';
    ['all', 'winners', 'losers'].forEach(f => {
      const label = f === 'all' ? 'All Trades' : f.charAt(0).toUpperCase() + f.slice(1);
      html += '<div class="filter-chip' + (Journal.filters.outcome === f ? ' active' : '') + '" onclick="Journal.setFilter(\'outcome\',\'' + f + '\')">' + label + '</div>';
    });
    html += '<span style="color:var(--text-muted)">|</span>';
    [['week','This Week'],['month','This Month'],['all','All Time']].forEach(([k,label]) => {
      html += '<div class="filter-chip' + (Journal.filters.range === k ? ' active' : '') + '" onclick="Journal.setFilter(\'range\',\'' + k + '\')">' + label + '</div>';
    });
    html += '</div>';

    // --- Selection toolbar ---
    if (Journal.selectedIds.length > 0 && !Journal.bulkEditMode) {
      html += '<div style="display:flex;align-items:center;gap:12px;padding:10px 16px;margin-bottom:12px;background:rgba(212,175,55,0.08);border:1px solid var(--gold-dim);border-radius:8px;font-size:13px">';
      html += '<span style="color:var(--gold);font-weight:600">' + Journal.selectedIds.length + ' selected</span>';
      html += '<button class="btn btn-primary btn-sm" onclick="Journal.startBulkEdit()" style="font-size:11px;padding:4px 12px">Edit Selected &#8593;</button>';
      html += '<button class="btn btn-ghost btn-sm" onclick="Journal.deleteSelected()" style="font-size:11px;padding:4px 12px;color:var(--red)">Delete Selected</button>';
      html += '<button class="btn btn-ghost btn-sm" onclick="Journal.clearSelection()" style="font-size:11px;padding:4px 12px">Clear</button>';
      html += '</div>';
    }

    // --- Apply filters ---
    const allAccounts = this._accounts;
    let filtered = this._entries.slice();

    if (Journal.filters.firm !== 'all') {
      const firmAccountIds = allAccounts.filter(a => a.firm === Journal.filters.firm).map(a => a.id);
      filtered = filtered.filter(e => firmAccountIds.includes(e.accountId));
    }
    if (Journal.filters.outcome === 'winners') filtered = filtered.filter(e => e.pnl > 0);
    if (Journal.filters.outcome === 'losers') filtered = filtered.filter(e => e.pnl < 0);

    const range = Rules.dateRange(Journal.filters.range);
    filtered = filtered.filter(e => e.date >= range.start && e.date <= range.end);

    filtered.sort((a, b) => {
      const dc = b.date.localeCompare(a.date);
      if (dc !== 0) return dc;
      return (b.createdAt || '').localeCompare(a.createdAt || '');
    });

    // --- Trade Table ---
    html += '<style>.jtbl > div > div{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}</style>';
    html += '<div class="panel" style="overflow-x:auto">';
    html += '<div class="jtbl" style="min-width:860px">';

    const colTpl = '30px 72px 130px 85px 68px 52px 78px 78px 52px 52px 1fr 40px';
    const allFilteredIds = filtered.map(e => e.id);
    const allSelected = filtered.length > 0 && allFilteredIds.every(id => Journal.selectedIds.includes(id));
    html += '<div style="display:grid;grid-template-columns:' + colTpl + ';padding:12px 16px;font-size:11px;text-transform:uppercase;letter-spacing:1px;color:var(--text-muted);border-bottom:1px solid var(--glass-border);background:var(--deep)">';
    html += '<div><input type="checkbox" ' + (allSelected ? 'checked' : '') + ' onchange="Journal.toggleSelectAll(this.checked)" style="accent-color:var(--gold);cursor:pointer"></div>';
    html += '<div>Date</div><div>Account</div><div>P&L</div><div>Qty</div><div>Fees</div><div>Entry</div><div>Exit</div><div>In</div><div>Out</div><div>Notes</div><div></div>';
    html += '</div>';

    if (filtered.length === 0) {
      html += '<div style="padding:40px;text-align:center;color:var(--text-muted);font-size:13px">No trades match your filters</div>';
    }

    filtered.forEach(entry => {
      const acct = Journal._getAccount(entry.accountId);
      const isExpanded = Journal.expandedId === entry.id;
      const isSelected = Journal.selectedIds.includes(entry.id);
      const contracts = entry.contracts || 0;
      const sym = entry.symbol || '';
      const feeRate = FUTURES[sym] ? FUTURES[sym].fee : 0;
      const fees = (contracts * feeRate).toFixed(2);
      const qtyLabel = contracts ? contracts + (sym ? ' ' + sym : '') : '-';

      html += '<div class="journal-row" style="display:grid;grid-template-columns:' + colTpl + ';padding:14px 16px;font-size:13px;border-bottom:1px solid var(--glass-border);align-items:center;cursor:pointer' + (isSelected ? ';background:rgba(212,175,55,0.05)' : '') + '" onclick="Journal.toggleExpand(\'' + entry.id + '\')">';
      html += '<div onclick="event.stopPropagation()"><input type="checkbox" ' + (isSelected ? 'checked' : '') + ' onchange="Journal.toggleSelect(\'' + entry.id + '\')" style="accent-color:var(--gold);cursor:pointer"></div>';
      html += '<div>' + UI.formatDate(entry.date) + '</div>';
      html += '<div style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis" title="' + (acct ? UI.esc(acct.name) : 'Unknown') + '">' + (acct ? UI.firmBadgeHtml(acct.firm) + ' ' + UI.esc(acct.name) : 'Unknown') + '</div>';
      html += '<div style="font-weight:500;' + UI.pnlClass(entry.pnl) + '">' + UI.currencySign(entry.pnl) + (entry.tradedBy === 'bot' ? ' <span style="font-size:9px;padding:1px 4px;border-radius:3px;background:rgba(139,92,246,0.15);color:var(--violet);font-weight:500">BOT</span>' : '') + '</div>';
      html += '<div style="color:var(--text-secondary);font-size:12px">' + UI.esc(qtyLabel) + '</div>';
      html += '<div style="color:var(--text-muted);font-size:11px">' + (contracts ? '$' + fees : '-') + '</div>';
      html += '<div>' + UI.formatPrice(entry.entryPrice) + '</div>';
      html += '<div>' + UI.formatPrice(entry.exitPrice) + '</div>';
      html += '<div>' + UI.esc(entry.entryTime || '-') + '</div>';
      html += '<div>' + UI.esc(entry.exitTime || '-') + '</div>';
      html += '<div style="padding-left:8px;color:var(--text-secondary);font-size:12px">' + UI.esc(entry.notes || '') + '</div>';
      html += '<div style="display:flex;gap:2px">';
      html += '<span style="cursor:pointer;padding:2px 4px;color:var(--text-muted);font-size:12px;transition:color 0.2s;opacity:0.5" onmouseenter="this.style.opacity=1;this.style.color=\'var(--gold)\'" onmouseleave="this.style.opacity=0.5;this.style.color=\'var(--text-muted)\'" onclick="event.stopPropagation();Journal.editEntry(\'' + entry.id + '\')">&#9998;</span>';
      html += '<span style="cursor:pointer;padding:2px 4px;color:var(--text-muted);font-size:12px;transition:color 0.2s;opacity:0.5" onmouseenter="this.style.opacity=1;this.style.color=\'var(--red)\'" onmouseleave="this.style.opacity=0.5;this.style.color=\'var(--text-muted)\'" onclick="event.stopPropagation();Journal.deleteEntry(\'' + entry.id + '\')">&#128465;</span>';
      html += '</div></div>';

      if (isExpanded && entry.notes) {
        html += '<div style="padding:0 16px 12px;animation:slideDown 0.25s cubic-bezier(0.4,0,0.2,1) both"><div style="padding:16px;background:var(--deep);border-radius:8px;font-size:13px;line-height:1.7;color:var(--text-secondary);border-left:2px solid var(--gold-dim)">' + UI.esc(entry.notes) + '</div></div>';
      }
    });

    // --- Footer stats ---
    const netPnl = filtered.reduce((s, e) => s + e.pnl, 0);
    const totalFees = filtered.reduce((s, e) => {
      const c = e.contracts || 0;
      const r = FUTURES[e.symbol] ? FUTURES[e.symbol].fee : 0;
      return s + c * r;
    }, 0);
    const fWins = filtered.filter(e => e.pnl > 0);
    const fLosses = filtered.filter(e => e.pnl < 0);
    const fWinRate = filtered.length > 0 ? fWins.length / filtered.length : 0;
    const fGrossWin = fWins.reduce((s, e) => s + e.pnl, 0);
    const fGrossLoss = Math.abs(fLosses.reduce((s, e) => s + e.pnl, 0));
    const fPF = fGrossLoss > 0 ? fGrossWin / fGrossLoss : (fGrossWin > 0 ? Infinity : 0);

    html += '<div style="display:flex;gap:24px;padding:12px 16px;background:var(--deep);border-top:1px solid var(--glass-border);font-size:12px;color:var(--text-secondary);flex-wrap:wrap">';
    html += '<span>Showing <span style="color:var(--text);font-weight:500">' + filtered.length + '</span> trades</span>';
    html += '<span>Net P&L: <span style="color:' + UI.pnlColor(netPnl) + ';font-weight:500">' + UI.currencySign(netPnl) + '</span></span>';
    html += '<span>Fees: <span style="color:var(--text-muted);font-weight:500">$' + totalFees.toFixed(2) + '</span></span>';
    html += '<span>Net After Fees: <span style="color:' + UI.pnlColor(netPnl - totalFees) + ';font-weight:500">' + UI.currencySign(netPnl - totalFees) + '</span></span>';
    html += '<span>Win Rate: <span style="color:var(--text);font-weight:500">' + UI.pct(fWinRate * 100) + '</span></span>';
    html += '<span>PF: <span style="color:var(--text);font-weight:500">' + (fPF === Infinity ? '&#8734;' : fPF.toFixed(2)) + '</span></span>';
    html += '</div>';

    html += '</div></div>';

    el.innerHTML = html;
  },

  updateFee() {
    const sym = document.getElementById('j-symbol').value;
    const contracts = parseFloat(document.getElementById('j-contracts').value) || 0;
    const rate = FUTURES[sym] ? FUTURES[sym].fee : 0;
    document.getElementById('j-fees-display').textContent = '$' + (contracts * rate).toFixed(2);
  },

  parseNumber(str) {
    if (!str) return 0;
    return parseFloat(str.replace(/[,$\s+]/g, '')) || 0;
  },

  _readForm() {
    return {
      date: document.getElementById('j-date').value,
      pnl: Journal.parseNumber(document.getElementById('j-pnl').value),
      symbol: document.getElementById('j-symbol').value,
      contracts: parseInt(document.getElementById('j-contracts').value) || 0,
      entryPrice: Journal.parseNumber(document.getElementById('j-entry-price').value),
      exitPrice: Journal.parseNumber(document.getElementById('j-exit-price').value),
      entryTime: document.getElementById('j-entry-time').value.trim(),
      exitTime: document.getElementById('j-exit-time').value.trim(),
      tradedBy: document.getElementById('j-traded-by').value,
      notes: document.getElementById('j-notes').value.trim(),
    };
  },

  async saveEntry() {
    const f = Journal._readForm();
    const rate = FUTURES[f.symbol] ? FUTURES[f.symbol].fee : 0;
    f.fees = parseFloat((f.contracts * rate).toFixed(2));

    const checked = document.querySelectorAll('.j-account-cb:checked');
    const accountIds = Array.from(checked).map(cb => cb.value);
    if (accountIds.length === 0 || !f.date) { alert('Select at least one account and a date.'); return; }

    try {
      const entries = accountIds.map(accountId => ({ ...f, accountId }));
      if (entries.length === 1) {
        await API.createEntry(entries[0]);
      } else {
        await API.createEntries(entries);
      }
      await Journal.render(document.getElementById('content'));
    } catch (err) {
      alert('Failed to save: ' + err.message);
    }
  },

  async saveEdit() {
    const accountVal = document.getElementById('j-account').value;
    const keepAccount = accountVal === '__keep__';
    const f = Journal._readForm();
    const rate = FUTURES[f.symbol] ? FUTURES[f.symbol].fee : 0;
    f.fees = parseFloat((f.contracts * rate).toFixed(2));

    if ((!keepAccount && !accountVal) || !f.date) { alert('Account and date are required.'); return; }

    try {
      for (const id of Journal.selectedIds) {
        const existing = Journal._getEntry(id);
        const acctId = keepAccount && existing ? existing.accountId : accountVal;
        await API.updateEntry(id, { ...f, accountId: acctId });
      }
      Journal.selectedIds = [];
      Journal.bulkEditMode = false;
      await Journal.render(document.getElementById('content'));
    } catch (err) {
      alert('Failed to update: ' + err.message);
    }
  },

  clearForm() {
    document.getElementById('j-date').value = UI.today();
    document.getElementById('j-pnl').value = '';
    document.getElementById('j-symbol').value = 'MNQ';
    document.getElementById('j-contracts').value = '';
    document.getElementById('j-fees-display').textContent = '$0.00';
    document.getElementById('j-entry-price').value = '';
    document.getElementById('j-exit-price').value = '';
    document.getElementById('j-entry-time').value = '';
    document.getElementById('j-exit-time').value = '';
    document.getElementById('j-traded-by').value = 'manual';
    document.getElementById('j-notes').value = '';
    document.querySelectorAll('.j-account-cb').forEach(cb => { cb.checked = false; });
  },

  cancelEdit() {
    Journal.selectedIds = [];
    Journal.bulkEditMode = false;
    Journal._buildView(document.getElementById('content'));
  },

  editEntry(id) {
    Journal.selectedIds = [id];
    Journal.bulkEditMode = true;
    Journal._buildView(document.getElementById('content'));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  },

  toggleSelect(id) {
    const idx = Journal.selectedIds.indexOf(id);
    if (idx >= 0) {
      Journal.selectedIds.splice(idx, 1);
    } else {
      Journal.selectedIds.push(id);
    }
    if (Journal.selectedIds.length === 0) {
      Journal.bulkEditMode = false;
    }
    Journal._buildView(document.getElementById('content'));
  },

  toggleSelectAll(checked) {
    let filtered = Journal._entries.slice();
    const allAccounts = Journal._accounts;

    if (Journal.filters.firm !== 'all') {
      const firmAccountIds = allAccounts.filter(a => a.firm === Journal.filters.firm).map(a => a.id);
      filtered = filtered.filter(e => firmAccountIds.includes(e.accountId));
    }
    if (Journal.filters.outcome === 'winners') filtered = filtered.filter(e => e.pnl > 0);
    if (Journal.filters.outcome === 'losers') filtered = filtered.filter(e => e.pnl < 0);
    const range = Rules.dateRange(Journal.filters.range);
    filtered = filtered.filter(e => e.date >= range.start && e.date <= range.end);

    if (checked) {
      Journal.selectedIds = filtered.map(e => e.id);
    } else {
      Journal.selectedIds = [];
      Journal.bulkEditMode = false;
    }
    Journal._buildView(document.getElementById('content'));
  },

  startBulkEdit() {
    Journal.bulkEditMode = true;
    Journal._buildView(document.getElementById('content'));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  },

  clearSelection() {
    Journal.selectedIds = [];
    Journal.bulkEditMode = false;
    Journal._buildView(document.getElementById('content'));
  },

  async deleteSelected() {
    if (confirm('Delete ' + Journal.selectedIds.length + ' selected trade(s)?')) {
      try {
        for (const id of Journal.selectedIds) {
          await API.deleteEntry(id);
        }
        Journal.selectedIds = [];
        Journal.bulkEditMode = false;
        await Journal.render(document.getElementById('content'));
      } catch (err) {
        alert('Failed to delete: ' + err.message);
      }
    }
  },

  async deleteEntry(id) {
    if (confirm('Delete this trade entry?')) {
      try {
        await API.deleteEntry(id);
        Journal.selectedIds = Journal.selectedIds.filter(sid => sid !== id);
        await Journal.render(document.getElementById('content'));
      } catch (err) {
        alert('Failed to delete: ' + err.message);
      }
    }
  },

  toggleExpand(id) {
    Journal.expandedId = Journal.expandedId === id ? null : id;
    Journal._buildView(document.getElementById('content'));
  },

  setFilter(key, value) {
    Journal.filters[key] = value;
    Journal._buildView(document.getElementById('content'));
  },
};
