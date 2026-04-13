require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({
  origin: ['http://localhost:3001', 'http://localhost:5173', 'https://jakemcgaha.com', 'https://jakethescholar.github.io'],
}));
app.use(express.json({ limit: '10kb' }));

// Security headers
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), geolocation=()');
  res.setHeader('Content-Security-Policy',
    "default-src 'self'; " +
    "script-src 'self' 'unsafe-inline'; " +
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
    "font-src https://fonts.gstatic.com; " +
    "img-src 'self' data: https://*.unsplash.com https://*.zillowstatic.com; " +
    "connect-src 'self'; " +
    "frame-ancestors 'none'; " +
    "base-uri 'self'; " +
    "form-action 'self';"
  );
  next();
});

// RapidAPI config - loads from .env file or env var
const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY || '';
const API_HOST = 'zillw-real-estate-api.p.rapidapi.com';

// Simple in-memory rate limiter per IP
const rateLimitMap = new Map();
const RATE_LIMIT_WINDOW = 60000; // 1 minute
const RATE_LIMIT_MAX = 20; // max requests per window

function rateLimit(req, res, next) {
  const ip = req.ip || req.connection.remoteAddress;
  const now = Date.now();
  const entry = rateLimitMap.get(ip) || { count: 0, resetAt: now + RATE_LIMIT_WINDOW };
  if (now > entry.resetAt) {
    entry.count = 0;
    entry.resetAt = now + RATE_LIMIT_WINDOW;
  }
  entry.count++;
  rateLimitMap.set(ip, entry);
  if (entry.count > RATE_LIMIT_MAX) {
    return res.status(429).json({ error: 'Too many requests. Please wait a moment.' });
  }
  next();
}

// Clean up stale rate limit entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of rateLimitMap) {
    if (now > entry.resetAt) rateLimitMap.delete(ip);
  }
}, 300000);

async function apiFetch(endpoint, params) {
  if (!RAPIDAPI_KEY) {
    return { error: 'No API key configured. Set RAPIDAPI_KEY env var or use manual entry.' };
  }
  const url = `https://${API_HOST}${endpoint}?${new URLSearchParams(params)}`;
  console.log(`[API] ${url}`);
  const res = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      'X-RapidAPI-Key': RAPIDAPI_KEY,
      'X-RapidAPI-Host': API_HOST,
    },
  });
  if (!res.ok) {
    const text = await res.text();
    // Log full error server-side but don't expose raw API response to clients
    console.error(`[API] Error ${res.status}: ${text}`);
    throw new Error(`API error ${res.status}`);
  }
  return res.json();
}

// Search properties by location
app.get('/api/search', rateLimit, async (req, res) => {
  try {
    const { location, minPrice, maxPrice, minBeds, homeType } = req.query;

    if (!RAPIDAPI_KEY) {
      return res.json({ results: generateDemoProperties(location), demo: true });
    }

    const params = {
      location,
      listType: 'for-sale',
      page: '1',
    };

    const data = await apiFetch('/properties/by-location', params);

    // Normalize response — API may return different shapes
    let listings = [];
    if (Array.isArray(data)) {
      listings = data;
    } else if (data.props) {
      listings = data.props;
    } else if (data.results) {
      listings = data.results;
    } else if (data.searchResults) {
      listings = data.searchResults;
    } else if (data.data && Array.isArray(data.data)) {
      listings = data.data;
    }

    const results = listings.map(normalizeProperty).filter(p => p.price > 0);

    console.log(`[Search] "${location}" → ${results.length} results`);
    res.json({ results });
  } catch (err) {
    console.error('Search error:', err.message);
    res.json({ results: generateDemoProperties(req.query.location), error: 'Search failed — showing demo data', demo: true });
  }
});

// Property details by URL
app.get('/api/property-by-url', rateLimit, async (req, res) => {
  try {
    if (!RAPIDAPI_KEY) {
      return res.status(400).json({ error: 'No API key configured' });
    }
    const url = req.query.url;
    let validZillow = false;
    try {
      const parsed = new URL(url);
      validZillow = (parsed.protocol === 'https:' || parsed.protocol === 'http:')
        && (parsed.hostname === 'zillow.com' || parsed.hostname === 'www.zillow.com');
    } catch {}
    if (!validZillow) {
      return res.status(400).json({ error: 'Invalid URL — must be a Zillow property link' });
    }
    const data = await apiFetch('/properties/detail', { url });
    res.json(data);
  } catch (err) {
    console.error('Property detail error:', err.message);
    res.status(500).json({ error: 'Failed to fetch property details' });
  }
});

