"use strict";

const Store = {
  _get(key) {
    try { return JSON.parse(localStorage.getItem('tcc_' + key)) || []; }
    catch { return []; }
  },
  _set(key, val) {
    try {
      localStorage.setItem('tcc_' + key, JSON.stringify(val));
    } catch (e) {
      if (e.name === 'QuotaExceededError') {
        alert('Storage full. Export your data and clear old entries.');
      }
      throw e;
    }
  },
  _uuid() {
    return crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2);
  },

  // === Accounts ===
  getAccounts() { return this._get('accounts'); },
  getAccount(id) { return this.getAccounts().find(a => a.id === id) || null; },
  saveAccount(data) {
    data = this._sanitize(data);
    const all = this.getAccounts();
    if (data.id) {
      const i = all.findIndex(a => a.id === data.id);
      if (i >= 0) { all[i] = { ...all[i], ...data }; }
      else { all.push(data); }
    } else {
      data.id = this._uuid();
      data.createdAt = new Date().toISOString();
      data.archivedAt = null;
      all.push(data);
    }
    this._set('accounts', all);
    return data;
  },
  archiveAccount(id) {
    const all = this.getAccounts();
    const i = all.findIndex(a => a.id === id);
    if (i >= 0) {
      all[i].status = 'archived';
      all[i].archivedAt = new Date().toISOString();
      this._set('accounts', all);
    }
  },
  deleteAccount(id) {
    this._set('accounts', this.getAccounts().filter(a => a.id !== id));
    this._set('journal', this.getJournal().filter(j => j.accountId !== id));
    this._set('payouts', this.getPayouts().filter(p => p.accountId !== id));
  },

  // === Journal Entries ===
  getJournal() { return this._get('journal'); },
  getEntry(id) { return this.getJournal().find(j => j.id === id) || null; },
  getEntriesForAccount(accountId) {
    return this.getJournal().filter(j => j.accountId === accountId);
  },
  saveEntry(data) {
    data = this._sanitize(data);
    const all = this.getJournal();
    if (data.id) {
      const i = all.findIndex(j => j.id === data.id);
      if (i >= 0) { all[i] = { ...all[i], ...data }; }
      else { all.push(data); }
    } else {
      data.id = this._uuid();
      data.createdAt = new Date().toISOString();
      all.push(data);
    }
    this._set('journal', all);
    return data;
  },
  deleteEntry(id) {
    this._set('journal', this.getJournal().filter(j => j.id !== id));
  },

  // === Payouts ===
  getPayouts() { return this._get('payouts'); },
  getPayout(id) { return this.getPayouts().find(p => p.id === id) || null; },
  getPayoutsForAccount(accountId) {
    return this.getPayouts().filter(p => p.accountId === accountId);
  },
  savePayout(data) {
    data = this._sanitize(data);
    const all = this.getPayouts();
    if (data.id) {
      const i = all.findIndex(p => p.id === data.id);
      if (i >= 0) { all[i] = { ...all[i], ...data }; }
      else { all.push(data); }
    } else {
      data.id = this._uuid();
      data.createdAt = new Date().toISOString();
      all.push(data);
    }
    this._set('payouts', all);
    return data;
  },
  deletePayout(id) {
    this._set('payouts', this.getPayouts().filter(p => p.id !== id));
  },

  // === Export/Import ===
  exportAll() {
    return {
      version: 1,
      exportedAt: new Date().toISOString(),
      accounts: this.getAccounts(),
      journal: this.getJournal(),
      payouts: this.getPayouts(),
    };
  },

  _isObj(v) { return v && typeof v === 'object' && !Array.isArray(v); },
  _isStr(v, max) { return typeof v === 'string' && (!max || v.length <= max); },
  _isNum(v) { return typeof v === 'number' && isFinite(v); },
  _isId(v) { return typeof v === 'string' && v.length <= 100 && /^[\w-]+$/.test(v); },

  // Strip prototype pollution keys from an object
  _sanitize(obj) {
    if (!obj || typeof obj !== 'object') return obj;
    const clean = {};
    for (const key of Object.keys(obj)) {
      if (key === '__proto__' || key === 'constructor' || key === 'prototype') continue;
      clean[key] = obj[key];
    }
    return clean;
  },

  _validateAccount(a) {
    return this._isObj(a) && this._isStr(a.name, 200) &&
      ['apex', 'topstep', 'mff', 'alpha', 'lucid'].includes(a.firm) &&
      ['eval', 'funded', 'live'].includes(a.phase) &&
      ['active', 'archived'].includes(a.status) &&
      this._isNum(a.startingBalance) && Math.abs(a.startingBalance) <= 1e9 &&
      (!a.id || this._isId(a.id)) &&
      (!a.tradedBy || ['manual', 'bot'].includes(a.tradedBy)) &&
      (!a.subtype || ['normal', 'consistency', 'core', 'rapid'].includes(a.subtype)) &&
      (!a.rules || this._isStr(a.rules, 100)) &&
      (!a.trailingDrawdown || (this._isNum(a.trailingDrawdown) && a.trailingDrawdown >= 0 && a.trailingDrawdown <= 1e9));
  },
  _validateEntry(e) {
    return this._isObj(e) && this._isId(e.accountId) &&
      this._isStr(e.date, 10) && /^\d{4}-\d{2}-\d{2}$/.test(e.date) &&
      this._isNum(e.pnl) && Math.abs(e.pnl) <= 1e9 &&
      (!e.notes || this._isStr(e.notes, 5000)) &&
      (!e.id || this._isId(e.id)) &&
      (!e.entryTime || this._isStr(e.entryTime, 10)) &&
      (!e.exitTime || this._isStr(e.exitTime, 10)) &&
      (!e.entryPrice || (this._isNum(e.entryPrice) && Math.abs(e.entryPrice) <= 1e9)) &&
      (!e.exitPrice || (this._isNum(e.exitPrice) && Math.abs(e.exitPrice) <= 1e9)) &&
      (!e.tradedBy || ['manual', 'bot'].includes(e.tradedBy)) &&
      (!e.contracts || (this._isNum(e.contracts) && e.contracts >= 0 && e.contracts <= 10000)) &&
      (!e.fees || (this._isNum(e.fees) && e.fees >= 0 && e.fees <= 1e6)) &&
      (!e.symbol || this._isStr(e.symbol, 10));
  },
  _validatePayout(p) {
    return this._isObj(p) && this._isId(p.accountId) &&
      this._isStr(p.date, 10) && /^\d{4}-\d{2}-\d{2}$/.test(p.date) &&
      this._isNum(p.amount) && p.amount > 0 && p.amount <= 1e9 &&
      (!p.note || this._isStr(p.note, 1000)) &&
      (!p.id || this._isId(p.id));
  },

  importAll(data) {
    if (!this._isObj(data)) return false;
    if (!Array.isArray(data.accounts) || !Array.isArray(data.journal)) return false;
    if (data.accounts.length > 10000 || data.journal.length > 100000) return false;
    if (!data.accounts.every(a => this._validateAccount(a))) return false;
    if (!data.journal.every(e => this._validateEntry(e))) return false;
    if (data.payouts && !Array.isArray(data.payouts)) return false;
    if (data.payouts && data.payouts.length > 50000) return false;
    if (data.payouts && !data.payouts.every(p => this._validatePayout(p))) return false;
    // Sanitize all objects to prevent prototype pollution
    this._set('accounts', data.accounts.map(a => this._sanitize(a)));
    this._set('journal', data.journal.map(e => this._sanitize(e)));
    this._set('payouts', data.payouts ? data.payouts.map(p => this._sanitize(p)) : []);
    return true;
  },
};
