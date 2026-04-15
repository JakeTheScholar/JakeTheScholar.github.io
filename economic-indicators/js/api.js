"use strict";

const API = {
  // Free FRED API key — register your own at https://fred.stlouisfed.org/docs/api/api_key.html
  FRED_KEY: 'a53372ac8a600c7ccf48ccb1606c2712',
  FRED_BASE: 'https://api.stlouisfed.org/fred',

  _pending: {},
  _fallbackCache: null,
  _useFallback: false,
  _DATE_RE: /^\d{4}-\d{2}-\d{2}$/,
  _SERIES_RE: /^[A-Z0-9_]{1,30}$/,

  _isValidDate(str) {
    return typeof str === 'string' && this._DATE_RE.test(str);
  },

  _isValidSeries(id) {
    return typeof id === 'string' && this._SERIES_RE.test(id) && Indicators.get(id) != null;
  },

  async loadFallbackCache() {
    if (this._fallbackCache) return this._fallbackCache;
    try {
      const res = await fetch('data/cache.json');
      if (res.ok) {
        this._fallbackCache = await res.json();
        return this._fallbackCache;
      }
    } catch { /* ignore */ }
    return null;
  },

  _getFallback(seriesId) {
    if (!this._fallbackCache || !this._fallbackCache[seriesId]) return null;
    return this._fallbackCache[seriesId];
  },

  async fetchFRED(seriesId, opts = {}) {
    if (!this._isValidSeries(seriesId)) throw new Error('Invalid series ID');

    // If we already know FRED is unreachable (CORS blocked), go straight to cache
    if (this._useFallback) {
      const fallback = this._getFallback(seriesId);
      if (fallback) return fallback;
      throw new Error('No cached data for ' + seriesId);
    }

    const {
      startDate,
      endDate,
      limit = 10000,
      sortOrder = 'asc',
    } = opts;

    // Check cache first
    const cacheKey = `fred_${seriesId}_${startDate || 'all'}_${endDate || 'now'}`;
    const cached = Store.get(cacheKey);
    if (cached) return cached;

    // Dedupe in-flight requests
    if (this._pending[cacheKey]) return this._pending[cacheKey];

    const params = new URLSearchParams({
      series_id: seriesId,
      api_key: this.FRED_KEY,
      file_type: 'json',
      sort_order: sortOrder,
      limit: String(limit),
    });
    if (startDate) params.set('observation_start', startDate);
    if (endDate) params.set('observation_end', endDate);

    const url = `${this.FRED_BASE}/series/observations?${params}`;

    this._pending[cacheKey] = (async () => {
      try {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`FRED ${res.status}: ${res.statusText}`);
        const json = await res.json();

        const observations = (json.observations || [])
          .filter(o => o.value !== '.' && API._isValidDate(o.date) && isFinite(parseFloat(o.value)))
          .map(o => ({
            date: o.date,
            value: parseFloat(o.value),
          }));

        // Cache for 1 hour (daily/weekly data) or 4 hours (monthly/quarterly)
        const indicator = Indicators.get(seriesId);
        const ttl = indicator && (indicator.frequency === 'Daily' || indicator.frequency === 'Weekly')
          ? 60 * 60 * 1000
          : 4 * 60 * 60 * 1000;

        Store.set(cacheKey, observations, ttl);
        return observations;
      } catch (err) {
        // Switch to fallback mode on first failure (CORS block, network error, etc.)
        this._useFallback = true;
        const fallback = this._getFallback(seriesId);
        if (fallback) return fallback;
        throw err;
      } finally {
        delete this._pending[cacheKey];
      }
    })();

    return this._pending[cacheKey];
  },

  async fetchLatest(seriesId, count = 2) {
    if (!this._isValidSeries(seriesId)) throw new Error('Invalid series ID');

    // Use fallback cache directly if FRED is unreachable
    if (this._useFallback) {
      const fallback = this._getFallback(seriesId);
      if (fallback && fallback.length > 0) return fallback.slice(-count);
      throw new Error('No cached data for ' + seriesId);
    }

    const cacheKey = `latest_${seriesId}`;
    const cached = Store.get(cacheKey);
    if (cached) return cached;

    const params = new URLSearchParams({
      series_id: seriesId,
      api_key: this.FRED_KEY,
      file_type: 'json',
      sort_order: 'desc',
      limit: String(count),
    });

    const url = `${this.FRED_BASE}/series/observations?${params}`;

    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`FRED ${res.status}`);
      const json = await res.json();

      const observations = (json.observations || [])
        .filter(o => o.value !== '.' && API._isValidDate(o.date) && isFinite(parseFloat(o.value)))
        .map(o => ({
          date: o.date,
          value: parseFloat(o.value),
        }))
        .reverse(); // oldest first

      Store.set(cacheKey, observations, 60 * 60 * 1000);
      return observations;
    } catch (err) {
      this._useFallback = true;
      const fallback = this._getFallback(seriesId);
      if (fallback && fallback.length > 0) return fallback.slice(-count);
      throw err;
    }
  },

  async fetchSparkline(seriesId, points = 24) {
    const indicator = Indicators.get(seriesId);
    let startDate;
    switch (indicator?.frequency) {
      case 'Daily':
      case 'Weekly':
        startDate = UI.dateSubtract(1);
        break;
      case 'Quarterly':
        startDate = UI.dateSubtract(6);
        break;
      default:
        startDate = UI.dateSubtract(2);
    }

    const data = await this.fetchFRED(seriesId, { startDate });
    // Downsample to target number of points
    if (data.length <= points) return data;
    const step = Math.floor(data.length / points);
    const sampled = [];
    for (let i = 0; i < data.length; i += step) {
      sampled.push(data[i]);
    }
    // Always include the last point
    if (sampled[sampled.length - 1] !== data[data.length - 1]) {
      sampled.push(data[data.length - 1]);
    }
    return sampled;
  },

  async fetchAllLatest() {
    const ids = Indicators.displayOrder;
    const results = {};
    const promises = ids.map(async (id) => {
      try {
        const obs = await this.fetchLatest(id, 2);
        results[id] = obs;
      } catch {
        results[id] = null;
      }
    });
    await Promise.all(promises);
    return results;
  },

  async fetchRange(seriesId, range) {
    let startDate;
    switch (range) {
      case '1Y': startDate = UI.dateSubtract(1); break;
      case '5Y': startDate = UI.dateSubtract(5); break;
      case '10Y': startDate = UI.dateSubtract(10); break;
      case '20Y': startDate = UI.dateSubtract(20); break;
      case 'MAX': startDate = '1960-01-01'; break;
      default: startDate = UI.dateSubtract(10);
    }
    return this.fetchFRED(seriesId, { startDate });
  },
};
