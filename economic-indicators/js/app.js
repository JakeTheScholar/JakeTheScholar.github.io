"use strict";

const App = {
  currentView: 'dashboard',
  initialized: {},

  async init() {
    // Preload fallback cache for offline/demo mode
    await API.loadFallbackCache();

    this.bindNavigation();
    this.initView('dashboard');

    // Init sub-modules
    Explorer.init();
    Correlation.init();

    // Handle hash navigation
    if (location.hash) {
      const view = location.hash.replace('#', '');
      if (['dashboard', 'explorer', 'correlation', 'composite'].includes(view)) {
        this.navigate(view);
      }
    }
  },

  bindNavigation() {
    document.querySelectorAll('.nav-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        this.navigate(tab.dataset.view);
      });
    });
  },

  navigate(view) {
    if (!['dashboard', 'explorer', 'correlation', 'composite'].includes(view)) return;

    this.currentView = view;
    location.hash = view;

    // Update nav
    document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
    const activeTab = document.querySelector(`.nav-tab[data-view="${view}"]`);
    if (activeTab) activeTab.classList.add('active');

    // Update views
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    const activeView = document.getElementById(`view-${view}`);
    if (activeView) activeView.classList.add('active');

    // Initialize view on first visit
    this.initView(view);
  },

  initView(view) {
    if (this.initialized[view]) return;
    this.initialized[view] = true;

    switch (view) {
      case 'dashboard':
        Dashboard.init();
        break;
      case 'explorer':
        Explorer.load();
        break;
      case 'correlation':
        Correlation.load();
        break;
      case 'composite':
        Composite.load();
        break;
    }
  },
};

document.addEventListener('DOMContentLoaded', () => App.init());
