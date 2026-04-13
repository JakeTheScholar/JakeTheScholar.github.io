"use strict";

const API = {
  NVD_BASE: 'https://services.nvd.nist.gov/rest/json/cves/2.0',
  PROXY_URL: 'https://tid-proxy-production.up.railway.app',

  _proxyAvailable: null,
  _fallbackData: null,

  async init() {
    // Load fallback sample data
    try {
      const [cves, ip] = await Promise.all([
        fetch('data/sample-cves.json').then(r => r.ok ? r.json() : null).catch(() => null),
        fetch('data/sample-ip.json').then(r => r.ok ? r.json() : null).catch(() => null),
      ]);
      this._fallbackData = { cves, ip };
    } catch { /* ignore */ }

    // Check proxy availability
    if (this.PROXY_URL) {
      try {
        const res = await fetch(this.PROXY_URL + '/api/health', { signal: AbortSignal.timeout(5000) });
        this._proxyAvailable = res.ok;
      } catch {
        this._proxyAvailable = false;
      }
    } else {
      this._proxyAvailable = false;
    }

    if (!this._proxyAvailable) {
      document.getElementById('demo-badge').style.display = 'inline-block';
    }
  },

  // ═══ NVD CVE API (direct from browser, no auth) ═══

  async fetchCVEs(opts = {}) {
    const {
      keyword = '',
      severity = '',
      startIndex = 0,
      resultsPerPage = 20,
    } = opts;

    const cacheKey = `cves_${keyword}_${severity}_${startIndex}`;
    const cached = Store.get(cacheKey);
    if (cached) return cached;

    const params = new URLSearchParams({
      startIndex: String(startIndex),
      resultsPerPage: String(Math.min(resultsPerPage, 100)),
    });

    if (keyword) params.set('keywordSearch', keyword);
    if (severity && ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].includes(severity)) {
      params.set('cvssV3Severity', severity);
    }

    // Default: last 30 days
    const start = new Date();
    start.setDate(start.getDate() - 30);
    params.set('pubStartDate', start.toISOString());
    params.set('pubEndDate', new Date().toISOString());

    try {
      const res = await fetch(`${this.NVD_BASE}?${params}`);
      if (!res.ok) throw new Error(`NVD ${res.status}`);
      const json = await res.json();

      const result = {
        totalResults: json.totalResults || 0,
        vulnerabilities: (json.vulnerabilities || []).map(v => this._normalizeCVE(v)),
      };

      Store.set(cacheKey, result, 15 * 60 * 1000);
      return result;
    } catch (err) {
      console.error('API.fetchCVEs:', err);
      // Fallback to sample data
      if (this._fallbackData?.cves) {
        return this._fallbackData.cves;
      }
      throw err;
    }
  },

  async fetchRecentCritical() {
    const cacheKey = 'recent_critical';
    const cached = Store.get(cacheKey);
    if (cached) return cached;

    try {
      const result = await this.fetchCVEs({ severity: 'CRITICAL', resultsPerPage: 5 });
      Store.set(cacheKey, result.vulnerabilities, 15 * 60 * 1000);
      return result.vulnerabilities;
    } catch {
      return this._fallbackData?.cves?.vulnerabilities?.filter(v => v.severity === 'CRITICAL').slice(0, 5) || [];
    }
  },

  _normalizeCVE(vuln) {
    const cve = vuln.cve || {};
    const metrics = cve.metrics || {};

    // Extract CVSS v3.1 or v3.0 score
    let score = null;
    let severity = 'NONE';
    const cvss31 = metrics.cvssMetricV31?.[0]?.cvssData;
    const cvss30 = metrics.cvssMetricV30?.[0]?.cvssData;
    const cvssData = cvss31 || cvss30;
    if (cvssData) {
      score = cvssData.baseScore;
      severity = cvssData.baseSeverity || 'NONE';
    }

    // Get english description
    const desc = (cve.descriptions || []).find(d => d.lang === 'en');

    return {
      id: cve.id || '',
      description: desc?.value || 'No description available.',
      score,
      severity: severity.toUpperCase(),
      published: cve.published || '',
      lastModified: cve.lastModified || '',
    };
  },

  // ═══ IP Lookup (via proxy) ═══

  async checkIP(ip) {
    if (!UI.isValidIP(ip)) throw new Error('Invalid IP address');

    const cacheKey = `ip_${ip}`;
    const cached = Store.get(cacheKey);
    if (cached) return cached;

    if (!this._proxyAvailable) {
      // Return sample data
      const sample = this._fallbackData?.ip || {
        ipAddress: ip,
        abuseConfidenceScore: 0,
        isp: 'Demo Mode',
        domain: 'example.com',
        countryCode: 'US',
        countryName: 'United States',
        totalReports: 0,
        lastReportedAt: null,
        isWhitelisted: false,
        usageType: 'Unknown',
      };
      sample.ipAddress = ip;
      sample._demo = true;
      return sample;
    }

    try {
      const res = await fetch(`${this.PROXY_URL}/api/ip/${encodeURIComponent(ip)}`);
      if (!res.ok) throw new Error(`Proxy ${res.status}`);
      const data = await res.json();
      Store.set(cacheKey, data, 30 * 60 * 1000); // 30 min cache
      return data;
    } catch (err) {
      console.error('API.checkIP:', err);
      throw err;
    }
  },

  // ═══ Headers Scan (via proxy) ═══

  async scanHeaders(url) {
    if (!UI.isValidURL(url)) throw new Error('Invalid URL');

    const cacheKey = `headers_${url}`;
    const cached = Store.get(cacheKey);
    if (cached) return cached;

    if (!this._proxyAvailable) {
      // Return demo scan of the input URL
      return {
        url,
        headers: {},
        _demo: true,
      };
    }

    try {
      const res = await fetch(`${this.PROXY_URL}/api/headers?url=${encodeURIComponent(url)}`);
      if (!res.ok) throw new Error(`Proxy ${res.status}`);
      const data = await res.json();
      Store.set(cacheKey, data, 30 * 60 * 1000);
      return data;
    } catch (err) {
      console.error('API.scanHeaders:', err);
      throw err;
    }
  },
};
