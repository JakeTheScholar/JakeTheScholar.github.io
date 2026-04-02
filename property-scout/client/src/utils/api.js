const API_HOST = 'zillw-real-estate-api.p.rapidapi.com';
const API_KEY_STORAGE = 'property-scout-api-key';

// API key management — stored in localStorage
export function getApiKey() {
  return localStorage.getItem(API_KEY_STORAGE) || '';
}

export function setApiKey(key) {
  // Basic validation: RapidAPI keys are alphanumeric
  const sanitized = key.replace(/[^a-zA-Z0-9]/g, '');
  localStorage.setItem(API_KEY_STORAGE, sanitized);
}

export function hasApiKey() {
  return !!getApiKey();
}

// Direct RapidAPI calls from browser
async function apiFetch(endpoint, params) {
  const key = getApiKey();
  if (!key) {
    throw new Error('No API key configured. Add your RapidAPI key in Settings.');
  }
  const url = `https://${API_HOST}${endpoint}?${new URLSearchParams(params)}`;
  const res = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      'X-RapidAPI-Key': key,
      'X-RapidAPI-Host': API_HOST,
    },
  });
  if (!res.ok) {
    if (res.status === 401 || res.status === 403) {
      throw new Error('Invalid API key. Check your key in Settings.');
    } else if (res.status === 429) {
      throw new Error('Rate limit exceeded. Try again later.');
    }
    throw new Error('Search failed. Please try again.');
  }
  return res.json();
}

function sanitizeLocation(input) {
  if (!input || typeof input !== 'string') return '';
  // Allow letters, numbers, spaces, commas, periods, hyphens only. Max 100 chars.
  return input.replace(/[^a-zA-Z0-9\s,.\-]/g, '').slice(0, 100).trim();
}

export async function searchProperties(query) {
  const location = sanitizeLocation(query.location);
  if (!location) {
    return { results: [], error: 'Please enter a valid location.' };
  }

  const key = getApiKey();
  if (!key) {
    return { results: generateDemoProperties(location), demo: true };
  }

  try {
    const data = await apiFetch('/properties/by-location', {
      location,
      listType: 'for-sale',
      page: '1',
    });

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

    // Client-side filtering
    const minPrice = parseFloat(query.minPrice) || 0;
    const maxPrice = parseFloat(query.maxPrice) || Infinity;
    const minBeds = parseInt(query.minBeds) || 0;
    const filtered = results.filter(p =>
      p.price >= minPrice && p.price <= maxPrice && p.bedrooms >= minBeds
    );

    return { results: filtered };
  } catch (err) {
    return { results: generateDemoProperties(location), error: err.message, demo: true };
  }
}

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
  return 2;
}

function generateDemoProperties(location) {
  const loc = sanitizeLocation(location) || 'Demo City, ST';
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

// localStorage-based saved properties
const SAVED_KEY = 'property-scout-saved';

export function getSavedProperties() {
  try {
    return JSON.parse(localStorage.getItem(SAVED_KEY) || '[]');
  } catch {
    return [];
  }
}

export function saveProperty(property) {
  const saved = getSavedProperties();
  if (!saved.find(p => p.zpid === property.zpid)) {
    saved.push({ ...property, savedAt: Date.now() });
    localStorage.setItem(SAVED_KEY, JSON.stringify(saved));
  }
  return saved;
}

export function removeProperty(zpid) {
  const saved = getSavedProperties().filter(p => p.zpid !== zpid);
  localStorage.setItem(SAVED_KEY, JSON.stringify(saved));
  return saved;
}

export function isPropertySaved(zpid) {
  return getSavedProperties().some(p => p.zpid === zpid);
}
