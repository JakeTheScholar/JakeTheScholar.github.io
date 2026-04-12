"use strict";

const App = {
  currentTab: 'dashboard',

  async init() {
    await Auth.init();
    if (!Auth.isLoggedIn()) {
      window.location.href = '/auth.html';
      return;
    }

    const user = Auth.getUser();
    if (user && user.email) {
      const el = document.getElementById('header-user');
      if (el) el.textContent = user.email;
    }

    document.querySelectorAll('.tab[data-tab]').forEach(tab => {
      tab.addEventListener('click', () => App.navigate(tab.dataset.tab));
    });

    // Button hover glow follows cursor
    document.addEventListener('mousemove', e => {
      const btn = e.target.closest('.btn');
      if (btn) {
        const r = btn.getBoundingClientRect();
        btn.style.setProperty('--x', ((e.clientX - r.left) / r.width * 100) + '%');
        btn.style.setProperty('--y', ((e.clientY - r.top) / r.height * 100) + '%');
      }
    });

    const valid = ['dashboard', 'journal', 'accounts', 'settings'];
    const hash = window.location.hash.slice(1);
    if (valid.includes(hash)) {
      await App.navigate(hash);
    } else {
      await App.navigate('dashboard');
    }

    window.addEventListener('hashchange', () => {
      const h = window.location.hash.slice(1) || 'dashboard';
      const tab = valid.includes(h) ? h : 'dashboard';
      if (tab !== App.currentTab) App.navigate(tab);
    });
  },

  async navigate(tab) {
    App.currentTab = tab;
    window.location.hash = tab;
    document.querySelectorAll('.tab[data-tab]').forEach(t => {
      t.classList.toggle('active', t.dataset.tab === tab);
    });
    await App.render();
  },

  async render() {
    const el = document.getElementById('content');
    switch (App.currentTab) {
      case 'dashboard': await Dashboard.render(el); break;
      case 'journal':   await Journal.render(el); break;
      case 'accounts':  await Accounts.render(el); break;
      case 'settings':  Settings.render(el); break;
      default:          await Dashboard.render(el); break;
    }
  },

  setHeaderCount(accounts) {
    const count = accounts.filter(a => a.status === 'active').length;
    const el = document.getElementById('header-account-count');
    if (el) el.textContent = count + ' Active Account' + (count !== 1 ? 's' : '');
  },

  async exportAll() {
    try {
      const data = await API.exportData();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'prop-firm-tracker-' + UI.today() + '.json';
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      alert('Export failed: ' + err.message);
    }
  },

  async importTCCv1(event) {
    const file = event.target.files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      alert('File too large (max 5MB)');
      event.target.value = '';
      return;
    }
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const data = JSON.parse(e.target.result);
        if (!confirm('Import data from TCC v1? Existing data will NOT be overwritten.')) return;
        const result = await API.importData(data);
        const imp = result.imported || result;
        alert('Import complete: ' + (imp.accounts || 0) + ' accounts, ' + (imp.journal || 0) + ' entries, ' + (imp.payouts || 0) + ' payouts.');
        await App.navigate(App.currentTab);
      } catch (err) {
        alert('Import failed: ' + err.message);
      }
    };
    reader.readAsText(file);
    event.target.value = '';
  },

  async signOut() {
    await Auth.signOut();
    window.location.href = '/auth.html';
  },
};

document.addEventListener('DOMContentLoaded', () => App.init());
