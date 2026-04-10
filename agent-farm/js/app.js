/* ── App Init & Router ── */
const App = {
  currentView: 'grid',

  init() {
    // Init modules
    Controls.init();
    Grid.init();
    Feed.init();
    Settings.init();
    Pipeline.init();
    Metrics.init();

    // Set up nav tabs
    document.querySelectorAll('.nav-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        App.navigate(tab.dataset.view);
      });
    });

    // Hash routing
    window.addEventListener('hashchange', () => {
      const view = location.hash.replace('#', '') || 'grid';
      App.navigate(view, false);
    });

    // Initial route
    const hash = location.hash.replace('#', '') || 'grid';
    App.navigate(hash, false);

    // Connect WebSocket
    WS.connect();

    console.log('[Agent Farm] Initialized');
  },

  navigate(view, pushHash = true) {
    const views = ['grid', 'pipeline', 'metrics', 'feed', 'settings'];
    if (!views.includes(view)) view = 'grid';

    this.currentView = view;

    // Update tabs
    document.querySelectorAll('.nav-tab').forEach(tab => {
      tab.classList.toggle('active', tab.dataset.view === view);
    });

    // Show/hide views
    views.forEach(v => {
      const el = document.getElementById(`view-${v}`);
      if (el) el.style.display = (v === view) ? '' : 'none';
    });

    // Render the active view
    if (view === 'pipeline') Pipeline.render();
    if (view === 'metrics') Metrics.render();
    if (view === 'feed') Feed.render();
    if (view === 'settings') Settings.render();

    // Stop auto-refresh when leaving
    if (view !== 'pipeline') Pipeline.stopAutoRefresh();
    if (view !== 'metrics') Metrics.stopAutoRefresh();

    if (pushHash) location.hash = view;
  },
};

// Boot
document.addEventListener('DOMContentLoaded', App.init.bind(App));
