"use strict";

const Store = {
  PREFIX: 'tid_',
  DEFAULT_TTL: 15 * 60 * 1000, // 15 minutes

  _key(id) { return this.PREFIX + id; },

  _jsonReviver(key, value) {
    if (key === '__proto__' || key === 'constructor' || key === 'prototype') return undefined;
    return value;
  },

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

  set(id, data, ttl) {
    try {
      localStorage.setItem(this._key(id), JSON.stringify({
        data,
        expires: Date.now() + (ttl || this.DEFAULT_TTL),
      }));
    } catch (e) {
      if (e.name === 'QuotaExceededError') this.clearExpired();
    }
  },

  clearExpired() {
    const now = Date.now();
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const key = localStorage.key(i);
      if (!key || !key.startsWith(this.PREFIX)) continue;
      try {
        const entry = JSON.parse(localStorage.getItem(key));
        if (entry.expires && now > entry.expires) localStorage.removeItem(key);
      } catch { localStorage.removeItem(key); }
    }
  },
};
