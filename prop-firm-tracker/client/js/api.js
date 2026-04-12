"use strict";

// API client — replaces localStorage Store with fetch calls to Express server

const API = {
  _base: '/api',

  _snakeToCamel(str) {
    return str.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
  },

  _NUMERIC: new Set([
    'pnl', 'startingBalance', 'trailingDrawdown', 'entryPrice', 'exitPrice',
    'fees', 'contracts', 'amount',
  ]),

  _normalize(obj) {
    if (Array.isArray(obj)) return obj.map(item => this._normalize(item));
    if (obj !== null && typeof obj === 'object') {
      const out = {};
      for (const key of Object.keys(obj)) {
        const camelKey = this._snakeToCamel(key);
        let val = obj[key];
        if (this._NUMERIC.has(camelKey) && val !== null && val !== undefined) {
          val = Number(val);
        }
        out[camelKey] = val;
      }
      return out;
    }
    return obj;
  },

  async _fetch(path, opts = {}) {
    const token = Auth.getToken();
    if (!token) {
      window.location.href = '/auth.html';
      throw new Error('Not authenticated');
    }

    const res = await fetch(this._base + path, {
      ...opts,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + token,
        ...(opts.headers || {}),
      },
    });

    if (res.status === 401) {
      // Token expired — redirect to login
      Auth.signOut();
      window.location.href = '/auth.html';
      throw new Error('Session expired');
    }

    const json = await res.json();
    if (!res.ok) throw new Error(json.error || `Request failed (${res.status})`);
    return this._normalize(json);
  },

  // ═══ Accounts ═══

  async getAccounts() {
    return this._fetch('/accounts');
  },

  async getAccount(id) {
    const accounts = await this.getAccounts();
    return accounts.find(a => a.id === id) || null;
  },

  async createAccount(data) {
    return this._fetch('/accounts', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async updateAccount(id, data) {
    return this._fetch('/accounts/' + encodeURIComponent(id), {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  async deleteAccount(id) {
    return this._fetch('/accounts/' + encodeURIComponent(id), {
      method: 'DELETE',
    });
  },

  // ═══ Journal ═══

  async getJournal() {
    return this._fetch('/journal');
  },

  async getEntriesForAccount(accountId) {
    return this._fetch('/accounts/' + encodeURIComponent(accountId) + '/journal');
  },

  async createEntry(data) {
    return this._fetch('/journal', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async createEntries(entries) {
    return this._fetch('/journal', {
      method: 'POST',
      body: JSON.stringify(entries),
    });
  },

  async updateEntry(id, data) {
    return this._fetch('/journal/' + encodeURIComponent(id), {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  async deleteEntry(id) {
    return this._fetch('/journal/' + encodeURIComponent(id), {
      method: 'DELETE',
    });
  },

  // ═══ Payouts ═══

  async getPayouts() {
    return this._fetch('/payouts');
  },

  async getPayoutsForAccount(accountId) {
    return this._fetch('/accounts/' + encodeURIComponent(accountId) + '/payouts');
  },

  async createPayout(data) {
    return this._fetch('/payouts', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async deletePayout(id) {
    return this._fetch('/payouts/' + encodeURIComponent(id), {
      method: 'DELETE',
    });
  },

  // ═══ Stats ═══

  async getAccountStats(accountId) {
    return this._fetch('/accounts/' + encodeURIComponent(accountId) + '/stats');
  },

  async getDashboard() {
    return this._fetch('/dashboard');
  },

  // ═══ Import / Export ═══

  async importData(data) {
    return this._fetch('/import', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async exportData() {
    return this._fetch('/export');
  },
};
