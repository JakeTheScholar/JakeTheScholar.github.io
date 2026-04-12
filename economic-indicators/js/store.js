"use strict";

const Store = {
  PREFIX: 'eid_',
  DEFAULT_TTL: 60 * 60 * 1000, // 1 hour

  _key(id) { return this.PREFIX + id; },

  get(id) {
    try {
      const raw = localStorage.getItem(this._key(id));
      if (!raw) return null;
      const entry = JSON.parse(raw, this._jsonReviver);
      if (entry.expires && Date.now() > entry.expires) {
        localStorage.removeItem(this._key(id));
        return null;
      }
      return entry.data;
    } catch { return null; }
  },

  // Reject prototype pollution keys during JSON.parse
  _jsonReviver(key, value) {
    if (key === '__proto__' || key === 'constructor' || key === 'prototype') return undefined;
    return value;
  },

  set(id, data, ttl) {
    try {
      const entry = {
        data,
        expires: Date.now() + (ttl || this.DEFAULT_TTL),
        storedAt: Date.now(),
      };
      localStorage.setItem(this._key(id), JSON.stringify(entry));
    } catch (e) {
      if (e.name === 'QuotaExceededError') this.clearExpired();
    }
  },

  remove(id) {
    localStorage.removeItem(this._key(id));
  },

  clearExpired() {
    const now = Date.now();
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const key = localStorage.key(i);
      if (!key || !key.startsWith(this.PREFIX)) continue;
      try {
        const entry = JSON.parse(localStorage.getItem(key));
        if (entry.expires && now > entry.expires) {
          localStorage.removeItem(key);
        }
      } catch { localStorage.removeItem(key); }
    }
  },

  clearAll() {
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const key = localStorage.key(i);
      if (key && key.startsWith(this.PREFIX)) {
        localStorage.removeItem(key);
      }
    }
  },
};
