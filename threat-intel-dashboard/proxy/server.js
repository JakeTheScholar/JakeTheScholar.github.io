"use strict";

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');

const app = express();
const PORT = process.env.PORT || 3001;

// ═══ Security middleware ═══
app.use(helmet());
app.use(express.json({ limit: '1kb' }));

// CORS — restrict to production + local dev
const ALLOWED_ORIGINS = [
  'https://jakemcgaha.com',
  'https://www.jakemcgaha.com',
  'https://jakethescholar.github.io',
  'http://localhost:8080',
  'http://localhost:3000',
  'http://127.0.0.1:8080',
];
app.use(cors({
  origin(origin, cb) {
    if (ALLOWED_ORIGINS.includes(origin)) return cb(null, true);
    cb(new Error('CORS blocked'));
  },
  methods: ['GET'],
  optionsSuccessStatus: 200,
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, try again later.' },
});
app.use('/api/', limiter);

// ═══ Validation helpers ═══
function isValidIPv4(str) {
  if (!/^(\d{1,3}\.){3}\d{1,3}$/.test(str)) return false;
  return str.split('.').every(n => { const v = parseInt(n, 10); return v >= 0 && v <= 255; });
}

function isValidIPv6(str) {
  if (!str || typeof str !== 'string') return false;
  // Must contain at least one colon, only hex digits and colons, no more than 8 groups
  if (!/^[0-9a-fA-F:]{2,45}$/.test(str) || !str.includes(':')) return false;
  // Reject obviously invalid patterns
  if (/:::/.test(str)) return false;
  const parts = str.split(':');
  if (parts.length < 2 || parts.length > 8) return false;
  return true;
}

function isValidIP(str) {
  if (!str || typeof str !== 'string') return false;
  const s = str.trim();
  return isValidIPv4(s) || isValidIPv6(s);
}

function isValidURL(str) {
  if (!str || typeof str !== 'string') return false;
  try {
    const u = new URL(str.trim());
    return u.protocol === 'https:' || u.protocol === 'http:';
  } catch { return false; }
}

// Block SSRF: reject private/internal hostnames before fetching
function isPublicURL(str) {
  try {
    const u = new URL(str.trim());
    const host = u.hostname.toLowerCase();

    // Block localhost variants
    if (host === 'localhost' || host === '127.0.0.1' || host === '::1' || host === '[::1]') return false;
    if (host.endsWith('.localhost')) return false;

    // Block private IPv4 ranges
    const ipv4 = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
    if (ipv4) {
      const [, a, b] = ipv4.map(Number);
      if (a === 10) return false;                          // 10.0.0.0/8
      if (a === 172 && b >= 16 && b <= 31) return false;   // 172.16.0.0/12
      if (a === 192 && b === 168) return false;             // 192.168.0.0/16
      if (a === 169 && b === 254) return false;             // 169.254.0.0/16 (link-local / cloud metadata)
      if (a === 127) return false;                          // 127.0.0.0/8
      if (a === 0) return false;                            // 0.0.0.0/8
    }

    // Block private/link-local IPv6 ranges
    if (host.startsWith('[')) {
      const ipv6 = host.slice(1, -1).toLowerCase();
      if (ipv6 === '::1') return false;                    // loopback
      if (ipv6.startsWith('fe80')) return false;           // link-local
      if (ipv6.startsWith('fc') || ipv6.startsWith('fd')) return false; // unique local (fc00::/7)
      if (ipv6.startsWith('ff')) return false;             // multicast
      if (ipv6 === '::') return false;                     // unspecified
    }

    // Block internal TLDs / no-dot hostnames (e.g. http://metadata/)
    if (!host.includes('.') && !host.startsWith('[')) return false;
    if (host.endsWith('.internal') || host.endsWith('.local')) return false;

    return true;
  } catch { return false; }
}

// ═══ Health check ═══
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ═══ IP Reputation (AbuseIPDB) ═══
const ABUSEIPDB_KEY = process.env.ABUSEIPDB_KEY;

app.get('/api/ip/:ip', async (req, res) => {
  const ip = req.params.ip;
  if (!isValidIP(ip)) {
    return res.status(400).json({ error: 'Invalid IP address' });
  }

  if (!ABUSEIPDB_KEY) {
    return res.status(503).json({ error: 'AbuseIPDB API key not configured' });
  }

  try {
    const response = await fetch(
      `https://api.abuseipdb.com/api/v2/check?ipAddress=${encodeURIComponent(ip)}&maxAgeInDays=90`,
      {
        headers: {
          'Key': ABUSEIPDB_KEY,
          'Accept': 'application/json',
        },
      }
    );

    if (!response.ok) {
      const text = await response.text();
      console.error('AbuseIPDB error:', response.status, text);
      return res.status(response.status).json({ error: 'AbuseIPDB request failed' });
    }

    const json = await response.json();
    const d = json.data || {};

    res.json({
      ipAddress: d.ipAddress,
      isPublic: d.isPublic,
      isWhitelisted: d.isWhitelisted,
      abuseConfidenceScore: d.abuseConfidenceScore,
      countryCode: d.countryCode,
      countryName: d.countryName,
      usageType: d.usageType,
      isp: d.isp,
      domain: d.domain,
      hostnames: d.hostnames,
      totalReports: d.totalReports,
      numDistinctUsers: d.numDistinctUsers,
      lastReportedAt: d.lastReportedAt,
    });
  } catch (err) {
    console.error('IP lookup error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ═══ Security Headers Scan ═══
app.get('/api/headers', async (req, res) => {
  const url = req.query.url;
  if (!isValidURL(url)) {
    return res.status(400).json({ error: 'Invalid URL' });
  }
  if (!isPublicURL(url)) {
    return res.status(403).json({ error: 'Internal/private URLs are not allowed' });
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(url, {
      method: 'HEAD',
      redirect: 'manual',
      signal: controller.signal,
      headers: { 'User-Agent': 'ThreatIntelDashboard/1.0 SecurityHeaderScanner' },
    });
    clearTimeout(timeout);

    // Extract only security-relevant headers
    const headers = {};
    const interesting = [
      'content-security-policy', 'strict-transport-security',
      'x-content-type-options', 'x-frame-options', 'referrer-policy',
      'permissions-policy', 'x-xss-protection',
      'cross-origin-opener-policy', 'cross-origin-resource-policy',
      'cross-origin-embedder-policy', 'server', 'x-powered-by',
    ];

    for (const key of interesting) {
      const val = response.headers.get(key);
      if (val) headers[key] = val;
    }

    res.json({
      url,
      statusCode: response.status,
      headers,
    });
  } catch (err) {
    if (err.name === 'AbortError') {
      return res.status(504).json({ error: 'Request timed out' });
    }
    console.error('Headers scan error:', err.message);
    res.status(500).json({ error: 'Failed to fetch URL' });
  }
});

// ═══ 404 ═══
app.use((_req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// ═══ Global error handler — return JSON, never HTML/stack traces ═══
app.use((err, _req, res, _next) => {
  console.error('Unhandled error:', err.message);
  res.status(500).json({ error: 'Internal server error' });
});

// ═══ Start ═══
app.listen(PORT, () => {
  console.log(`TID Proxy running on port ${PORT}`);
  console.log(`AbuseIPDB key: ${ABUSEIPDB_KEY ? 'configured' : 'NOT SET'}`);
});
