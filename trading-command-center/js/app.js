"use strict";

const App = {
  currentTab: 'dashboard',

  init() {
    // One-time: clean up account names
    [['topstep', 'funded', 'Topstep Funded'], ['apex', 'eval', 'Apex Eval']].forEach(([firm, phase, label]) => {
      const accts = Store.getAccounts()
        .filter(a => a.firm === firm && a.phase === phase)
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
      let n = 1;
      accts.forEach(a => {
        const clean = label + ' ' + n;
        if (a.name !== clean) Store.saveAccount({ id: a.id, name: clean });
        n++;
      });
    });

    document.querySelectorAll('.tab[data-tab]').forEach(tab => {
      tab.addEventListener('click', () => App.navigate(tab.dataset.tab));
    });
    const hash = window.location.hash.slice(1);
    if (['dashboard', 'journal', 'accounts', 'settings'].includes(hash)) {
      App.navigate(hash);
    } else {
      App.navigate('dashboard');
    }
    window.addEventListener('hashchange', () => {
      const h = window.location.hash.slice(1) || 'dashboard';
      const valid = ['dashboard', 'journal', 'accounts', 'settings'];
      const tab = valid.includes(h) ? h : 'dashboard';
      if (tab !== App.currentTab) App.navigate(tab);
    });
  },

  navigate(tab) {
    App.currentTab = tab;
    window.location.hash = tab;
    document.querySelectorAll('.tab[data-tab]').forEach(t => {
      t.classList.toggle('active', t.dataset.tab === tab);
    });
    App.updateHeaderCount();
    App.render();
  },

  render() {
    const el = document.getElementById('content');
    switch (App.currentTab) {
      case 'dashboard': Dashboard.render(el); break;
      case 'journal':   Journal.render(el); break;
      case 'accounts':  Accounts.render(el); break;
      case 'settings':  Settings.render(el); break;
      default:          Dashboard.render(el); break;
    }
  },

  updateHeaderCount() {
    const count = Store.getAccounts().filter(a => a.status === 'active').length;
    document.getElementById('header-account-count').textContent = count + ' Active Account' + (count !== 1 ? 's' : '');
  },

  exportAll() {
    const data = Store.exportAll();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'trading-command-center-' + UI.today() + '.json';
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
        if (!confirm('This will overwrite ALL current data. Continue?')) return;
        if (!Store.importAll(data)) {
          alert('Import failed: invalid data format.');
          return;
        }
        App.navigate(App.currentTab);
      } catch {
        alert('Invalid JSON file');
      }
    };
    reader.readAsText(file);
    event.target.value = '';
  },
};

document.addEventListener('DOMContentLoaded', () => App.init());
