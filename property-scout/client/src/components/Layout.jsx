import { NavLink, Outlet } from 'react-router-dom';

const navItems = [
  { to: '/', label: 'Search' },
  { to: '/saved', label: 'Saved' },
  { to: '/compare', label: 'Compare' },
];

export default function Layout() {
  return (
    <div className="min-h-screen bg-gray-950">
      <header className="border-b border-gray-800 bg-gray-950/80 backdrop-blur sticky top-0 z-50">
        <div className="header-accent" />
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <a href="/" onClick={e => { e.preventDefault(); window.location.href = window.location.pathname; }} className="flex items-center gap-2 group cursor-pointer">
            <span className="text-2xl transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-6">🏠</span>
            <span className="text-lg font-bold text-white hidden sm:inline">Property Scout</span>
            <span className="text-xs bg-green-600/20 text-green-400 px-2 py-0.5 rounded-full border border-green-600/30 ml-1 hidden md:inline">
              House Hack
            </span>
          </a>
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
        </div>
      </header>
      <main className="max-w-7xl mx-auto px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}
