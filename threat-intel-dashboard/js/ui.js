"use strict";

const UI = {
  esc(str) {
    if (str == null) return '';
    const d = document.createElement('div');
    d.textContent = String(str);
    return d.innerHTML;
  },

  $(sel) { return document.querySelector(sel); },
  $$(sel) { return document.querySelectorAll(sel); },

  formatDate(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  },

  timeAgo(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '';
    const ms = Date.now() - d.getTime();
    const mins = Math.floor(ms / 60000);
    if (mins < 60) return mins + 'm ago';
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return hrs + 'h ago';
    const days = Math.floor(hrs / 24);
    return days + 'd ago';
  },

  sevClass(severity) {
    const s = (severity || '').toUpperCase();
    if (s === 'CRITICAL') return 'critical';
    if (s === 'HIGH') return 'high';
    if (s === 'MEDIUM') return 'medium';
    if (s === 'LOW') return 'low';
    return 'none';
  },

  sevColor(severity) {
    const s = (severity || '').toUpperCase();
    if (s === 'CRITICAL') return '#ef4444';
    if (s === 'HIGH') return '#ec6d8c';
    if (s === 'MEDIUM') return '#f59e0b';
    if (s === 'LOW') return '#10b981';
    return '#5a5468';
  },

  // Validate IPv4 or IPv6
  isValidIP(str) {
    if (!str || typeof str !== 'string') return false;
    const s = str.trim();
    // IPv4
    if (/^(\d{1,3}\.){3}\d{1,3}$/.test(s)) {
      return s.split('.').every(n => { const v = parseInt(n, 10); return v >= 0 && v <= 255; });
    }
    // IPv6
    if (/^[0-9a-fA-F:]{2,45}$/.test(s) && s.includes(':') && !/:::/.test(s)) {
      const parts = s.split(':');
      if (parts.length >= 2 && parts.length <= 8) return true;
    }
    return false;
  },

  // Validate URL
  isValidURL(str) {
    if (!str || typeof str !== 'string') return false;
    try {
      const u = new URL(str.trim());
      return u.protocol === 'https:' || u.protocol === 'http:';
    } catch { return false; }
  },

  // Sanitize search query - strip anything that isn't alphanumeric, spaces, hyphens, or dots
  sanitizeSearch(str) {
    if (!str) return '';
    return String(str).replace(/[^a-zA-Z0-9\s.\-]/g, '').slice(0, 100);
  },
};
