"use strict";

const App = {
  _currentView: 'overview',
  _views: {},

  async init() {
    // Tab navigation
    document.querySelectorAll('.nav-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        const view = tab.dataset.view;
        if (view) this.switchView(view);
      });
    });

    // Init API (proxy detection, fallback data load)
    await API.init();

    // Load the default view
    await this._loadView('overview');
  },

  async switchView(name) {
    if (name === this._currentView) return;
    const validViews = ['overview', 'cve-feed', 'ip-lookup', 'headers-scan'];
    if (!validViews.includes(name)) return;

    // Update tabs
    document.querySelectorAll('.nav-tab').forEach(t => t.classList.toggle('active', t.dataset.view === name));

    // Toggle view panels
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    const viewEl = document.getElementById('view-' + name);
    if (viewEl) viewEl.classList.add('active');

    // Clear error banner
    document.getElementById('error-banner').style.display = 'none';

    this._currentView = name;
    await this._loadView(name);
  },

  async _loadView(name) {
    if (this._views[name]) return; // Already initialized
    this._views[name] = true;

    try {
      switch (name) {
        case 'overview':    await Overview.init(); break;
        case 'cve-feed':    await CVEFeed.init(); break;
        case 'ip-lookup':   IPLookup.init(); break;
        case 'headers-scan': HeadersScan.init(); break;
      }
    } catch (err) {
      console.error(`App._loadView(${name}):`, err);
    }
  },
};

document.addEventListener('DOMContentLoaded', () => App.init());
