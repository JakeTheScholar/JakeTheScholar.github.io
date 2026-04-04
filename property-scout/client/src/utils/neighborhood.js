/**
 * Neighborhood "Sweet Spot" scoring.
 * Rates areas on a 1-10 scale to find the goldilocks zone for house hacking.
 * Not too nice (expensive), not too rough (risky).
 */

// Score components: each returns 0-10
function priceScore(medianHomeValue, metroMedian) {
  if (!metroMedian || !medianHomeValue) return 5;
  const ratio = medianHomeValue / metroMedian;
  // Sweet spot: 40-70% of metro median
  if (ratio < 0.2) return 2;   // too cheap = red flag
  if (ratio < 0.4) return 5;
  if (ratio < 0.55) return 9;  // sweet spot low
  if (ratio < 0.7) return 10;  // sweet spot
  if (ratio < 0.85) return 7;
  if (ratio < 1.0) return 5;
  if (ratio < 1.3) return 3;
  return 1; // way too expensive
}

function crimeScore(crimeIndex) {
  // crimeIndex: 0 = no crime, 100 = highest crime. National avg ~30
  if (crimeIndex == null) return 5;
  if (crimeIndex < 10) return 4;  // ultra-low = pricey area
  if (crimeIndex < 20) return 6;
  if (crimeIndex < 35) return 9;  // moderate = sweet spot
  if (crimeIndex < 50) return 7;
  if (crimeIndex < 65) return 4;
  if (crimeIndex < 80) return 2;
  return 1; // high crime
}

function rentToPrice(monthlyRent, price) {
  if (!price || !monthlyRent) return 5;
  const ratio = (monthlyRent / price) * 100;
  // 1% rule = great, >1.5% = might be rough area
  if (ratio < 0.4) return 1;
  if (ratio < 0.6) return 3;
  if (ratio < 0.8) return 6;
  if (ratio < 1.0) return 8;
  if (ratio < 1.2) return 10; // ideal
  if (ratio < 1.5) return 8;
  return 5; // very high ratio = risky area
}

function vacancyScore(vacancyRate) {
  if (vacancyRate == null) return 5;
  if (vacancyRate < 3) return 6;   // very tight market
  if (vacancyRate < 5) return 9;   // healthy
  if (vacancyRate < 8) return 8;
  if (vacancyRate < 12) return 5;
  if (vacancyRate < 18) return 3;
  return 1; // high vacancy = problem area
}

function schoolScore(rating) {
  // 1-10 school rating. Mid-range = sweet spot (not luxury, but stable)
  if (rating == null) return 5;
  if (rating <= 2) return 3;
  if (rating <= 4) return 6;
  if (rating <= 6) return 9;  // stable middle-class area
  if (rating <= 8) return 7;
  return 4; // top schools = too expensive
}

export function calculateNeighborhoodScore(data) {
  const scores = {
    price: priceScore(data.medianHomeValue, data.metroMedian),
    crime: crimeScore(data.crimeIndex),
    rentToPrice: rentToPrice(data.monthlyRent, data.price),
    vacancy: vacancyScore(data.vacancyRate),
    school: schoolScore(data.schoolRating),
  };

  const weights = { price: 0.25, crime: 0.25, rentToPrice: 0.2, vacancy: 0.15, school: 0.15 };
  let total = 0;
  for (const [key, weight] of Object.entries(weights)) {
    total += scores[key] * weight;
  }

  const overall = Math.round(total * 10) / 10;

  return {
    overall,
    scores,
    badge: getBadge(overall, scores),
  };
}

function getBadge(overall, scores) {
  if (overall >= 8) return { label: 'Sweet Spot', class: 'badge-sweet-spot' };
  if (scores.rentToPrice >= 9 && overall >= 6.5) return { label: 'Hidden Gem', class: 'badge-hidden-gem' };
  if (scores.price <= 3 && scores.crime >= 6) return { label: 'Too Nice $$', class: 'badge-too-nice' };
  if (scores.crime <= 3 || overall < 4) return { label: 'Too Risky', class: 'badge-too-risky' };
  if (overall >= 6) return { label: 'Sweet Spot', class: 'badge-sweet-spot' };
  if (overall >= 4.5) return { label: 'Hidden Gem', class: 'badge-hidden-gem' };
  return { label: 'Too Risky', class: 'badge-too-risky' };
}

export function getDefaultNeighborhoodData(property) {
  // Generate reasonable defaults from property data when we don't have real neighborhood data
  const price = property.price || 200000;
  const rent = property.rentEstimate || Math.round(price * 0.008);
  return {
    medianHomeValue: price,
    metroMedian: price * 1.6,  // assume property is below metro median
    crimeIndex: 30,
    monthlyRent: rent,
    price: price,
    vacancyRate: 6,
    schoolRating: 5,
  };
}
