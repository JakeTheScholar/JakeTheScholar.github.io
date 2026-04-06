import { useState, useCallback } from 'react';
import SearchBar from '../components/SearchBar';
import PropertyCard from '../components/PropertyCard';
import ManualEntryForm from '../components/ManualEntryForm';
import ROICalculator from '../components/ROICalculator';
import { searchProperties, saveProperty, removeProperty, isPropertySaved } from '../utils/api';

export default function Search() {
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedProperty, setSelectedProperty] = useState(null);
  const [showManual, setShowManual] = useState(false);
  const [savedIds, setSavedIds] = useState(() => {
    try { return JSON.parse(localStorage.getItem('property-scout-saved') || '[]').map(p => p.zpid); } catch { return []; }
  });

  const refreshSaved = () => {
    try { setSavedIds(JSON.parse(localStorage.getItem('property-scout-saved') || '[]').map(p => p.zpid)); } catch {}
  };

  const handleSearch = useCallback(async (query) => {
    setLoading(true);
    setError(null);
    try {
      const data = await searchProperties(query);
      if (data.error) {
        setError(data.error);
        setResults([]);
      } else {
        setResults(data.results || []);
        if ((data.results || []).length === 0) {
          setError('No multi-family properties found. Try a different area or add properties manually.');
        }
      }
    } catch (err) {
      setError(err.message || 'Search failed. Make sure the server is running and your API key is configured.');
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleSave = (property) => {
    saveProperty(property);
    refreshSaved();
  };

  const handleRemove = (zpid) => {
    removeProperty(zpid);
    refreshSaved();
  };

  const handleManualAdd = (property) => {
    setResults(prev => [property, ...prev]);
    setShowManual(false);
  };

  return (
    <div className="space-y-6">
      <div className="animate-fade-in-up">
        <h1 className="text-2xl font-bold text-white mb-1">Scout Properties</h1>
        <p className="text-gray-500 text-sm">Find the cheapest livable duplex for your house hack. Search or add manually.</p>
      </div>

      <SearchBar onSearch={handleSearch} loading={loading} />

      <div className="flex items-center gap-3">
        <button onClick={() => setShowManual(!showManual)} className="btn-secondary text-sm">
          {showManual ? 'Hide Form' : '+ Add Manually'}
        </button>
        {results.length > 0 && (
          <span className="text-sm text-gray-500">{results.length} properties found</span>
        )}
      </div>

      {showManual && <ManualEntryForm onAdd={handleManualAdd} onCancel={() => setShowManual(false)} />}

      {error && (
        <div className="card p-4 border-yellow-600/30 bg-yellow-600/5 animate-slide-down">
          <p className="text-yellow-400 text-sm">{error}</p>
          <p className="text-gray-500 text-xs mt-1">Tip: You can add properties manually using the button above.</p>
        </div>
      )}

      {results.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {results.map((property, i) => (
            <PropertyCard
              key={property.zpid}
              property={property}
              onSelect={setSelectedProperty}
              onSave={handleSave}
              onRemove={handleRemove}
              isSaved={savedIds.includes(property.zpid)}
              index={i}
            />
          ))}
        </div>
      )}

      {results.length === 0 && !loading && !error && (
        <div className="card p-12 text-center animate-fade-in-up" style={{ animationDelay: '0.15s' }}>
          <div className="text-5xl mb-4 animate-float">🏘️</div>
          <h2 className="text-xl font-semibold text-white mb-2">Find Your First House Hack</h2>
          <p className="text-gray-500 max-w-md mx-auto">
            Search for duplexes and multi-family properties above, or add them manually.
            Each property gets instant ROI analysis and a neighborhood score.
          </p>
          <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-3 max-w-lg mx-auto text-left">
            <Step n="1" text="Find cheapest livable duplex" />
            <Step n="2" text="Max leverage (3.5% FHA)" />
            <Step n="3" text="Live in one, rent the other" />
          </div>
        </div>
      )}

      {selectedProperty && (
        <ROICalculator property={selectedProperty} onClose={() => setSelectedProperty(null)} />
      )}
    </div>
  );
}

function Step({ n, text }) {
  return (
    <div className={`flex items-start gap-2 bg-gray-800/50 rounded-lg p-3 animate-fade-in-up stagger-${n} hover:bg-gray-800/70 transition-colors duration-200`}>
      <span className="bg-green-600 text-white text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center shrink-0 shadow-sm shadow-green-500/30">{n}</span>
      <span className="text-xs text-gray-300">{text}</span>
    </div>
  );
}
