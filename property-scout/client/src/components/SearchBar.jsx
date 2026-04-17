import { useState, useEffect } from 'react';
import { getSuggestedMarkets } from '../utils/str';

export default function SearchBar({ onSearch, onScanAllMarkets, loading, scanning, mode = 'hack', onModeChange }) {
  const [location, setLocation] = useState('');
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState(mode === 'str' ? '550000' : '300000');
  const [minBeds, setMinBeds] = useState('');
  const isStr = mode === 'str';

  // When the user flips mode, retune the default max price band
  useEffect(() => {
    setMaxPrice(prev => {
      if (isStr && (prev === '300000' || prev === '')) return '550000';
      if (!isStr && prev === '550000') return '300000';
      return prev;
    });
  }, [isStr]);

  function handleSubmit(e) {
    e.preventDefault();
    if (!location.trim()) return;
    onSearch({
      location: location.trim(),
      minPrice: minPrice || undefined,
      maxPrice: maxPrice || undefined,
      minBeds: minBeds || undefined,
      mode,
      homeType: isStr ? 'SingleFamily' : 'Multi-family',
    });
  }

  function handleChip(query) {
    setLocation(query);
    onSearch({
      location: query,
      minPrice: minPrice || undefined,
      maxPrice: maxPrice || undefined,
      minBeds: minBeds || undefined,
      mode,
      homeType: isStr ? 'SingleFamily' : 'Multi-family',
    });
  }

  return (
    <form onSubmit={handleSubmit} className="card p-4 animate-fade-in-up">
      {/* Mode toggle */}
      <div className="flex items-center gap-2 mb-4">
        <span className="text-xs text-gray-500 uppercase tracking-wider mr-2">Mode</span>
        <ModeButton active={!isStr} onClick={() => onModeChange?.('hack')} label="House Hack" sub="duplex / multi-family" />
        <ModeButton active={isStr}  onClick={() => onModeChange?.('str')}  label="STR / Airbnb" sub="cost-seg + 7-day rule" accent="purple" />
      </div>

      <div className="flex flex-wrap gap-3 items-end">
        <div className="flex-1 min-w-[200px]">
          <label className="block text-xs text-gray-400 mb-1">
            {isStr ? 'STR market — city, ZIP, or area' : 'City, ZIP, or Address'}
          </label>
          <input
            type="text"
            value={location}
            onChange={e => setLocation(e.target.value)}
            placeholder={isStr ? 'e.g. Gatlinburg TN, Broken Bow OK, 30A FL' : 'e.g. Knoxville TN, 37919'}
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
            placeholder={isStr ? '550000' : '300000'}
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
        <button type="submit" disabled={loading} className={`flex items-center gap-2 h-[42px] ${isStr ? 'btn-primary bg-purple-600 hover:bg-purple-500 border-purple-500' : 'btn-primary'}`}>
          {loading ? (
            <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          )}
          {isStr ? 'Scout STR' : 'Scout'}
        </button>
      </div>

      {/* Suggested markets — only in STR mode */}
      {isStr && (
        <div className="mt-4 pt-3 border-t border-gray-800">
          <div className="flex items-center justify-between mb-2 gap-2 flex-wrap">
            <p className="text-[10px] text-gray-500 uppercase tracking-wider">Suggested STR markets</p>
            <button
              type="button"
              onClick={() => onScanAllMarkets?.({
                minPrice: minPrice || undefined,
                maxPrice: maxPrice || undefined,
                minBeds: minBeds || undefined,
              })}
              disabled={scanning || loading}
              className="text-[11px] px-2 py-1 rounded-md bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/50 text-purple-200 transition-colors disabled:opacity-50 disabled:cursor-wait flex items-center gap-1"
              title="Search every target market in parallel, then rank by Y1 tax-shield efficiency"
            >
              {scanning && <span className="inline-block w-3 h-3 border-2 border-purple-200/30 border-t-purple-200 rounded-full animate-spin" />}
              Scan all markets &rarr; rank by shield
            </button>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {getSuggestedMarkets().map(m => (
              <button
                key={m.name}
                type="button"
                onClick={() => handleChip(m.query)}
                className="text-[11px] px-2 py-1 rounded-full bg-purple-600/10 hover:bg-purple-600/20 border border-purple-600/30 text-purple-300 hover:text-purple-200 transition-colors"
                title={m.theme}
              >
                <span className="opacity-60 mr-1">[{m.tier}]</span>{m.name}
              </button>
            ))}
          </div>
        </div>
      )}
    </form>
  );
}

function ModeButton({ active, onClick, label, sub, accent = 'green' }) {
  const activeClasses = accent === 'purple'
    ? 'bg-purple-600/20 text-purple-300 border-purple-600/40 shadow-sm shadow-purple-500/10'
    : 'bg-green-600/20 text-green-400 border-green-600/40 shadow-sm shadow-green-500/10';
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex flex-col items-start px-3 py-1.5 rounded-lg text-sm font-medium border transition-all duration-200 ${
        active ? activeClasses : 'bg-transparent border-gray-700 text-gray-500 hover:text-gray-300 hover:border-gray-600'
      }`}
    >
      <span>{label}</span>
      <span className="text-[10px] opacity-70">{sub}</span>
    </button>
  );
}
