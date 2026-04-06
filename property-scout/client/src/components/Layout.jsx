import { useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { getApiKey, setApiKey, hasApiKey } from '../utils/api';

const navItems = [
  { to: '/', label: 'Search' },
  { to: '/saved', label: 'Saved' },
  { to: '/compare', label: 'Compare' },
];

export default function Layout() {
  const [showSettings, setShowSettings] = useState(false);
  const [key, setKey] = useState(getApiKey);
  const [saved, setSaved] = useState(hasApiKey);

  function handleSave() {
    setApiKey(key);
    setSaved(!!key);
    setShowSettings(false);
  }

  return (
    <div className="min-h-screen bg-gray-950">
      <header className="border-b border-gray-800 bg-gray-950/80 backdrop-blur sticky top-0 z-50">
        <div className="header-accent" />
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <NavLink to="/" className="flex items-center gap-2 group">
            <span className="text-2xl transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-6">🏠</span>
            <span className="text-lg font-bold text-white">Property Scout</span>
            <span className="text-xs bg-green-600/20 text-green-400 px-2 py-0.5 rounded-full border border-green-600/30 ml-1">
              House Hack
            </span>
          </NavLink>
          <div className="flex items-center gap-1">
            <nav className="flex gap-1">
              {navItems.map(({ to, label }) => (
                <NavLink
                  key={to}
                  to={to}
                  end={to === '/'}
                  className={({ isActive }) =>
                    `px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                      isActive
                        ? 'bg-green-600/20 text-green-400 shadow-sm shadow-green-500/10'
                        : 'text-gray-400 hover:text-white hover:bg-gray-800'
                    }`
                  }
                >
                  {label}
                </NavLink>
              ))}
            </nav>
            <button
              onClick={() => setShowSettings(!showSettings)}
              className={`ml-2 p-1.5 rounded-lg transition-colors ${
                saved
                  ? 'text-gray-400 hover:text-white hover:bg-gray-800'
                  : 'text-yellow-400 hover:bg-yellow-600/10'
              }`}
              title={saved ? 'API Settings' : 'Set API Key'}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </button>
          </div>
        </div>

        {showSettings && (
          <div className="border-t border-gray-800 bg-gray-900/90 backdrop-blur animate-slide-down">
            <div className="max-w-7xl mx-auto px-4 py-3">
              <div className="flex items-end gap-3">
                <div className="flex-1 max-w-md">
                  <label className="block text-xs text-gray-400 mb-1">RapidAPI Key</label>
                  <input
                    type="password"
                    value={key}
                    onChange={e => setKey(e.target.value)}
                    placeholder="Paste your RapidAPI key"
                    className="input w-full text-sm"
                  />
                </div>
                <button onClick={handleSave} className="btn-primary text-sm h-[38px]">Save</button>
                <a
                  href="https://rapidapi.com/GatiMan/api/zillw-real-estate-api"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-gray-500 hover:text-green-400 transition-colors"
                >
                  Get free key
                </a>
              </div>
              {!saved && (
                <p className="text-xs text-yellow-400/70 mt-2">No API key set — using demo data. Add a key for live Zillow listings.</p>
              )}
            </div>
          </div>
        )}
      </header>
      <main className="max-w-7xl mx-auto px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}
