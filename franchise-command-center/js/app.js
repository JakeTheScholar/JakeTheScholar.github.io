"use strict";

const App = {
  routes: {
    'dashboard':    () => Dashboard.render(),
    'new-analysis': () => Wizards.render(),
    'portfolio':    () => Portfolio.render(),
    'templates':    () => Templates.render(),
    'scenario':     (id) => Scenario.render(id),
  },

  init() {
    // Seed Marco's template on first load
    if (Store.getTemplates().length === 0) {
      Store.saveTemplate(UI.MARCOS_DEFAULT_TEMPLATE);
    }
    // Nav click handlers
    document.querySelectorAll('.nav-link[data-route]').forEach(link => {
      link.addEventListener('click', () => {
        window.location.hash = link.dataset.route;
        App.closeSidebar();
      });
    });
    // Listen for hash changes
    window.addEventListener('hashchange', () => App.route());
    App.route();
  },

  toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebar-overlay');
    sidebar.classList.toggle('open');
    overlay.classList.toggle('active');
  },

  closeSidebar() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebar-overlay');
    if (sidebar) sidebar.classList.remove('open');
    if (overlay) overlay.classList.remove('active');
  },

  route() {
    const hash = window.location.hash.slice(1) || 'dashboard';
    const [routeName, ...params] = hash.split('/');
    const handler = App.routes[routeName];
    if (handler) {
      handler(...params);
    } else {
      App.routes['dashboard']();
    }
    // Update active nav
    document.querySelectorAll('.nav-link[data-route]').forEach(link => {
      link.classList.toggle('active', link.dataset.route === routeName);
    });
  },

  getContent() {
    return document.getElementById('content');
  },

  exportAll() {
    const data = Store.exportAll();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'franchise-command-center-' + new Date().toISOString().slice(0, 10) + '.json';
    a.click();
    URL.revokeObjectURL(url);
  },

  importAll(event) {
    const file = event.target.files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      alert('File too large (max 5MB)');
      event.target.value = '';
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target.result);
        if (!Store.importAll(data)) {
          alert('Import failed: invalid data format. Templates must have name and fees, scenarios must have name and inputs.');
          return;
        }
        App.route();
      } catch (err) {
        alert('Invalid JSON file');
      }
    };
    reader.readAsText(file);
    event.target.value = '';
  }
};

document.addEventListener('DOMContentLoaded', () => App.init());
