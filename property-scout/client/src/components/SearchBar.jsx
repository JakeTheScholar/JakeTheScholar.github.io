import { useState } from 'react';

export default function SearchBar({ onSearch, loading }) {
  const [location, setLocation] = useState('');
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('300000');
  const [minBeds, setMinBeds] = useState('');

  function handleSubmit(e) {
    e.preventDefault();
    if (!location.trim()) return;
    onSearch({
      location: location.trim(),
      minPrice: minPrice || undefined,
      maxPrice: maxPrice || undefined,
      minBeds: minBeds || undefined,
      homeType: 'Multi-family',
    });
  }

  return (
    <form onSubmit={handleSubmit} className="card p-4 animate-fade-in-up">
      <div className="flex flex-wrap gap-3 items-end">
        <div className="flex-1 min-w-[200px]">
          <label className="block text-xs text-gray-400 mb-1">City, ZIP, or Address</label>
          <input
            type="text"
            value={location}
            onChange={e => setLocation(e.target.value)}
            placeholder="e.g. Knoxville TN, 37919"
            className="input w-full"
          />
        </div>
        <div className="w-32">
          <label className="block text-xs text-gray-400 mb-1">Min Price</label>
          <input
            type="number"
            value={minPrice}
            onChange={e => setMinPrice(e.target.value)}
            placeholder="0"
            className="input w-full"
            step="10000"
          />
        </div>
        <div className="w-32">
          <label className="block text-xs text-gray-400 mb-1">Max Price</label>
          <input
            type="number"
            value={maxPrice}
            onChange={e => setMaxPrice(e.target.value)}
            placeholder="300000"
            className="input w-full"
            step="10000"
          />
        </div>
        <div className="w-24">
          <label className="block text-xs text-gray-400 mb-1">Min Beds</label>
          <select value={minBeds} onChange={e => setMinBeds(e.target.value)} className="input w-full">
            <option value="">Any</option>
            <option value="2">2+</option>
            <option value="3">3+</option>
            <option value="4">4+</option>
          </select>
        </div>
        <button type="submit" disabled={loading} className="btn-primary flex items-center gap-2 h-[42px]">
          {loading ? (
            <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          )}
          Scout
        </button>
      </div>
    </form>
  );
}
