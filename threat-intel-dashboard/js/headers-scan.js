"use strict";

const HeadersScan = {
  _loaded: false,

  // Security headers to check with descriptions
  HEADERS: [
    { name: 'Content-Security-Policy', weight: 3, desc: 'Controls which resources the browser is allowed to load' },
    { name: 'Strict-Transport-Security', weight: 3, desc: 'Forces HTTPS connections, preventing downgrade attacks' },
    { name: 'X-Content-Type-Options', weight: 2, desc: 'Prevents MIME-type sniffing attacks' },
    { name: 'X-Frame-Options', weight: 2, desc: 'Protects against clickjacking by controlling iframe embedding' },
    { name: 'Referrer-Policy', weight: 1, desc: 'Controls how much referrer info is sent with requests' },
    { name: 'Permissions-Policy', weight: 1, desc: 'Controls which browser features the site can use' },
    { name: 'X-XSS-Protection', weight: 1, desc: 'Legacy XSS filter (deprecated but still checked)' },
    { name: 'Cross-Origin-Opener-Policy', weight: 1, desc: 'Isolates browsing context from cross-origin documents' },
    { name: 'Cross-Origin-Resource-Policy', weight: 1, desc: 'Controls cross-origin resource loading' },
    { name: 'Cross-Origin-Embedder-Policy', weight: 1, desc: 'Controls cross-origin embedding of resources' },
  ],

  init() {
    if (this._loaded) return;
    this._loaded = true;

    const input = document.getElementById('url-input');
    const btn = document.getElementById('scan-btn');

    btn.addEventListener('click', () => this._scan());
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') this._scan();
    });
  },

  async _scan() {
    const input = document.getElementById('url-input');
    const btn = document.getElementById('scan-btn');
    const resultEl = document.getElementById('scan-result');
    let url = input.value.trim();

    // Auto-prepend https:// if missing protocol
    if (url && !url.match(/^https?:\/\//i)) {
      url = 'https://' + url;
      input.value = url;
    }

    if (!UI.isValidURL(url)) {
      this._showError('Please enter a valid URL (e.g. https://example.com)');
      return;
    }

    btn.disabled = true;
    btn.textContent = 'Scanning...';
    resultEl.classList.add('visible');
    document.getElementById('scan-grade').innerHTML = '<div class="loading-overlay"><div class="loading-spinner"></div></div>';
    document.getElementById('headers-list').innerHTML = '';

    try {
      const data = await API.scanHeaders(url);
      this._renderResult(data);
    } catch (err) {
      console.error('HeadersScan:', err);
      document.getElementById('scan-grade').innerHTML = '<p style="color:var(--rose);font-size:0.85rem;">Failed to scan headers.</p>';
    } finally {
      btn.disabled = false;
      btn.textContent = 'Scan Headers';
    }
  },

  _renderResult(data) {
    const headers = data.headers || {};
    const isDemo = !!data._demo;

    // Normalize header keys to lowercase for comparison
    const lowerHeaders = {};
    Object.keys(headers).forEach(k => { lowerHeaders[k.toLowerCase()] = headers[k]; });

    // Score each header
    let earned = 0;
    let possible = 0;
    const results = this.HEADERS.map(h => {
      const present = lowerHeaders[h.name.toLowerCase()] != null;
      possible += h.weight;
      if (present) earned += h.weight;
      return {
        name: h.name,
        desc: h.desc,
        present,
        value: present ? lowerHeaders[h.name.toLowerCase()] : null,
      };
    });

    // Calculate grade
    const pct = possible > 0 ? earned / possible : 0;
    const grade = this._calcGrade(pct);

    // Render grade card
    const gradeEl = document.getElementById('scan-grade');
    gradeEl.innerHTML = `
      <div class="grade-letter grade-${grade.letter.toLowerCase()}">${grade.letter}</div>
      <div class="grade-desc">${UI.esc(grade.desc)}${isDemo ? ' (Demo)' : ''}</div>
    `;

    // Render header list
    document.getElementById('headers-list').innerHTML = results.map(r => `
      <div class="header-item">
        <div class="header-status ${r.present ? 'present' : 'missing'}">${r.present ? '&#10003;' : '&#10007;'}</div>
        <div>
          <div class="header-name">${UI.esc(r.name)}</div>
          ${r.value ? `<div style="font-size:0.7rem;color:var(--text-muted);margin-top:2px;word-break:break-all;max-width:500px;">${UI.esc(String(r.value).slice(0, 200))}</div>` : ''}
        </div>
        <div class="header-desc">${UI.esc(r.desc)}</div>
      </div>
    `).join('');
  },

  _calcGrade(pct) {
    if (pct >= 0.9) return { letter: 'A', desc: 'Excellent security headers' };
    if (pct >= 0.7) return { letter: 'B', desc: 'Good, but some headers missing' };
    if (pct >= 0.5) return { letter: 'C', desc: 'Average — important headers absent' };
    if (pct >= 0.3) return { letter: 'D', desc: 'Poor — most security headers missing' };
    return { letter: 'F', desc: 'Critical — virtually no security headers' };
  },

  _showError(msg) {
    const banner = document.getElementById('error-banner');
    banner.textContent = msg;
    banner.style.display = 'block';
    setTimeout(() => { banner.style.display = 'none'; }, 4000);
  },
};