// Normalize various property response formats into a consistent shape
function normalizeProperty(p) {
  return {
    zpid: p.zpid || p.id || p.propertyId || `prop-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    address: p.address || p.streetAddress || p.formattedAddress || formatAddress(p),
    price: p.price || p.listPrice || p.soldPrice || 0,
    bedrooms: p.bedrooms || p.beds || 0,
    bathrooms: p.bathrooms || p.baths || 0,
    livingArea: p.livingArea || p.sqft || p.area || null,
    imgSrc: p.imgSrc || p.image || p.thumbnail || p.primaryPhotoUrl
      || p.miniCardPhoto?.[0]?.url || p.photos?.[0]?.url || p.photos?.[0]?.href || p.photos?.[0]
      || p.big || p.hugePhoto?.url || p.photoUrl || null,
    units: guessUnits(p),
    rentEstimate: p.rentZestimate || p.rentEstimate || null,
    propertyType: p.propertyType || p.homeType || p.type || '',
    listingStatus: p.listingStatus || p.status || '',
    url: p.detailUrl || p.url || p.hdpUrl || null,
  };
}

function formatAddress(p) {
  const parts = [p.streetAddress, p.city, p.state, p.zipcode].filter(Boolean);
  return parts.join(', ') || 'Unknown Address';
}

function guessUnits(property) {
  const type = (property.propertyType || property.homeType || property.type || '').toLowerCase();
  const desc = (property.description || '').toLowerCase();
  const text = type + ' ' + desc;
  if (text.includes('triplex')) return 3;
  if (text.includes('fourplex') || text.includes('quadplex') || text.includes('4-plex')) return 4;
  if (text.includes('multi') || text.includes('duplex')) return 2;
  return 2;
}

const DEMO_IMAGES = [
  'https://images.unsplash.com/photo-1570129477492-45c003edd2be?w=600&h=400&fit=crop',
  'https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=600&h=400&fit=crop',
  'https://images.unsplash.com/photo-1583608205776-bfd35f0d9f83?w=600&h=400&fit=crop',
  'https://images.unsplash.com/photo-1568605114967-8130f3a36994?w=600&h=400&fit=crop',
  'https://images.unsplash.com/photo-1576941089067-2de3c901e126?w=600&h=400&fit=crop',
  'https://images.unsplash.com/photo-1598228723793-52759bba239c?w=600&h=400&fit=crop',
  'https://images.unsplash.com/photo-1605276374104-dee2a0ed3cd6?w=600&h=400&fit=crop',
  'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=600&h=400&fit=crop',
  'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=600&h=400&fit=crop',
];

function generateDemoProperties(location) {
  const loc = location || 'Demo City, ST';
  const bases = [
    { price: 165000, beds: 4, baths: 2, sqft: 1800, suffix: 'Oak St' },
    { price: 189000, beds: 4, baths: 2, sqft: 2100, suffix: 'Elm Ave' },
    { price: 145000, beds: 3, baths: 2, sqft: 1500, suffix: 'Pine Dr' },
    { price: 210000, beds: 5, baths: 3, sqft: 2400, suffix: 'Maple Ln' },
    { price: 175000, beds: 4, baths: 2, sqft: 1900, suffix: 'Cedar Ct' },
    { price: 135000, beds: 3, baths: 2, sqft: 1400, suffix: 'Birch Way' },
    { price: 225000, beds: 6, baths: 3, sqft: 2800, suffix: 'Walnut Blvd' },
    { price: 155000, beds: 4, baths: 2, sqft: 1700, suffix: 'Spruce Rd' },
    { price: 198000, beds: 4, baths: 2, sqft: 2000, suffix: 'Ash Ave' },
  ];

  return bases.map((b, i) => ({
    zpid: `demo-${i}-${Date.now()}`,
    address: `${100 + i * 12} ${b.suffix}, ${loc}`,
    price: b.price,
    bedrooms: b.beds,
    bathrooms: b.baths,
    livingArea: b.sqft,
    units: 2,
    rentEstimate: Math.round(b.price * 0.008),
    imgSrc: DEMO_IMAGES[i % DEMO_IMAGES.length],
    propertyType: 'Multi-family',
  }));
}

// Serve static frontend in production
app.use(express.static(path.join(__dirname, 'client', 'dist')));
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'client', 'dist', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Property Scout API running on http://localhost:${PORT}`);
  if (!RAPIDAPI_KEY) {
    console.log('  No RAPIDAPI_KEY set - running in demo mode with sample data');
    console.log('  Run with: RAPIDAPI_KEY=your_key npm run dev');
  }
});
