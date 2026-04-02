require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// RapidAPI config - loads from .env file or env var
const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY || '';
const API_HOST = 'zillw-real-estate-api.p.rapidapi.com';

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
    throw new Error(`API error ${res.status}: ${text}`);
  }
  return res.json();
}

// Search properties by location
app.get('/api/search', async (req, res) => {
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
    res.json({ results: generateDemoProperties(req.query.location), error: err.message, demo: true });
  }
});

// Property details by URL
app.get('/api/property-by-url', async (req, res) => {
  try {
    if (!RAPIDAPI_KEY) {
      return res.status(400).json({ error: 'No API key configured' });
    }
    const data = await apiFetch('/properties/detail', { url: req.query.url });
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
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
    imgSrc: p.imgSrc || p.image || p.thumbnail || p.photos?.[0] || null,
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
    imgSrc: null,
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
