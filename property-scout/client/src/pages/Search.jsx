import { useState, useCallback, useMemo } from 'react';
import SearchBar from '../components/SearchBar';
import PropertyCard from '../components/PropertyCard';
import ManualEntryForm from '../components/ManualEntryForm';
import ROICalculator from '../components/ROICalculator';
import { searchProperties, saveProperty, removeProperty } from '../utils/api';
import { classifyLocation, getSuggestedMarkets, shieldEfficiency, strAnalysis, strLocationScore } from '../utils/str';

export default function Search() {
  const [mode, setMode] = useState('hack'); // 'hack' | 'str'
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState(null);
  const [lastQuery, setLastQuery] = useState(null);
  const [scanSummary, setScanSummary] = useState(null);
  const [sortBy, setSortBy] = useState('default');
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
    setLastQuery(query);
    setScanSummary(null);
    setSortBy('default');
    try {
      const data = await searchProperties(query);
      if (data.error && !data.results?.length) {
        setError(data.error);
        setResults([]);
      } else {
        setResults(data.results || []);
        if ((data.results || []).length === 0) {
          setError(query.mode === 'str'
            ? 'No STR-suitable properties found. Try a target market chip above or add manually.'
            : 'No multi-family properties found. Try a different area or add manually.');
        }
      }
    } catch (err) {
      setError(err.message || 'Search failed. Make sure the server is running and your API key is configured.');
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleScanAllMarkets = useCallback(async (filters = {}) => {
    setScanning(true);
    setError(null);
    setSortBy('shield');
    setLastQuery({ location: 'all STR target markets', mode: 'str', ...filters });
    try {
      const markets = getSuggestedMarkets();
      const batches = await Promise.all(markets.map(m =>
        searchProperties({
          location: m.query,
          mode: 'str',
          homeType: 'SingleFamily',
          ...filters,
        }).then(r => ({ market: m, data: r }))
          .catch(() => ({ market: m, data: { results: [] } }))
      ));

      const bymarket = {};
      const seen = new Set();
      const merged = [];
      const dedupKey = (p) => {
        const addr = (p.address || '').toLowerCase().replace(/\s+/g, ' ').trim();
        // Address + price is more robust than zpid — Zillow returns different zpids for
        // the same listing across neighboring markets (Gatlinburg/Pigeon Forge, 30A/Destin),
        // and some responses omit zpid entirely and fall through to a random fallback.
        return addr ? `${addr}|${p.price || 0}` : `zpid:${p.zpid}`;
      };
      for (const { market, data } of batches) {
        const list = (data.results || []).map(p => ({ ...p, _scanMarket: market.name }));
        bymarket[market.name] = list.length;
        for (const p of list) {
          const key = dedupKey(p);
          if (seen.has(key)) continue;
          seen.add(key);
          merged.push(p);
        }
      }

      setResults(merged);
      setScanSummary({
        totalMarkets: markets.length,
        totalResults: merged.length,
        perMarket: bymarket,
      });
      if (!merged.length) {
        setError('Scan returned no properties — running in demo mode or all markets exhausted.');
      }
    } catch (err) {
      setError(err.message || 'Cross-market scan failed.');
      setResults([]);
    } finally {
      setScanning(false);
    }
  }, []);

  const handleSave = (property) => { saveProperty(property, mode); refreshSaved(); };
  const handleRemove = (zpid) => { removeProperty(zpid); refreshSaved(); };
  const handleManualAdd = (property) => { setResults(prev => [property, ...prev]); setShowManual(false); };

  // STR regulation warning if user searched a banned or caution market
  const regWarning = (() => {
    if (mode !== 'str' || !lastQuery?.location) return null;
    const cls = classifyLocation(lastQuery.location);
    if (cls.kind === 'banned' || cls.kind === 'caution') return cls;
    return null;
  })();

  const isStr = mode === 'str';

  const sortedResults = useMemo(() => {
    if (!isStr || sortBy === 'default' || !results.length) return results;
    const withMetrics = results.map(p => {
      const str = strAnalysis(p, {});
      const locScore = strLocationScore({ location: p._scanMarket || lastQuery?.location, property: p });
      return {
        p,
        shieldEff: shieldEfficiency(p),
        cashFlow: str.cashFlowMonthly,
        score: locScore.overall,
        price: p.price,
      };
    });
    const cmp = {
      shield:   (a, b) => b.shieldEff - a.shieldEff,
      cashflow: (a, b) => b.cashFlow - a.cashFlow,
      score:    (a, b) => b.score - a.score,
      priceAsc: (a, b) => a.price - b.price,
    }[sortBy];
    if (!cmp) return results;
    return [...withMetrics].sort(cmp).map(x => x.p);
  }, [results, sortBy, isStr, lastQuery]);

  return (
    <div className="space-y-6">
      <div className="animate-fade-in-up">
        <h1 className="text-2xl font-bold text-white mb-1">
          {isStr ? 'Scout STR Properties' : 'Scout Properties'}
        </h1>
        <p className="text-gray-500 text-sm">
          {isStr
            ? 'Find Airbnb-friendly homes in proven markets. Year-1 cost-seg + sub-7-day-stay rule = non-passive losses against active W-2/business income.'
            : 'Find the cheapest livable duplex for your house hack. Search or add manually.'}
        </p>
      </div>

      <SearchBar
        onSearch={handleSearch}
        onScanAllMarkets={handleScanAllMarkets}
        loading={loading}
        scanning={scanning}
        mode={mode}
        onModeChange={setMode}
      />

      {regWarning && regWarning.kind === 'banned' && (
        <div className="card p-4 border-red-600/40 bg-red-600/5 animate-slide-down">
          <div className="flex items-start gap-2">
            <span className="text-red-400 text-lg leading-none">!</span>
            <div>
              <p className="text-red-300 text-sm font-semibold">{regWarning.name}: STR regulation blocker</p>
              <p className="text-red-300/80 text-xs mt-1">{regWarning.reason}</p>
              <p className="text-gray-500 text-xs mt-1">This market is on the avoid list — STR alpha (sub-7-day-stay rule) is functionally unavailable here.</p>
            </div>
          </div>
        </div>
      )}

      {regWarning && regWarning.kind === 'caution' && (
        <div className="card p-4 border-yellow-600/40 bg-yellow-600/5 animate-slide-down">
          <div className="flex items-start gap-2">
            <span className="text-yellow-400 text-lg leading-none">!</span>
            <div>
              <p className="text-yellow-300 text-sm font-semibold">{regWarning.name}: permit / zoning caution</p>
              <p className="text-yellow-300/80 text-xs mt-1">{regWarning.reason}</p>
              <p className="text-gray-500 text-xs mt-1">Not a ban — but confirm zoning, HOA docs, and permit availability before closing.</p>
            </div>
          </div>
        </div>
      )}

      {scanSummary && (
        <div className="card p-3 border-purple-600/30 bg-purple-600/5 animate-slide-down flex items-center justify-between flex-wrap gap-2">
          <div>
            <p className="text-sm text-purple-200">
              Scanned <strong>{scanSummary.totalMarkets}</strong> target markets &rarr; <strong>{scanSummary.totalResults}</strong> unique properties, ranked by Y1 shield efficiency.
            </p>
            <p className="text-[11px] text-gray-500 mt-0.5">
              {Object.entries(scanSummary.perMarket).map(([m, c]) => `${m}: ${c}`).join(' · ')}
            </p>
          </div>
        </div>
      )}

      <div className="flex items-center gap-3 flex-wrap">
        <button onClick={() => setShowManual(!showManual)} className="btn-secondary text-sm">
          {showManual ? 'Hide Form' : '+ Add Manually'}
        </button>
        {results.length > 0 && (
          <span className="text-sm text-gray-500">{results.length} properties found</span>
        )}
        {isStr && results.length > 1 && (
          <div className="ml-auto flex items-center gap-2">
            <label className="text-[11px] text-gray-500 uppercase">Sort</label>
            <select
              value={sortBy}
              onChange={e => setSortBy(e.target.value)}
              className="input text-xs py-1 px-2 w-auto"
            >
              <option value="default">Default</option>
              <option value="shield">Y1 Shield Efficiency</option>
              <option value="cashflow">Monthly Cash Flow</option>
              <option value="score">STR Location Score</option>
              <option value="priceAsc">Price (low → high)</option>
            </select>
          </div>
        )}
      </div>

      {showManual && <ManualEntryForm onAdd={handleManualAdd} onCancel={() => setShowManual(false)} />}

      {error && (
        <div className="card p-4 border-yellow-600/30 bg-yellow-600/5 animate-slide-down">
          <p className="text-yellow-400 text-sm">{error}</p>
          <p className="text-gray-500 text-xs mt-1">Tip: You can add properties manually using the button above.</p>
        </div>
      )}

      {sortedResults.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {sortedResults.map((property, i) => (
            <PropertyCard
              key={property.zpid}
              property={property}
              mode={mode}
              location={property._scanMarket || lastQuery?.location}
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
          <div className="text-5xl mb-4 animate-float">{isStr ? '🏖️' : '🏘️'}</div>
          <h2 className="text-xl font-semibold text-white mb-2">
            {isStr ? 'Find Your First STR' : 'Find Your First House Hack'}
          </h2>
          <p className="text-gray-500 max-w-md mx-auto">
            {isStr
              ? 'Search proven Airbnb markets above. Each property gets an STR location score and Year-1 cost-seg tax shield estimate.'
              : 'Search for duplexes and multi-family properties above, or add them manually. Each property gets instant ROI analysis and a neighborhood score.'}
          </p>
          <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-3 max-w-lg mx-auto text-left">
            {isStr ? (
              <>
                <Step n="1" text="Pick a target STR market" />
                <Step n="2" text="Self-manage Y1 (>100 hrs)" />
                <Step n="3" text="Cost seg → offset active income" />
              </>
            ) : (
              <>
                <Step n="1" text="Find cheapest livable duplex" />
                <Step n="2" text="Max leverage (3.5% FHA)" />
                <Step n="3" text="Live in one, rent the other" />
              </>
            )}
          </div>
        </div>
      )}

      {selectedProperty && (
        <ROICalculator
          property={selectedProperty}
          mode={mode}
          location={selectedProperty._scanMarket || lastQuery?.location}
          onClose={() => setSelectedProperty(null)}
        />
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
