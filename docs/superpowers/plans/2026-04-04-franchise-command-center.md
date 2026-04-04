# Franchise Financial Command Center — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a zero-setup static web app for evaluating, modeling, and scaling franchise investments — starting with Marco's Pizza.

**Architecture:** Single `index.html` loading separate JS files via `<script>` tags (no ES modules — must work from `file://`). Hash-based routing (`#dashboard`, `#new-analysis`, etc.) drives which view renders into a content div. All state lives in localStorage. Financial calculations are pure functions in a dedicated engine file.

**Tech Stack:** Vanilla JS, Tailwind CSS (CDN), localStorage, no build tools

---

## File Structure

```
franchise-command-center/
  index.html           - HTML shell, sidebar nav, styles, script tags
  js/store.js          - localStorage CRUD (templates, scenarios, portfolios)
  js/engine.js         - Pure financial math (P&L, break-even, ROI, portfolio stacking)
  js/ui.js             - Shared render helpers, currency formatting, Marco's default data
  js/templates.js      - Template list/create/edit/duplicate/delete views
  js/wizards.js        - Three entry point wizards (FDD, Location, Capital)
  js/scenario.js       - Scenario summary (metric cards, P&L table, sensitivity sliders)
  js/dashboard.js      - Dashboard overview (saved scenarios, quick stats)
  js/portfolio.js      - Portfolio planner (timeline view + comparison view)
  js/app.js            - Router, nav highlighting, init, export/import
  test.html            - Lightweight test runner for engine + store (opens in browser)
```

**Load order in index.html:** store.js → engine.js → ui.js → templates.js → wizards.js → scenario.js → dashboard.js → portfolio.js → app.js

Each file adds to the global namespace (e.g., `window.Store`, `window.Engine`). app.js ties them all together.

---

### Task 1: Repository scaffold + HTML shell + navigation

**Files:**
- Create: `franchise-command-center/index.html`
- Create: `franchise-command-center/js/app.js`

This task creates the new repo, the HTML skeleton with sidebar navigation, and a hash-based router. All four nav sections render placeholder content. The visual style matches the vendor-matrix (dark sidebar, gray-50 main area).

- [ ] **Step 1: Create the repository**

```bash
cd C:/Users/mcgah
mkdir franchise-command-center
cd franchise-command-center
git init
```

- [ ] **Step 2: Create index.html with sidebar + nav + script tags**

```html
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self' 'unsafe-inline' https://cdn.tailwindcss.com; style-src 'self' 'unsafe-inline' https://cdn.tailwindcss.com; frame-ancestors 'none'; base-uri 'self';">
<meta http-equiv="X-Content-Type-Options" content="nosniff">
<meta name="referrer" content="strict-origin-when-cross-origin">
<title>Franchise Command Center</title>
<link rel="icon" type="image/svg+xml" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Crect width='64' height='64' rx='14' fill='%230f172a'/%3E%3Ctext x='32' y='42' text-anchor='middle' font-size='32' fill='%2310b981'%3E%24%3C/text%3E%3C/svg%3E">
<script src="https://cdn.tailwindcss.com"></script>
<script>
tailwind.config = {
  theme: {
    extend: {
      colors: {
        brand: { 50:'#ecfdf5',100:'#d1fae5',200:'#a7f3d0',300:'#6ee7b7',400:'#34d399',500:'#10b981',600:'#059669',700:'#047857',800:'#065f46',900:'#064e3b' }
      }
    }
  }
};
</script>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; }
  .nav-link { display:flex; align-items:center; gap:12px; padding:10px 12px; border-radius:8px; font-size:14px; font-weight:500; color:#d1d5db; transition:all .15s; text-decoration:none; cursor:pointer; }
  .nav-link:hover { background:#1f2937; color:#fff; }
  .nav-link.active { background:#059669; color:#fff; }
  .wizard-step { display:none; }
  .wizard-step.active { display:block; }
  .metric-card { background:#fff; border-radius:12px; padding:20px; box-shadow:0 1px 3px rgba(0,0,0,.1); }
  .slider-track { -webkit-appearance:none; appearance:none; width:100%; height:6px; border-radius:3px; background:#e5e7eb; outline:none; }
  .slider-track::-webkit-slider-thumb { -webkit-appearance:none; appearance:none; width:18px; height:18px; border-radius:50%; background:#059669; cursor:pointer; }
  .slider-track::-moz-range-thumb { width:18px; height:18px; border-radius:50%; background:#059669; cursor:pointer; border:none; }
  @media print {
    aside { display:none !important; }
    main { margin:0 !important; }
    .no-print { display:none !important; }
    .metric-card { box-shadow:none; border:1px solid #e5e7eb; }
  }
</style>
</head>
<body class="bg-gray-50 h-screen overflow-hidden">
<div class="flex h-full">
  <!-- Sidebar -->
  <aside class="w-64 bg-gray-900 text-white flex flex-col flex-shrink-0">
    <div class="p-5 border-b border-gray-800">
      <h1 class="text-lg font-bold tracking-tight">Franchise Command</h1>
      <p class="text-xs text-gray-400 mt-1">Financial Planning Engine</p>
    </div>
    <nav class="flex-1 p-3 space-y-1">
      <a class="nav-link" data-route="dashboard">
        <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-4 0a1 1 0 01-1-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 01-1 1h-2z"/></svg>
        Dashboard
      </a>
      <a class="nav-link" data-route="new-analysis">
        <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M12 4v16m8-8H4"/></svg>
        New Analysis
      </a>
      <a class="nav-link" data-route="portfolio">
        <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M9 19V6l12-3v13M9 19c0 1.1-1.3 2-3 2s-3-.9-3-2 1.3-2 3-2 3 .9 3 2z"/><path d="M21 16c0 1.1-1.3 2-3 2s-3-.9-3-2 1.3-2 3-2 3 .9 3 2z"/></svg>
        Portfolio Planner
      </a>
      <a class="nav-link" data-route="templates">
        <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zm0 8a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zm12 0a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z"/></svg>
        Templates
      </a>
    </nav>
    <div class="p-4 border-t border-gray-800 no-print">
      <button onclick="App.exportAll()" class="text-xs text-gray-500 hover:text-gray-300 cursor-pointer">Export Data (JSON)</button>
      <label class="text-xs text-gray-500 hover:text-gray-300 cursor-pointer block mt-1">
        Import Data <input type="file" accept=".json" class="hidden" onchange="App.importAll(event)">
      </label>
      <p class="text-xs text-gray-600 mt-2">Data stored locally in browser</p>
    </div>
  </aside>
  <!-- Main Content -->
  <main class="flex-1 overflow-auto">
    <div class="p-8 max-w-7xl mx-auto" id="content"></div>
  </main>
</div>

<script src="js/store.js"></script>
<script src="js/engine.js"></script>
<script src="js/ui.js"></script>
<script src="js/templates.js"></script>
<script src="js/wizards.js"></script>
<script src="js/scenario.js"></script>
<script src="js/dashboard.js"></script>
<script src="js/portfolio.js"></script>
<script src="js/app.js"></script>
</body>
</html>
```

- [ ] **Step 3: Create js/app.js with router and init**

```js
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
      });
    });
    // Listen for hash changes
    window.addEventListener('hashchange', () => App.route());
    App.route();
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
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target.result);
        Store.importAll(data);
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
```

- [ ] **Step 4: Create placeholder JS files so the page loads**

Create each of these files with a minimal global object so index.html loads without errors:

**js/store.js:**
```js
"use strict";
const Store = {
  _get(key) { try { return JSON.parse(localStorage.getItem('fcc_' + key)) || []; } catch { return []; } },
  _set(key, val) { localStorage.setItem('fcc_' + key, JSON.stringify(val)); },
  _uuid() { return crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2); },
  getTemplates() { return this._get('templates'); },
  saveTemplate(t) { /* placeholder */ return t; },
  getScenarios() { return this._get('scenarios'); },
  getPortfolios() { return this._get('portfolios'); },
  exportAll() { return { templates: this.getTemplates(), scenarios: this.getScenarios(), portfolios: this.getPortfolios() }; },
  importAll(data) { /* placeholder */ }
};
```

**js/engine.js:**
```js
"use strict";
const Engine = {};
```

**js/ui.js:**
```js
"use strict";
const UI = {
  MARCOS_DEFAULT_TEMPLATE: { name: "Marco's Pizza", fees: { royaltyPct: 5.5, adFundPct: 2.0, otherFees: [] }, costDefaults: { foodCostPct: { low: 28, mid: 30, high: 32 }, laborPct: { low: 25, mid: 27, high: 30 }, utilitiesMonthly: 2500, insuranceMonthly: 800, otherMonthly: 500 }, investmentRange: { low: 250000, mid: 350000, high: 500000 }, revenueBenchmarks: { low: 50000, mid: 70000, high: 95000 }, termYears: 10 }
};
```

**js/templates.js:**
```js
"use strict";
const Templates = { render() { App.getContent().innerHTML = '<h2 class="text-2xl font-bold text-gray-900">Templates</h2><p class="text-gray-500 mt-2">Coming soon...</p>'; } };
```

**js/wizards.js:**
```js
"use strict";
const Wizards = { render() { App.getContent().innerHTML = '<h2 class="text-2xl font-bold text-gray-900">New Analysis</h2><p class="text-gray-500 mt-2">Coming soon...</p>'; } };
```

**js/scenario.js:**
```js
"use strict";
const Scenario = { render(id) { App.getContent().innerHTML = '<h2 class="text-2xl font-bold text-gray-900">Scenario</h2><p class="text-gray-500 mt-2">Coming soon...</p>'; } };
```

**js/dashboard.js:**
```js
"use strict";
const Dashboard = { render() { App.getContent().innerHTML = '<h2 class="text-2xl font-bold text-gray-900">Dashboard</h2><p class="text-gray-500 mt-2">Coming soon...</p>'; } };
```

**js/portfolio.js:**
```js
"use strict";
const Portfolio = { render() { App.getContent().innerHTML = '<h2 class="text-2xl font-bold text-gray-900">Portfolio Planner</h2><p class="text-gray-500 mt-2">Coming soon...</p>'; } };
```

- [ ] **Step 5: Open index.html in browser and verify**

Open `franchise-command-center/index.html` in browser. Verify:
- Dark sidebar renders with 4 nav links
- Clicking each nav link changes the hash and shows the placeholder text
- Dashboard is the default view
- Export/Import buttons visible in sidebar footer
- No console errors

- [ ] **Step 6: Commit**

```bash
cd C:/Users/mcgah/franchise-command-center
git add -A
git commit -m "feat: scaffold HTML shell with sidebar nav and hash router"
```

---

### Task 2: Data layer (store.js)

**Files:**
- Modify: `js/store.js`
- Create: `test.html`

Full CRUD for templates, scenarios, and portfolios. JSON export/import. All methods are synchronous localStorage operations.

- [ ] **Step 1: Create test.html**

```html
<!DOCTYPE html>
<html><head><title>FCC Tests</title>
<style>
  body { font-family: monospace; padding: 20px; background: #111; color: #eee; }
  .pass { color: #10b981; } .fail { color: #ef4444; font-weight: bold; }
  h2 { color: #60a5fa; margin-top: 24px; }
</style>
</head><body>
<h1>Franchise Command Center — Tests</h1>
<div id="results"></div>

<script src="js/store.js"></script>
<script src="js/engine.js"></script>
<script src="js/ui.js"></script>
<script>
"use strict";
const results = document.getElementById('results');
let passed = 0, failed = 0;

function assert(condition, msg) {
  if (condition) { passed++; log(msg, true); }
  else { failed++; log(msg, false); }
}
function log(msg, ok) {
  results.innerHTML += '<div class="' + (ok ? 'pass' : 'fail') + '">' + (ok ? 'PASS' : 'FAIL') + ': ' + msg + '</div>';
}
function section(name) {
  results.innerHTML += '<h2>' + name + '</h2>';
}
function clearStore() {
  Object.keys(localStorage).filter(k => k.startsWith('fcc_')).forEach(k => localStorage.removeItem(k));
}

// ── Store Tests ──
clearStore();
section('Store — Templates');

const t1 = Store.saveTemplate({ name: 'Test Franchise', fees: { royaltyPct: 6, adFundPct: 1.5, otherFees: [] }, costDefaults: { foodCostPct: { low: 25, mid: 28, high: 32 }, laborPct: { low: 22, mid: 25, high: 28 }, utilitiesMonthly: 2000, insuranceMonthly: 700, otherMonthly: 400 }, investmentRange: { low: 200000, mid: 300000, high: 400000 }, revenueBenchmarks: { low: 40000, mid: 60000, high: 80000 }, termYears: 10 });
assert(t1.id !== undefined, 'saveTemplate assigns an id');
assert(t1.created !== undefined, 'saveTemplate assigns created date');
assert(Store.getTemplates().length === 1, 'getTemplates returns 1 template');
assert(Store.getTemplate(t1.id).name === 'Test Franchise', 'getTemplate by id works');

const t1Updated = Store.saveTemplate({ ...t1, name: 'Updated Franchise' });
assert(Store.getTemplate(t1.id).name === 'Updated Franchise', 'saveTemplate updates existing by id');
assert(Store.getTemplates().length === 1, 'update does not create duplicate');

const t2 = Store.saveTemplate({ name: 'Second Franchise', fees: { royaltyPct: 5, adFundPct: 2, otherFees: [] }, costDefaults: { foodCostPct: { low: 26, mid: 29, high: 33 }, laborPct: { low: 23, mid: 26, high: 29 }, utilitiesMonthly: 2200, insuranceMonthly: 750, otherMonthly: 450 }, investmentRange: { low: 220000, mid: 320000, high: 420000 }, revenueBenchmarks: { low: 45000, mid: 65000, high: 85000 }, termYears: 15 });
Store.deleteTemplate(t2.id);
assert(Store.getTemplates().length === 1, 'deleteTemplate removes template');

section('Store — Scenarios');

const s1 = Store.saveScenario({ name: 'Main St Location', templateId: t1.id, templateName: 'Updated Franchise', entryPoint: 'fdd', inputs: { totalInvestment: 350000, downPayment: 100000, monthlyRevenue: 70000, rentMonthly: 4500, foodCostPct: 30, laborPct: 27, royaltyPct: 5.5, adFundPct: 2, utilitiesMonthly: 2500, insuranceMonthly: 800, otherMonthly: 500 }, computed: {} });
assert(s1.id !== undefined, 'saveScenario assigns an id');
assert(Store.getScenarios().length === 1, 'getScenarios returns 1');
assert(Store.getScenario(s1.id).name === 'Main St Location', 'getScenario by id works');

Store.deleteScenario(s1.id);
assert(Store.getScenarios().length === 0, 'deleteScenario removes scenario');

section('Store — Portfolios');

const p1 = Store.savePortfolio({ name: 'Growth Plan', locations: [] });
assert(p1.id !== undefined, 'savePortfolio assigns an id');
assert(Store.getPortfolios().length === 1, 'getPortfolios returns 1');

Store.deletePortfolio(p1.id);
assert(Store.getPortfolios().length === 0, 'deletePortfolio removes portfolio');

section('Store — Export/Import');

clearStore();
Store.saveTemplate({ name: 'Export Test', fees: { royaltyPct: 6, adFundPct: 1, otherFees: [] }, costDefaults: { foodCostPct: { low: 25, mid: 28, high: 32 }, laborPct: { low: 22, mid: 25, high: 28 }, utilitiesMonthly: 2000, insuranceMonthly: 700, otherMonthly: 400 }, investmentRange: { low: 200000, mid: 300000, high: 400000 }, revenueBenchmarks: { low: 40000, mid: 60000, high: 80000 }, termYears: 10 });
const exported = Store.exportAll();
assert(exported.templates.length === 1, 'exportAll includes templates');
clearStore();
assert(Store.getTemplates().length === 0, 'clearStore cleared templates');
Store.importAll(exported);
assert(Store.getTemplates().length === 1, 'importAll restores templates');

// ── Summary ──
results.innerHTML += '<h2>Results: ' + passed + ' passed, ' + failed + ' failed</h2>';
</script>
</body></html>
```

- [ ] **Step 2: Implement full store.js**

```js
"use strict";

const Store = {
  _get(key) {
    try { return JSON.parse(localStorage.getItem('fcc_' + key)) || []; }
    catch { return []; }
  },
  _set(key, val) {
    localStorage.setItem('fcc_' + key, JSON.stringify(val));
  },
  _uuid() {
    return crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2);
  },

  // ── Templates ──
  getTemplates() { return this._get('templates'); },
  getTemplate(id) { return this.getTemplates().find(t => t.id === id) || null; },
  saveTemplate(data) {
    const all = this.getTemplates();
    if (data.id) {
      const i = all.findIndex(t => t.id === data.id);
      if (i >= 0) { all[i] = { ...all[i], ...data }; }
      else { all.push(data); }
    } else {
      data.id = this._uuid();
      data.created = new Date().toISOString().slice(0, 10);
      all.push(data);
    }
    this._set('templates', all);
    return data;
  },
  deleteTemplate(id) {
    this._set('templates', this.getTemplates().filter(t => t.id !== id));
  },

  // ── Scenarios ──
  getScenarios() { return this._get('scenarios'); },
  getScenario(id) { return this.getScenarios().find(s => s.id === id) || null; },
  saveScenario(data) {
    const all = this.getScenarios();
    if (data.id) {
      const i = all.findIndex(s => s.id === data.id);
      if (i >= 0) { all[i] = { ...all[i], ...data }; }
      else { all.push(data); }
    } else {
      data.id = this._uuid();
      data.created = new Date().toISOString().slice(0, 10);
      all.push(data);
    }
    this._set('scenarios', all);
    return data;
  },
  deleteScenario(id) {
    this._set('scenarios', this.getScenarios().filter(s => s.id !== id));
    // Also remove from any portfolios
    const portfolios = this.getPortfolios().map(p => ({
      ...p,
      locations: p.locations.filter(l => l.scenarioId !== id)
    }));
    this._set('portfolios', portfolios);
  },

  // ── Portfolios ──
  getPortfolios() { return this._get('portfolios'); },
  getPortfolio(id) { return this.getPortfolios().find(p => p.id === id) || null; },
  savePortfolio(data) {
    const all = this.getPortfolios();
    if (data.id) {
      const i = all.findIndex(p => p.id === data.id);
      if (i >= 0) { all[i] = { ...all[i], ...data }; }
      else { all.push(data); }
    } else {
      data.id = this._uuid();
      data.created = new Date().toISOString().slice(0, 10);
      all.push(data);
    }
    this._set('portfolios', all);
    return data;
  },
  deletePortfolio(id) {
    this._set('portfolios', this.getPortfolios().filter(p => p.id !== id));
  },

  // ── Export / Import ──
  exportAll() {
    return {
      templates: this.getTemplates(),
      scenarios: this.getScenarios(),
      portfolios: this.getPortfolios()
    };
  },
  importAll(data) {
    if (data.templates) this._set('templates', data.templates);
    if (data.scenarios) this._set('scenarios', data.scenarios);
    if (data.portfolios) this._set('portfolios', data.portfolios);
  }
};
```

- [ ] **Step 3: Open test.html in browser, verify all tests pass**

Expected: all PASS, 0 failures.

- [ ] **Step 4: Commit**

```bash
git add js/store.js test.html
git commit -m "feat: implement localStorage data layer with full CRUD + tests"
```

---

### Task 3: Financial calculation engine (engine.js)

**Files:**
- Modify: `js/engine.js`
- Modify: `test.html` (add engine tests)

Pure functions — no DOM, no Store. Takes inputs, returns computed results.

- [ ] **Step 1: Implement engine.js**

```js
"use strict";

const Engine = {
  /**
   * Calculate full scenario financials from inputs.
   * @param {Object} inputs — scenario.inputs from data model
   * @returns {Object} computed metrics
   */
  calcScenario(inputs) {
    const revenue = inputs.monthlyRevenue;
    const foodCost = revenue * (inputs.foodCostPct / 100);
    const labor = revenue * (inputs.laborPct / 100);
    const royalty = revenue * (inputs.royaltyPct / 100);
    const adFund = revenue * (inputs.adFundPct / 100);
    const rent = inputs.rentMonthly;
    const utilities = inputs.utilitiesMonthly;
    const insurance = inputs.insuranceMonthly;
    const other = inputs.otherMonthly;

    const totalExpenses = foodCost + labor + royalty + adFund + rent + utilities + insurance + other;
    const monthlyCashFlow = revenue - totalExpenses;

    const totalInvestment = inputs.totalInvestment;
    const breakEvenMonth = monthlyCashFlow > 0 ? Math.ceil(totalInvestment / monthlyCashFlow) : -1;
    const annualCashFlow = monthlyCashFlow * 12;
    const firstYearROI = totalInvestment > 0 ? (annualCashFlow / totalInvestment) * 100 : 0;
    const annualOwnerEarnings = annualCashFlow; // v1: same as cash flow (no debt service yet)

    return {
      monthlyCashFlow: Math.round(monthlyCashFlow * 100) / 100,
      breakEvenMonth,
      firstYearROI: Math.round(firstYearROI * 100) / 100,
      annualOwnerEarnings: Math.round(annualOwnerEarnings * 100) / 100,
      // Detailed line items for P&L
      lineItems: {
        revenue,
        foodCost: Math.round(foodCost * 100) / 100,
        labor: Math.round(labor * 100) / 100,
        royalty: Math.round(royalty * 100) / 100,
        adFund: Math.round(adFund * 100) / 100,
        rent,
        utilities,
        insurance,
        other,
        totalExpenses: Math.round(totalExpenses * 100) / 100,
        netCashFlow: Math.round(monthlyCashFlow * 100) / 100,
      }
    };
  },

  /**
   * Build P&L with percentage-of-revenue column.
   * @param {Object} lineItems — from calcScenario().lineItems
   * @returns {Array} rows with { label, amount, pctOfRevenue }
   */
  buildPnL(lineItems) {
    const rev = lineItems.revenue;
    const pct = (val) => rev > 0 ? Math.round((val / rev) * 1000) / 10 : 0;
    return [
      { label: 'Gross Revenue',  amount: rev,                  pctOfRevenue: 100 },
      { label: 'Food Cost',      amount: -lineItems.foodCost,  pctOfRevenue: pct(lineItems.foodCost) },
      { label: 'Labor',          amount: -lineItems.labor,     pctOfRevenue: pct(lineItems.labor) },
      { label: 'Royalty Fee',    amount: -lineItems.royalty,    pctOfRevenue: pct(lineItems.royalty) },
      { label: 'Ad Fund',        amount: -lineItems.adFund,    pctOfRevenue: pct(lineItems.adFund) },
      { label: 'Rent',           amount: -lineItems.rent,      pctOfRevenue: pct(lineItems.rent) },
      { label: 'Utilities',      amount: -lineItems.utilities, pctOfRevenue: pct(lineItems.utilities) },
      { label: 'Insurance',      amount: -lineItems.insurance, pctOfRevenue: pct(lineItems.insurance) },
      { label: 'Other',          amount: -lineItems.other,     pctOfRevenue: pct(lineItems.other) },
      { label: 'Net Cash Flow',  amount: lineItems.netCashFlow, pctOfRevenue: pct(Math.abs(lineItems.netCashFlow)), isTotal: true },
    ];
  },

  /**
   * Calculate portfolio timeline — stacked monthly cash flow across locations.
   * @param {Array} locations — [{ scenario, openMonth }]
   * @param {number} months — how many months to project (default 60)
   * @returns {Object} { monthly: [{month, cashFlow, byLocation}], milestones: [...] }
   */
  calcPortfolioTimeline(locations, months) {
    months = months || 60;
    const monthly = [];
    let cumulativeCashFlow = 0;
    let totalInvestment = 0;
    const milestones = [];
    const locationBreakEven = {};

    for (let m = 0; m < months; m++) {
      let monthCashFlow = 0;
      const byLocation = [];

      locations.forEach((loc, idx) => {
        const monthsSinceOpen = m - loc.openMonth;
        if (monthsSinceOpen < 0) {
          byLocation.push(0);
          return;
        }
        if (monthsSinceOpen === 0) {
          totalInvestment += loc.scenario.inputs.totalInvestment;
          milestones.push({ month: m, text: loc.scenario.name + ' opens' });
        }
        const computed = Engine.calcScenario(loc.scenario.inputs);
        const cf = computed.monthlyCashFlow;
        monthCashFlow += cf;
        byLocation.push(cf);

        // Track individual break-even
        if (!locationBreakEven[idx]) locationBreakEven[idx] = { cumulative: 0, done: false };
        if (!locationBreakEven[idx].done) {
          locationBreakEven[idx].cumulative += cf;
          if (locationBreakEven[idx].cumulative >= loc.scenario.inputs.totalInvestment) {
            locationBreakEven[idx].done = true;
            milestones.push({ month: m, text: loc.scenario.name + ' breaks even' });
          }
        }
      });

      cumulativeCashFlow += monthCashFlow;
      monthly.push({ month: m, cashFlow: Math.round(monthCashFlow * 100) / 100, cumulative: Math.round(cumulativeCashFlow * 100) / 100, byLocation });

      // Check if cumulative covers next location's investment
      const nextUnopened = locations.find(l => l.openMonth > m);
      if (nextUnopened && cumulativeCashFlow >= nextUnopened.scenario.inputs.totalInvestment) {
        const existing = milestones.find(ms => ms.text.includes('cash flow covers'));
        if (!existing) {
          milestones.push({ month: m, text: 'Cash flow covers ' + nextUnopened.scenario.name + ' investment' });
        }
      }
    }

    return {
      monthly,
      milestones: milestones.sort((a, b) => a.month - b.month),
      totalInvestment,
      combinedMonthlyCashFlow: monthly.length > 0 ? monthly[monthly.length - 1].cashFlow : 0,
      portfolioROI: totalInvestment > 0 ? Math.round(((cumulativeCashFlow / totalInvestment) * 100) * 100) / 100 : 0
    };
  },

  /**
   * Capital feasibility check — given available capital, what's realistic?
   * @param {Object} template — franchise template
   * @param {number} capital — total available capital
   * @param {number} maxDown — max down payment
   * @param {number} minCashFlow — minimum acceptable monthly cash flow
   * @returns {Object} feasibility analysis
   */
  calcCapitalFeasibility(template, capital, maxDown, minCashFlow) {
    const investmentLevels = ['low', 'mid', 'high'];
    const results = investmentLevels.map(level => {
      const investment = template.investmentRange[level];
      const revenue = template.revenueBenchmarks[level];
      const inputs = {
        totalInvestment: investment,
        downPayment: Math.min(maxDown, investment),
        monthlyRevenue: revenue,
        rentMonthly: 4500, // reasonable default
        foodCostPct: template.costDefaults.foodCostPct.mid,
        laborPct: template.costDefaults.laborPct.mid,
        royaltyPct: template.fees.royaltyPct,
        adFundPct: template.fees.adFundPct,
        utilitiesMonthly: template.costDefaults.utilitiesMonthly,
        insuranceMonthly: template.costDefaults.insuranceMonthly,
        otherMonthly: template.costDefaults.otherMonthly,
      };
      const computed = Engine.calcScenario(inputs);
      return {
        level,
        investment,
        revenue,
        feasible: investment <= capital && computed.monthlyCashFlow >= minCashFlow,
        monthlyCashFlow: computed.monthlyCashFlow,
        breakEvenMonth: computed.breakEvenMonth,
        inputs,
        computed,
      };
    });

    // Calculate required revenue for break-even at mid investment
    const midInvestment = template.investmentRange.mid;
    const expensePct = (template.costDefaults.foodCostPct.mid + template.costDefaults.laborPct.mid + template.fees.royaltyPct + template.fees.adFundPct) / 100;
    const fixedExpenses = 4500 + template.costDefaults.utilitiesMonthly + template.costDefaults.insuranceMonthly + template.costDefaults.otherMonthly;
    const requiredRevenueForBreakEven = expensePct < 1 ? Math.ceil(fixedExpenses / (1 - expensePct)) : -1;

    return { results, requiredRevenueForBreakEven };
  }
};
```

- [ ] **Step 2: Add engine tests to test.html**

Add this block after the Store tests in test.html (before the summary):

```js
// ── Engine Tests ──
section('Engine — calcScenario');

const scenarioInputs = {
  totalInvestment: 350000,
  downPayment: 100000,
  monthlyRevenue: 70000,
  rentMonthly: 4500,
  foodCostPct: 30,
  laborPct: 27,
  royaltyPct: 5.5,
  adFundPct: 2,
  utilitiesMonthly: 2500,
  insuranceMonthly: 800,
  otherMonthly: 500
};

const result = Engine.calcScenario(scenarioInputs);
// Food: 21000, Labor: 18900, Royalty: 3850, Ad: 1400, Rent: 4500, Util: 2500, Ins: 800, Other: 500
// Total expenses: 53450, Cash flow: 16550
assert(result.lineItems.foodCost === 21000, 'food cost = 70000 * 30% = 21000');
assert(result.lineItems.labor === 18900, 'labor = 70000 * 27% = 18900');
assert(result.lineItems.royalty === 3850, 'royalty = 70000 * 5.5% = 3850');
assert(result.lineItems.netCashFlow === 16550, 'net cash flow = 70000 - 53450 = 16550');
assert(result.monthlyCashFlow === 16550, 'monthlyCashFlow matches');
assert(result.breakEvenMonth === 22, 'break-even = ceil(350000/16550) = 22 months');
assert(result.firstYearROI === 56.74, 'first year ROI = (16550*12)/350000 * 100 = 56.74%');

section('Engine — buildPnL');
const pnl = Engine.buildPnL(result.lineItems);
assert(pnl.length === 10, 'P&L has 10 rows');
assert(pnl[0].label === 'Gross Revenue', 'first row is revenue');
assert(pnl[9].label === 'Net Cash Flow', 'last row is net cash flow');
assert(pnl[9].isTotal === true, 'last row marked as total');
assert(pnl[1].pctOfRevenue === 30, 'food cost pct = 30%');

section('Engine — calcPortfolioTimeline');
const loc1 = { scenario: { name: 'Location 1', inputs: scenarioInputs }, openMonth: 0 };
const loc2 = { scenario: { name: 'Location 2', inputs: { ...scenarioInputs, monthlyRevenue: 60000 } }, openMonth: 12 };
const timeline = Engine.calcPortfolioTimeline([loc1, loc2], 24);
assert(timeline.monthly.length === 24, 'timeline has 24 months');
assert(timeline.monthly[0].cashFlow === 16550, 'month 0 = location 1 cash flow only');
assert(timeline.milestones.find(m => m.text === 'Location 1 opens') !== undefined, 'location 1 opens milestone');
assert(timeline.milestones.find(m => m.text === 'Location 2 opens') !== undefined, 'location 2 opens milestone');
// Month 12: loc1 = 16550, loc2 = 60000 - (18000+16200+3300+1200+4500+2500+800+500) = 60000-47000 = 13000
assert(timeline.monthly[12].cashFlow === 16550 + 13000, 'month 12 = both locations stacked');

section('Engine — calcCapitalFeasibility');
const tmpl = UI.MARCOS_DEFAULT_TEMPLATE;
const feasibility = Engine.calcCapitalFeasibility(tmpl, 350000, 100000, 5000);
assert(feasibility.results.length === 3, 'feasibility has low/mid/high results');
assert(feasibility.results[0].level === 'low', 'first result is low');
assert(typeof feasibility.requiredRevenueForBreakEven === 'number', 'requiredRevenue is a number');
```

- [ ] **Step 3: Open test.html, verify all tests pass**

Expected: all previous Store tests still pass + all new Engine tests pass.

- [ ] **Step 4: Commit**

```bash
git add js/engine.js test.html
git commit -m "feat: implement financial engine with P&L, portfolio timeline, capital feasibility"
```

---

### Task 4: UI helpers + Marco's default template (ui.js)

**Files:**
- Modify: `js/ui.js`

Shared formatting functions and reusable UI components used across all views.

- [ ] **Step 1: Implement ui.js**

```js
"use strict";

const UI = {
  // ── Marco's Pizza Default Template ──
  MARCOS_DEFAULT_TEMPLATE: {
    name: "Marco's Pizza",
    fees: { royaltyPct: 5.5, adFundPct: 2.0, otherFees: [] },
    costDefaults: {
      foodCostPct: { low: 28, mid: 30, high: 32 },
      laborPct: { low: 25, mid: 27, high: 30 },
      utilitiesMonthly: 2500,
      insuranceMonthly: 800,
      otherMonthly: 500
    },
    investmentRange: { low: 250000, mid: 350000, high: 500000 },
    revenueBenchmarks: { low: 50000, mid: 70000, high: 95000 },
    termYears: 10
  },

  // ── Formatters ──
  currency(val) {
    if (val === undefined || val === null) return '$0';
    const abs = Math.abs(val);
    const formatted = abs >= 1000 ? '$' + abs.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) : '$' + abs.toFixed(2);
    return val < 0 ? '-' + formatted : formatted;
  },

  currencyCompact(val) {
    if (Math.abs(val) >= 1000000) return '$' + (val / 1000000).toFixed(1) + 'M';
    if (Math.abs(val) >= 1000) return '$' + (val / 1000).toFixed(0) + 'k';
    return '$' + val.toFixed(0);
  },

  pct(val) {
    return val.toFixed(1) + '%';
  },

  months(val) {
    if (val < 0) return 'Never';
    if (val === 1) return '1 month';
    return val + ' months';
  },

  // ── Reusable Components ──
  metricCard(label, value, sub) {
    return '<div class="metric-card"><p class="text-xs font-medium text-gray-500 uppercase tracking-wide">' + label + '</p><p class="text-2xl font-bold text-gray-900 mt-1">' + value + '</p>' + (sub ? '<p class="text-xs text-gray-400 mt-1">' + sub + '</p>' : '') + '</div>';
  },

  emptyState(icon, title, subtitle, actionHtml) {
    return '<div class="text-center py-16"><div class="text-gray-300 text-5xl mb-4">' + icon + '</div><h3 class="text-lg font-semibold text-gray-700">' + title + '</h3><p class="text-gray-500 mt-1">' + subtitle + '</p>' + (actionHtml ? '<div class="mt-4">' + actionHtml + '</div>' : '') + '</div>';
  },

  button(text, onclick, style) {
    const styles = {
      primary: 'bg-emerald-600 text-white hover:bg-emerald-700',
      secondary: 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50',
      danger: 'bg-red-50 text-red-600 hover:bg-red-100 border border-red-200',
    };
    return '<button onclick="' + onclick + '" class="px-4 py-2 rounded-lg text-sm font-medium transition-colors ' + (styles[style || 'primary'] || styles.primary) + '">' + text + '</button>';
  },

  pageHeader(title, subtitle, actionHtml) {
    return '<div class="flex items-center justify-between mb-8"><div><h2 class="text-2xl font-bold text-gray-900">' + title + '</h2>' + (subtitle ? '<p class="text-gray-500 mt-1">' + subtitle + '</p>' : '') + '</div>' + (actionHtml ? '<div>' + actionHtml + '</div>' : '') + '</div>';
  },

  // ── Form Helpers ──
  inputField(label, name, value, type, opts) {
    opts = opts || {};
    const prefix = opts.prefix || '';
    const suffix = opts.suffix || '';
    const step = opts.step || 'any';
    return '<div class="' + (opts.className || '') + '"><label class="block text-sm font-medium text-gray-700 mb-1">' + label + '</label><div class="relative">' + (prefix ? '<span class="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">' + prefix + '</span>' : '') + '<input type="' + (type || 'number') + '" name="' + name + '" value="' + (value !== undefined ? value : '') + '" step="' + step + '" class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 ' + (prefix ? 'pl-7' : '') + (suffix ? ' pr-8' : '') + '">' + (suffix ? '<span class="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">' + suffix + '</span>' : '') + '</div></div>';
  },

  selectField(label, name, options, selectedValue) {
    const optionsHtml = options.map(o => {
      const val = typeof o === 'object' ? o.value : o;
      const text = typeof o === 'object' ? o.label : o;
      return '<option value="' + val + '"' + (val === selectedValue ? ' selected' : '') + '>' + text + '</option>';
    }).join('');
    return '<div><label class="block text-sm font-medium text-gray-700 mb-1">' + label + '</label><select name="' + name + '" class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500">' + optionsHtml + '</select></div>';
  },

  // ── Table ──
  table(headers, rows, opts) {
    opts = opts || {};
    const thClass = 'px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider';
    const tdClass = 'px-4 py-3 text-sm';
    let html = '<div class="overflow-x-auto rounded-lg border border-gray-200"><table class="min-w-full divide-y divide-gray-200"><thead class="bg-gray-50"><tr>';
    headers.forEach(h => { html += '<th class="' + thClass + '">' + h + '</th>'; });
    html += '</tr></thead><tbody class="bg-white divide-y divide-gray-200">';
    rows.forEach((row, i) => {
      const rowClass = row._isTotal ? 'font-bold bg-gray-50' : (i % 2 === 1 ? 'bg-gray-50/50' : '');
      html += '<tr class="' + rowClass + '">';
      row.cells.forEach(cell => { html += '<td class="' + tdClass + '">' + cell + '</td>'; });
      html += '</tr>';
    });
    html += '</tbody></table></div>';
    return html;
  },

  // ── Color coding for comparisons ──
  rankColor(rank, total) {
    if (total <= 1) return '';
    if (rank === 0) return 'text-emerald-600 font-semibold';
    if (rank === total - 1) return 'text-red-500';
    return 'text-gray-700';
  }
};
```

- [ ] **Step 2: Open index.html in browser, verify no errors in console**

- [ ] **Step 3: Commit**

```bash
git add js/ui.js
git commit -m "feat: add UI helpers, formatters, and Marco's Pizza default template"
```

---

### Task 5: Template management views (templates.js)

**Files:**
- Modify: `js/templates.js`

List all templates, create new, edit existing, duplicate, delete. Full CRUD UI for franchise templates.

- [ ] **Step 1: Implement templates.js**

```js
"use strict";

const Templates = {
  render() {
    const templates = Store.getTemplates();
    const el = App.getContent();

    if (templates.length === 0) {
      el.innerHTML = UI.pageHeader('Templates', 'Manage franchise brand profiles') +
        UI.emptyState('&#128203;', 'No templates yet', 'Create a franchise template to get started.',
          UI.button('Create Template', 'Templates.showForm()', 'primary'));
      return;
    }

    let html = UI.pageHeader('Templates', templates.length + ' franchise profile' + (templates.length > 1 ? 's' : ''),
      UI.button('+ New Template', 'Templates.showForm()', 'primary'));

    html += '<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">';
    templates.forEach(t => {
      html += '<div class="bg-white rounded-lg border border-gray-200 p-5 hover:shadow-md transition-shadow">';
      html += '<div class="flex items-start justify-between"><h3 class="font-semibold text-gray-900">' + t.name + '</h3>';
      html += '<span class="text-xs text-gray-400">' + (t.created || '') + '</span></div>';
      html += '<div class="mt-3 space-y-1 text-sm text-gray-600">';
      html += '<p>Royalty: ' + t.fees.royaltyPct + '% &middot; Ad Fund: ' + t.fees.adFundPct + '%</p>';
      html += '<p>Investment: ' + UI.currencyCompact(t.investmentRange.low) + ' &ndash; ' + UI.currencyCompact(t.investmentRange.high) + '</p>';
      html += '<p>Revenue: ' + UI.currencyCompact(t.revenueBenchmarks.low) + ' &ndash; ' + UI.currencyCompact(t.revenueBenchmarks.high) + '/mo</p>';
      html += '</div>';
      html += '<div class="mt-4 flex gap-2">';
      html += UI.button('Edit', "Templates.showForm('" + t.id + "')", 'secondary');
      html += UI.button('Duplicate', "Templates.duplicate('" + t.id + "')", 'secondary');
      html += UI.button('Delete', "Templates.confirmDelete('" + t.id + "')", 'danger');
      html += '</div></div>';
    });
    html += '</div>';
    el.innerHTML = html;
  },

  showForm(id) {
    const existing = id ? Store.getTemplate(id) : null;
    const t = existing || {
      name: '', fees: { royaltyPct: 5, adFundPct: 2, otherFees: [] },
      costDefaults: { foodCostPct: { low: 25, mid: 28, high: 32 }, laborPct: { low: 22, mid: 25, high: 28 }, utilitiesMonthly: 2000, insuranceMonthly: 700, otherMonthly: 400 },
      investmentRange: { low: 200000, mid: 300000, high: 400000 },
      revenueBenchmarks: { low: 40000, mid: 60000, high: 80000 },
      termYears: 10
    };

    const el = App.getContent();
    let html = UI.pageHeader(existing ? 'Edit Template' : 'New Template', 'Define franchise brand defaults',
      UI.button('&larr; Back', 'Templates.render()', 'secondary'));

    html += '<form id="template-form" class="bg-white rounded-lg border border-gray-200 p-6 space-y-6">';

    // Basic Info
    html += '<div class="border-b border-gray-100 pb-4"><h3 class="font-semibold text-gray-900 mb-3">Basic Info</h3>';
    html += '<div class="grid grid-cols-2 gap-4">';
    html += UI.inputField('Franchise Name', 'name', t.name, 'text');
    html += UI.inputField('Term (years)', 'termYears', t.termYears, 'number');
    html += '</div></div>';

    // Fees
    html += '<div class="border-b border-gray-100 pb-4"><h3 class="font-semibold text-gray-900 mb-3">Fee Structure</h3>';
    html += '<div class="grid grid-cols-2 gap-4">';
    html += UI.inputField('Royalty', 'royaltyPct', t.fees.royaltyPct, 'number', { suffix: '%', step: '0.1' });
    html += UI.inputField('Ad Fund', 'adFundPct', t.fees.adFundPct, 'number', { suffix: '%', step: '0.1' });
    html += '</div></div>';

    // Cost Defaults
    html += '<div class="border-b border-gray-100 pb-4"><h3 class="font-semibold text-gray-900 mb-3">Cost Defaults</h3>';
    html += '<div class="grid grid-cols-3 gap-4">';
    html += UI.inputField('Food Cost Low', 'foodCostLow', t.costDefaults.foodCostPct.low, 'number', { suffix: '%' });
    html += UI.inputField('Food Cost Mid', 'foodCostMid', t.costDefaults.foodCostPct.mid, 'number', { suffix: '%' });
    html += UI.inputField('Food Cost High', 'foodCostHigh', t.costDefaults.foodCostPct.high, 'number', { suffix: '%' });
    html += UI.inputField('Labor Low', 'laborLow', t.costDefaults.laborPct.low, 'number', { suffix: '%' });
    html += UI.inputField('Labor Mid', 'laborMid', t.costDefaults.laborPct.mid, 'number', { suffix: '%' });
    html += UI.inputField('Labor High', 'laborHigh', t.costDefaults.laborPct.high, 'number', { suffix: '%' });
    html += '</div>';
    html += '<div class="grid grid-cols-3 gap-4 mt-3">';
    html += UI.inputField('Utilities/mo', 'utilitiesMonthly', t.costDefaults.utilitiesMonthly, 'number', { prefix: '$' });
    html += UI.inputField('Insurance/mo', 'insuranceMonthly', t.costDefaults.insuranceMonthly, 'number', { prefix: '$' });
    html += UI.inputField('Other/mo', 'otherMonthly', t.costDefaults.otherMonthly, 'number', { prefix: '$' });
    html += '</div></div>';

    // Investment Range
    html += '<div class="border-b border-gray-100 pb-4"><h3 class="font-semibold text-gray-900 mb-3">Investment Range</h3>';
    html += '<div class="grid grid-cols-3 gap-4">';
    html += UI.inputField('Low', 'investLow', t.investmentRange.low, 'number', { prefix: '$' });
    html += UI.inputField('Mid', 'investMid', t.investmentRange.mid, 'number', { prefix: '$' });
    html += UI.inputField('High', 'investHigh', t.investmentRange.high, 'number', { prefix: '$' });
    html += '</div></div>';

    // Revenue Benchmarks
    html += '<div class="pb-4"><h3 class="font-semibold text-gray-900 mb-3">Revenue Benchmarks (monthly)</h3>';
    html += '<div class="grid grid-cols-3 gap-4">';
    html += UI.inputField('Low', 'revLow', t.revenueBenchmarks.low, 'number', { prefix: '$' });
    html += UI.inputField('Mid', 'revMid', t.revenueBenchmarks.mid, 'number', { prefix: '$' });
    html += UI.inputField('High', 'revHigh', t.revenueBenchmarks.high, 'number', { prefix: '$' });
    html += '</div></div>';

    html += '<div class="flex gap-3">';
    html += UI.button(existing ? 'Save Changes' : 'Create Template', "Templates.save('" + (id || '') + "')", 'primary');
    html += UI.button('Cancel', 'Templates.render()', 'secondary');
    html += '</div></form>';

    el.innerHTML = html;
  },

  save(id) {
    const form = document.getElementById('template-form');
    const f = (name) => form.querySelector('[name="' + name + '"]').value;
    const n = (name) => parseFloat(f(name)) || 0;

    const data = {
      name: f('name'),
      fees: { royaltyPct: n('royaltyPct'), adFundPct: n('adFundPct'), otherFees: [] },
      costDefaults: {
        foodCostPct: { low: n('foodCostLow'), mid: n('foodCostMid'), high: n('foodCostHigh') },
        laborPct: { low: n('laborLow'), mid: n('laborMid'), high: n('laborHigh') },
        utilitiesMonthly: n('utilitiesMonthly'),
        insuranceMonthly: n('insuranceMonthly'),
        otherMonthly: n('otherMonthly'),
      },
      investmentRange: { low: n('investLow'), mid: n('investMid'), high: n('investHigh') },
      revenueBenchmarks: { low: n('revLow'), mid: n('revMid'), high: n('revHigh') },
      termYears: n('termYears'),
    };

    if (id) data.id = id;
    Store.saveTemplate(data);
    Templates.render();
  },

  duplicate(id) {
    const original = Store.getTemplate(id);
    if (!original) return;
    const copy = { ...JSON.parse(JSON.stringify(original)), id: undefined, name: original.name + ' (Copy)' };
    delete copy.id;
    Store.saveTemplate(copy);
    Templates.render();
  },

  confirmDelete(id) {
    const t = Store.getTemplate(id);
    if (!t) return;
    if (confirm('Delete "' + t.name + '"? This cannot be undone.')) {
      Store.deleteTemplate(id);
      Templates.render();
    }
  }
};
```

- [ ] **Step 2: Open index.html, navigate to Templates, verify:**

- Marco's Pizza template card shows with correct fees and ranges
- "Edit" opens the form pre-filled with Marco's values
- "Duplicate" creates a copy
- "New Template" opens blank form
- Creating and deleting works
- Back button returns to list

- [ ] **Step 3: Commit**

```bash
git add js/templates.js
git commit -m "feat: add template management views (list, create, edit, duplicate, delete)"
```

---

### Task 6: Wizard flows — all three entry points (wizards.js)

**Files:**
- Modify: `js/wizards.js`

Three entry point wizards: FDD, Location, Capital. Each is a multi-step flow that produces a Scenario.

- [ ] **Step 1: Implement wizards.js**

```js
"use strict";

const Wizards = {
  state: {},

  render() {
    const el = App.getContent();
    let html = UI.pageHeader('New Analysis', 'Choose how you want to start your evaluation');

    html += '<div class="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">';

    // FDD Entry
    html += '<div class="bg-white rounded-lg border-2 border-gray-200 hover:border-emerald-400 p-6 cursor-pointer transition-colors" onclick="Wizards.start(\'fdd\')">';
    html += '<div class="text-3xl mb-3">&#128196;</div>';
    html += '<h3 class="font-semibold text-gray-900 text-lg">Start from FDD</h3>';
    html += '<p class="text-sm text-gray-500 mt-2">You have the Franchise Disclosure Document. Input Item 7 costs, Item 19 earnings, and fee structure.</p>';
    html += '</div>';

    // Location Entry
    html += '<div class="bg-white rounded-lg border-2 border-gray-200 hover:border-emerald-400 p-6 cursor-pointer transition-colors" onclick="Wizards.start(\'location\')">';
    html += '<div class="text-3xl mb-3">&#128205;</div>';
    html += '<h3 class="font-semibold text-gray-900 text-lg">Start from Location</h3>';
    html += '<p class="text-sm text-gray-500 mt-2">You found a spot. Estimate revenue and rent, and the template fills in the franchise cost structure.</p>';
    html += '</div>';

    // Capital Entry
    html += '<div class="bg-white rounded-lg border-2 border-gray-200 hover:border-emerald-400 p-6 cursor-pointer transition-colors" onclick="Wizards.start(\'capital\')">';
    html += '<div class="text-3xl mb-3">&#128176;</div>';
    html += '<h3 class="font-semibold text-gray-900 text-lg">Start from Capital</h3>';
    html += '<p class="text-sm text-gray-500 mt-2">You know what you can invest. See which scenarios are feasible and what revenue you need.</p>';
    html += '</div>';

    html += '</div>';
    el.innerHTML = html;
  },

  start(entryPoint) {
    const templates = Store.getTemplates();
    if (templates.length === 0) {
      alert('Create a franchise template first (go to Templates).');
      window.location.hash = 'templates';
      return;
    }
    Wizards.state = { entryPoint, step: 1, templateId: templates[0].id };
    Wizards.renderStep();
  },

  renderStep() {
    const s = Wizards.state;
    if (s.step === 1) Wizards.renderStep1();
    else if (s.step === 2) Wizards.renderStep2();
    else if (s.step === 3) Wizards.renderStep3();
  },

  // ── Step 1: Select Template ──
  renderStep1() {
    const el = App.getContent();
    const templates = Store.getTemplates();
    const opts = templates.map(t => ({ value: t.id, label: t.name }));
    const label = { fdd: 'FDD Analysis', location: 'Location Analysis', capital: 'Capital Analysis' }[Wizards.state.entryPoint];

    let html = UI.pageHeader(label + ' — Step 1 of 3', 'Select a franchise template',
      UI.button('&larr; Back', 'Wizards.render()', 'secondary'));
    html += '<div class="bg-white rounded-lg border border-gray-200 p-6 max-w-xl">';
    html += UI.selectField('Franchise Template', 'templateId', opts, Wizards.state.templateId);
    html += '<div class="mt-4">' + UI.inputField('Scenario Name', 'scenarioName', Wizards.state.scenarioName || '', 'text') + '</div>';
    html += '<div class="mt-6">' + UI.button('Next &rarr;', 'Wizards.saveStep1()', 'primary') + '</div>';
    html += '</div>';
    el.innerHTML = html;
  },

  saveStep1() {
    const form = App.getContent();
    Wizards.state.templateId = form.querySelector('[name="templateId"]').value;
    Wizards.state.scenarioName = form.querySelector('[name="scenarioName"]').value || 'Untitled Scenario';
    Wizards.state.step = 2;
    Wizards.renderStep();
  },

  // ── Step 2: Entry-point-specific inputs ──
  renderStep2() {
    const ep = Wizards.state.entryPoint;
    if (ep === 'fdd') Wizards.renderStep2FDD();
    else if (ep === 'location') Wizards.renderStep2Location();
    else if (ep === 'capital') Wizards.renderStep2Capital();
  },

  renderStep2FDD() {
    const el = App.getContent();
    const t = Store.getTemplate(Wizards.state.templateId);
    const s = Wizards.state;

    let html = UI.pageHeader('FDD Analysis — Step 2 of 3', 'Enter numbers from the Franchise Disclosure Document',
      UI.button('&larr; Back', 'Wizards.goBack()', 'secondary'));
    html += '<div class="bg-white rounded-lg border border-gray-200 p-6 max-w-2xl space-y-4">';

    html += '<h3 class="font-semibold text-gray-800">Item 7 — Initial Investment</h3>';
    html += '<div class="grid grid-cols-2 gap-4">';
    html += UI.inputField('Total Investment', 'totalInvestment', s.totalInvestment || t.investmentRange.mid, 'number', { prefix: '$' });
    html += UI.inputField('Down Payment', 'downPayment', s.downPayment || Math.round(t.investmentRange.mid * 0.3), 'number', { prefix: '$' });
    html += '</div>';

    html += '<h3 class="font-semibold text-gray-800 mt-4">Item 19 — Earnings (optional)</h3>';
    html += '<div class="grid grid-cols-1 gap-4">';
    html += UI.inputField('Estimated Monthly Revenue', 'monthlyRevenue', s.monthlyRevenue || t.revenueBenchmarks.mid, 'number', { prefix: '$' });
    html += '</div>';

    html += '<h3 class="font-semibold text-gray-800 mt-4">Fee Structure</h3>';
    html += '<div class="grid grid-cols-2 gap-4">';
    html += UI.inputField('Royalty', 'royaltyPct', s.royaltyPct || t.fees.royaltyPct, 'number', { suffix: '%', step: '0.1' });
    html += UI.inputField('Ad Fund', 'adFundPct', s.adFundPct || t.fees.adFundPct, 'number', { suffix: '%', step: '0.1' });
    html += '</div>';

    html += '<div class="mt-6">' + UI.button('Next &rarr;', 'Wizards.saveStep2FDD()', 'primary') + '</div>';
    html += '</div>';
    el.innerHTML = html;
  },

  saveStep2FDD() {
    const form = App.getContent();
    const n = (name) => parseFloat(form.querySelector('[name="' + name + '"]').value) || 0;
    Object.assign(Wizards.state, {
      totalInvestment: n('totalInvestment'), downPayment: n('downPayment'),
      monthlyRevenue: n('monthlyRevenue'), royaltyPct: n('royaltyPct'), adFundPct: n('adFundPct'),
    });
    Wizards.state.step = 3;
    Wizards.renderStep();
  },

  renderStep2Location() {
    const el = App.getContent();
    const t = Store.getTemplate(Wizards.state.templateId);
    const s = Wizards.state;

    let html = UI.pageHeader('Location Analysis — Step 2 of 3', 'Describe the location',
      UI.button('&larr; Back', 'Wizards.goBack()', 'secondary'));
    html += '<div class="bg-white rounded-lg border border-gray-200 p-6 max-w-2xl space-y-4">';

    html += '<h3 class="font-semibold text-gray-800">Revenue Estimate</h3>';
    html += '<div class="flex gap-2 mb-3">';
    ['low', 'mid', 'high'].forEach(level => {
      html += '<button type="button" onclick="Wizards.setRevenue(' + t.revenueBenchmarks[level] + ')" class="px-3 py-1 text-xs rounded-full border border-gray-300 hover:bg-emerald-50 hover:border-emerald-300">' + level.charAt(0).toUpperCase() + level.slice(1) + ': ' + UI.currencyCompact(t.revenueBenchmarks[level]) + '/mo</button>';
    });
    html += '</div>';
    html += UI.inputField('Monthly Revenue', 'monthlyRevenue', s.monthlyRevenue || t.revenueBenchmarks.mid, 'number', { prefix: '$' });

    html += '<h3 class="font-semibold text-gray-800 mt-4">Location Costs</h3>';
    html += '<div class="grid grid-cols-2 gap-4">';
    html += UI.inputField('Monthly Rent', 'rentMonthly', s.rentMonthly || 4500, 'number', { prefix: '$' });
    html += UI.inputField('Total Investment', 'totalInvestment', s.totalInvestment || t.investmentRange.mid, 'number', { prefix: '$' });
    html += '</div>';

    html += '<div class="mt-6">' + UI.button('Next &rarr;', 'Wizards.saveStep2Location()', 'primary') + '</div>';
    html += '</div>';
    el.innerHTML = html;
  },

  setRevenue(val) {
    const input = document.querySelector('[name="monthlyRevenue"]');
    if (input) input.value = val;
  },

  saveStep2Location() {
    const form = App.getContent();
    const n = (name) => parseFloat(form.querySelector('[name="' + name + '"]').value) || 0;
    const t = Store.getTemplate(Wizards.state.templateId);
    Object.assign(Wizards.state, {
      monthlyRevenue: n('monthlyRevenue'), rentMonthly: n('rentMonthly'),
      totalInvestment: n('totalInvestment'), downPayment: Math.round(n('totalInvestment') * 0.3),
      royaltyPct: t.fees.royaltyPct, adFundPct: t.fees.adFundPct,
    });
    Wizards.state.step = 3;
    Wizards.renderStep();
  },

  renderStep2Capital() {
    const el = App.getContent();
    const s = Wizards.state;

    let html = UI.pageHeader('Capital Analysis — Step 2 of 3', 'What do you have to work with?',
      UI.button('&larr; Back', 'Wizards.goBack()', 'secondary'));
    html += '<div class="bg-white rounded-lg border border-gray-200 p-6 max-w-2xl space-y-4">';

    html += '<div class="grid grid-cols-2 gap-4">';
    html += UI.inputField('Total Available Capital', 'capital', s.capital || 200000, 'number', { prefix: '$' });
    html += UI.inputField('Max Down Payment', 'maxDown', s.maxDown || 100000, 'number', { prefix: '$' });
    html += '</div>';
    html += UI.inputField('Minimum Monthly Cash Flow', 'minCashFlow', s.minCashFlow || 5000, 'number', { prefix: '$' });

    html += '<div class="mt-6">' + UI.button('Analyze Feasibility &rarr;', 'Wizards.saveStep2Capital()', 'primary') + '</div>';
    html += '</div>';
    el.innerHTML = html;
  },

  saveStep2Capital() {
    const form = App.getContent();
    const n = (name) => parseFloat(form.querySelector('[name="' + name + '"]').value) || 0;
    const t = Store.getTemplate(Wizards.state.templateId);
    const capital = n('capital');
    const maxDown = n('maxDown');
    const minCashFlow = n('minCashFlow');

    const feasibility = Engine.calcCapitalFeasibility(t, capital, maxDown, minCashFlow);
    Object.assign(Wizards.state, { capital, maxDown, minCashFlow, feasibility });

    // Pick the best feasible option for step 3, or mid as default
    const best = feasibility.results.find(r => r.feasible) || feasibility.results[1];
    Object.assign(Wizards.state, {
      totalInvestment: best.investment, downPayment: Math.min(maxDown, best.investment),
      monthlyRevenue: best.revenue, royaltyPct: t.fees.royaltyPct, adFundPct: t.fees.adFundPct,
    });
    Wizards.state.step = 3;
    Wizards.renderStep();
  },

  // ── Step 3: Review & Adjust All Assumptions ──
  renderStep3() {
    const el = App.getContent();
    const t = Store.getTemplate(Wizards.state.templateId);
    const s = Wizards.state;
    const label = { fdd: 'FDD', location: 'Location', capital: 'Capital' }[s.entryPoint];

    let html = UI.pageHeader(label + ' Analysis — Step 3 of 3', 'Review and adjust all assumptions',
      UI.button('&larr; Back', 'Wizards.goBack()', 'secondary'));

    // Capital feasibility summary (if capital entry point)
    if (s.entryPoint === 'capital' && s.feasibility) {
      html += '<div class="bg-white rounded-lg border border-gray-200 p-4 mb-6">';
      html += '<h3 class="font-semibold text-gray-800 mb-3">Feasibility Results</h3>';
      html += '<div class="grid grid-cols-3 gap-3">';
      s.feasibility.results.forEach(r => {
        const color = r.feasible ? 'border-emerald-300 bg-emerald-50' : 'border-red-200 bg-red-50';
        html += '<div class="p-3 rounded-lg border ' + color + '">';
        html += '<p class="text-xs font-medium uppercase text-gray-500">' + r.level + '</p>';
        html += '<p class="font-semibold">' + UI.currency(r.investment) + '</p>';
        html += '<p class="text-sm">Cash flow: ' + UI.currency(r.monthlyCashFlow) + '/mo</p>';
        html += '<p class="text-xs mt-1">' + (r.feasible ? 'Feasible' : 'Out of range') + '</p>';
        html += '</div>';
      });
      html += '</div>';
      if (s.feasibility.requiredRevenueForBreakEven > 0) {
        html += '<p class="text-sm text-gray-500 mt-2">Minimum revenue to break even at mid investment: <strong>' + UI.currency(s.feasibility.requiredRevenueForBreakEven) + '/mo</strong></p>';
      }
      html += '</div>';
    }

    html += '<form id="wizard-final" class="bg-white rounded-lg border border-gray-200 p-6 space-y-4">';

    html += '<div class="grid grid-cols-2 gap-4">';
    html += UI.inputField('Total Investment', 'totalInvestment', s.totalInvestment || t.investmentRange.mid, 'number', { prefix: '$' });
    html += UI.inputField('Down Payment', 'downPayment', s.downPayment || Math.round(t.investmentRange.mid * 0.3), 'number', { prefix: '$' });
    html += '</div>';

    html += '<div class="grid grid-cols-2 gap-4">';
    html += UI.inputField('Monthly Revenue', 'monthlyRevenue', s.monthlyRevenue || t.revenueBenchmarks.mid, 'number', { prefix: '$' });
    html += UI.inputField('Monthly Rent', 'rentMonthly', s.rentMonthly || 4500, 'number', { prefix: '$' });
    html += '</div>';

    html += '<div class="grid grid-cols-2 gap-4">';
    html += UI.inputField('Food Cost %', 'foodCostPct', s.foodCostPct || t.costDefaults.foodCostPct.mid, 'number', { suffix: '%' });
    html += UI.inputField('Labor %', 'laborPct', s.laborPct || t.costDefaults.laborPct.mid, 'number', { suffix: '%' });
    html += '</div>';

    html += '<div class="grid grid-cols-2 gap-4">';
    html += UI.inputField('Royalty %', 'royaltyPct', s.royaltyPct || t.fees.royaltyPct, 'number', { suffix: '%', step: '0.1' });
    html += UI.inputField('Ad Fund %', 'adFundPct', s.adFundPct || t.fees.adFundPct, 'number', { suffix: '%', step: '0.1' });
    html += '</div>';

    html += '<div class="grid grid-cols-3 gap-4">';
    html += UI.inputField('Utilities/mo', 'utilitiesMonthly', s.utilitiesMonthly || t.costDefaults.utilitiesMonthly, 'number', { prefix: '$' });
    html += UI.inputField('Insurance/mo', 'insuranceMonthly', s.insuranceMonthly || t.costDefaults.insuranceMonthly, 'number', { prefix: '$' });
    html += UI.inputField('Other/mo', 'otherMonthly', s.otherMonthly || t.costDefaults.otherMonthly, 'number', { prefix: '$' });
    html += '</div>';

    html += '<div class="mt-6 flex gap-3">';
    html += UI.button('Calculate & Save Scenario', 'Wizards.saveScenario()', 'primary');
    html += UI.button('Cancel', 'Wizards.render()', 'secondary');
    html += '</div></form>';

    el.innerHTML = html;
  },

  goBack() {
    Wizards.state.step = Math.max(1, Wizards.state.step - 1);
    Wizards.renderStep();
  },

  saveScenario() {
    const form = document.getElementById('wizard-final');
    const n = (name) => parseFloat(form.querySelector('[name="' + name + '"]').value) || 0;
    const t = Store.getTemplate(Wizards.state.templateId);

    const inputs = {
      totalInvestment: n('totalInvestment'), downPayment: n('downPayment'),
      monthlyRevenue: n('monthlyRevenue'), rentMonthly: n('rentMonthly'),
      foodCostPct: n('foodCostPct'), laborPct: n('laborPct'),
      royaltyPct: n('royaltyPct'), adFundPct: n('adFundPct'),
      utilitiesMonthly: n('utilitiesMonthly'), insuranceMonthly: n('insuranceMonthly'),
      otherMonthly: n('otherMonthly'),
    };

    const computed = Engine.calcScenario(inputs);
    const scenario = Store.saveScenario({
      name: Wizards.state.scenarioName || 'Untitled Scenario',
      templateId: Wizards.state.templateId,
      templateName: t.name,
      entryPoint: Wizards.state.entryPoint,
      inputs,
      computed,
    });

    // Navigate to scenario summary
    window.location.hash = 'scenario/' + scenario.id;
  }
};
```

- [ ] **Step 2: Open index.html, test each wizard flow:**

- FDD: select template → enter investment/revenue/fees → review → save → should navigate to scenario view
- Location: select template → pick revenue + rent → review → save
- Capital: select template → enter capital/down/min cash flow → see feasibility → review → save
- Back buttons work at every step
- Verify scenarios appear in Store (check localStorage in browser dev tools)

- [ ] **Step 3: Commit**

```bash
git add js/wizards.js
git commit -m "feat: add three wizard entry points (FDD, Location, Capital)"
```

---

### Task 7: Scenario summary view (scenario.js)

**Files:**
- Modify: `js/scenario.js`

The core output: metric cards, P&L table with percentages, sensitivity sliders that recalculate in real-time.

- [ ] **Step 1: Implement scenario.js**

```js
"use strict";

const Scenario = {
  currentId: null,
  overrides: null,

  render(id) {
    const scenario = Store.getScenario(id);
    if (!scenario) {
      App.getContent().innerHTML = UI.emptyState('&#128269;', 'Scenario not found', 'It may have been deleted.',
        UI.button('Go to Dashboard', "window.location.hash='dashboard'", 'primary'));
      return;
    }
    Scenario.currentId = id;
    Scenario.overrides = null;
    Scenario.renderView(scenario);
  },

  getActiveInputs(scenario) {
    if (!Scenario.overrides) return scenario.inputs;
    return { ...scenario.inputs, ...Scenario.overrides };
  },

  renderView(scenario) {
    const el = App.getContent();
    const inputs = Scenario.getActiveInputs(scenario);
    const computed = Engine.calcScenario(inputs);
    const pnl = Engine.buildPnL(computed.lineItems);

    let html = UI.pageHeader(
      scenario.name,
      scenario.templateName + ' &middot; ' + scenario.entryPoint.toUpperCase() + ' &middot; ' + scenario.created,
      '<div class="flex gap-2">' +
        UI.button('&larr; Dashboard', "window.location.hash='dashboard'", 'secondary') +
        UI.button('Print', 'window.print()', 'secondary') +
        UI.button('Delete', "Scenario.confirmDelete('" + scenario.id + "')", 'danger') +
      '</div>'
    );

    // ── Metric Cards ──
    html += '<div class="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">';
    html += UI.metricCard('Total Investment', UI.currency(inputs.totalInvestment));
    html += UI.metricCard('Monthly Cash Flow', UI.currency(computed.monthlyCashFlow), computed.monthlyCashFlow >= 0 ? 'Positive' : 'Negative');
    html += UI.metricCard('Break-Even', UI.months(computed.breakEvenMonth), computed.breakEvenMonth > 0 ? ('~' + (computed.breakEvenMonth / 12).toFixed(1) + ' years') : '');
    html += UI.metricCard('First Year ROI', UI.pct(computed.firstYearROI));
    html += UI.metricCard('Annual Earnings', UI.currency(computed.annualOwnerEarnings));
    html += '</div>';

    // ── Sensitivity Sliders ──
    html += '<div class="bg-white rounded-lg border border-gray-200 p-6 mb-8 no-print">';
    html += '<h3 class="font-semibold text-gray-900 mb-4">Sensitivity Analysis</h3>';
    html += '<p class="text-xs text-gray-500 mb-4">Drag sliders to see how changes affect your numbers. Resets when you leave this page.</p>';
    html += '<div class="grid grid-cols-1 md:grid-cols-3 gap-6">';

    // Revenue slider
    const revBase = scenario.inputs.monthlyRevenue;
    const revMin = Math.round(revBase * 0.75);
    const revMax = Math.round(revBase * 1.25);
    const revCurrent = inputs.monthlyRevenue;
    html += '<div><label class="text-sm font-medium text-gray-700">Revenue: <span id="slider-rev-val">' + UI.currency(revCurrent) + '</span></label>';
    html += '<input type="range" class="slider-track mt-2" id="slider-rev" min="' + revMin + '" max="' + revMax + '" step="1000" value="' + revCurrent + '" oninput="Scenario.onSlider()"></div>';

    // Food cost slider
    const foodBase = scenario.inputs.foodCostPct;
    const foodCurrent = inputs.foodCostPct;
    html += '<div><label class="text-sm font-medium text-gray-700">Food Cost: <span id="slider-food-val">' + UI.pct(foodCurrent) + '</span></label>';
    html += '<input type="range" class="slider-track mt-2" id="slider-food" min="' + Math.max(0, foodBase - 5) + '" max="' + (foodBase + 5) + '" step="0.5" value="' + foodCurrent + '" oninput="Scenario.onSlider()"></div>';

    // Labor slider
    const laborBase = scenario.inputs.laborPct;
    const laborCurrent = inputs.laborPct;
    html += '<div><label class="text-sm font-medium text-gray-700">Labor: <span id="slider-labor-val">' + UI.pct(laborCurrent) + '</span></label>';
    html += '<input type="range" class="slider-track mt-2" id="slider-labor" min="' + Math.max(0, laborBase - 5) + '" max="' + (laborBase + 5) + '" step="0.5" value="' + laborCurrent + '" oninput="Scenario.onSlider()"></div>';

    html += '</div>';
    html += '<div class="mt-3 text-right">' + UI.button('Reset Sliders', 'Scenario.resetSliders()', 'secondary') + '</div>';
    html += '</div>';

    // ── P&L Table ──
    html += '<div class="mb-8">';
    html += '<h3 class="font-semibold text-gray-900 mb-4">Monthly P&L</h3>';
    const rows = pnl.map(row => ({
      _isTotal: row.isTotal,
      cells: [
        row.label,
        '<span class="' + (row.amount < 0 ? 'text-red-500' : row.isTotal && row.amount > 0 ? 'text-emerald-600' : '') + '">' + UI.currency(row.amount) + '</span>',
        UI.pct(row.pctOfRevenue),
      ]
    }));
    html += UI.table(['Line Item', 'Monthly', '% of Revenue'], rows);
    html += '</div>';

    el.innerHTML = html;
  },

  onSlider() {
    const scenario = Store.getScenario(Scenario.currentId);
    if (!scenario) return;

    const rev = parseFloat(document.getElementById('slider-rev').value);
    const food = parseFloat(document.getElementById('slider-food').value);
    const labor = parseFloat(document.getElementById('slider-labor').value);

    document.getElementById('slider-rev-val').textContent = UI.currency(rev);
    document.getElementById('slider-food-val').textContent = UI.pct(food);
    document.getElementById('slider-labor-val').textContent = UI.pct(labor);

    Scenario.overrides = { monthlyRevenue: rev, foodCostPct: food, laborPct: labor };
    Scenario.renderView(scenario);
  },

  resetSliders() {
    Scenario.overrides = null;
    const scenario = Store.getScenario(Scenario.currentId);
    if (scenario) Scenario.renderView(scenario);
  },

  confirmDelete(id) {
    if (confirm('Delete this scenario? This cannot be undone.')) {
      Store.deleteScenario(id);
      window.location.hash = 'dashboard';
    }
  }
};
```

- [ ] **Step 2: Open index.html, run a wizard to create a scenario, verify:**

- 5 metric cards show correct values at top
- P&L table has 10 rows with correct dollar amounts and percentages
- Sensitivity sliders update metric cards and P&L table in real time
- Revenue at +-25% range, food/labor at +-5 points
- Reset sliders returns to original values
- Print button opens print dialog (sidebar hidden)
- Delete prompts confirmation and returns to dashboard

- [ ] **Step 3: Commit**

```bash
git add js/scenario.js
git commit -m "feat: add scenario summary with metric cards, P&L table, and sensitivity sliders"
```

---

### Task 8: Dashboard (dashboard.js)

**Files:**
- Modify: `js/dashboard.js`

Overview of all saved scenarios with quick stats. The landing page.

- [ ] **Step 1: Implement dashboard.js**

```js
"use strict";

const Dashboard = {
  render() {
    const el = App.getContent();
    const scenarios = Store.getScenarios();
    const templates = Store.getTemplates();
    const portfolios = Store.getPortfolios();

    let html = UI.pageHeader('Dashboard', 'Your franchise analysis overview',
      UI.button('+ New Analysis', "window.location.hash='new-analysis'", 'primary'));

    // ── Quick Stats ──
    if (scenarios.length > 0) {
      const totalInvested = scenarios.reduce((sum, s) => sum + (s.inputs.totalInvestment || 0), 0);
      const avgCashFlow = scenarios.reduce((sum, s) => {
        const c = Engine.calcScenario(s.inputs);
        return sum + c.monthlyCashFlow;
      }, 0) / scenarios.length;
      const bestScenario = scenarios.reduce((best, s) => {
        const c = Engine.calcScenario(s.inputs);
        return c.monthlyCashFlow > (best.cf || -Infinity) ? { s, cf: c.monthlyCashFlow } : best;
      }, {});

      html += '<div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">';
      html += UI.metricCard('Scenarios', scenarios.length);
      html += UI.metricCard('Avg Cash Flow', UI.currency(avgCashFlow), '/month');
      html += UI.metricCard('Best Performer', bestScenario.s ? bestScenario.s.name : '—', bestScenario.cf ? UI.currency(bestScenario.cf) + '/mo' : '');
      html += UI.metricCard('Portfolios', portfolios.length);
      html += '</div>';
    }

    // ── Scenarios List ──
    if (scenarios.length === 0) {
      html += UI.emptyState('&#128200;', 'No scenarios yet', 'Run your first franchise analysis to see results here.',
        UI.button('+ New Analysis', "window.location.hash='new-analysis'", 'primary'));
    } else {
      html += '<h3 class="font-semibold text-gray-900 mb-4">All Scenarios</h3>';
      html += '<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">';
      scenarios.forEach(s => {
        const computed = Engine.calcScenario(s.inputs);
        const cashFlowColor = computed.monthlyCashFlow >= 0 ? 'text-emerald-600' : 'text-red-500';
        html += '<div class="bg-white rounded-lg border border-gray-200 p-5 hover:shadow-md transition-shadow cursor-pointer" onclick="window.location.hash=\'scenario/' + s.id + '\'">';
        html += '<div class="flex items-start justify-between"><h4 class="font-semibold text-gray-900">' + s.name + '</h4>';
        html += '<span class="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">' + s.entryPoint.toUpperCase() + '</span></div>';
        html += '<p class="text-xs text-gray-400 mt-1">' + s.templateName + ' &middot; ' + s.created + '</p>';
        html += '<div class="mt-3 grid grid-cols-2 gap-2 text-sm">';
        html += '<div><span class="text-gray-500">Investment:</span><br><strong>' + UI.currency(s.inputs.totalInvestment) + '</strong></div>';
        html += '<div><span class="text-gray-500">Cash Flow:</span><br><strong class="' + cashFlowColor + '">' + UI.currency(computed.monthlyCashFlow) + '/mo</strong></div>';
        html += '<div><span class="text-gray-500">Break-Even:</span><br><strong>' + UI.months(computed.breakEvenMonth) + '</strong></div>';
        html += '<div><span class="text-gray-500">ROI:</span><br><strong>' + UI.pct(computed.firstYearROI) + '</strong></div>';
        html += '</div></div>';
      });
      html += '</div>';
    }

    el.innerHTML = html;
  }
};
```

- [ ] **Step 2: Open index.html, verify dashboard:**

- Empty state shows when no scenarios exist
- After creating scenarios via wizard, dashboard shows cards with correct metrics
- Clicking a scenario card navigates to its summary
- Quick stats show correct aggregates
- "+ New Analysis" button navigates to wizard

- [ ] **Step 3: Commit**

```bash
git add js/dashboard.js
git commit -m "feat: add dashboard with scenario cards and quick stats"
```

---

### Task 9: Portfolio planner — timeline + comparison (portfolio.js)

**Files:**
- Modify: `js/portfolio.js`

Portfolio CRUD, timeline visualization (bar chart drawn with HTML/CSS — no canvas library), and side-by-side comparison table.

- [ ] **Step 1: Implement portfolio.js**

```js
"use strict";

const Portfolio = {
  currentView: 'list', // list | timeline | compare
  currentId: null,

  render() {
    Portfolio.currentView = 'list';
    Portfolio.renderList();
  },

  renderList() {
    const el = App.getContent();
    const portfolios = Store.getPortfolios();
    const scenarios = Store.getScenarios();

    let html = UI.pageHeader('Portfolio Planner', 'Plan multi-location expansion',
      '<div class="flex gap-2">' +
        UI.button('+ New Portfolio', 'Portfolio.showCreate()', 'primary') +
        (scenarios.length >= 2 ? UI.button('Compare Scenarios', 'Portfolio.showCompare()', 'secondary') : '') +
      '</div>'
    );

    if (portfolios.length === 0) {
      html += UI.emptyState('&#128202;', 'No portfolios yet', 'Create a portfolio to plan your multi-location timeline.' + (scenarios.length < 2 ? '<br>You need at least 1 scenario first.' : ''),
        scenarios.length >= 1 ? UI.button('+ New Portfolio', 'Portfolio.showCreate()', 'primary') : UI.button('Create a Scenario First', "window.location.hash='new-analysis'", 'primary'));
    } else {
      html += '<div class="grid grid-cols-1 md:grid-cols-2 gap-4">';
      portfolios.forEach(p => {
        const locCount = p.locations.length;
        html += '<div class="bg-white rounded-lg border border-gray-200 p-5">';
        html += '<div class="flex items-start justify-between"><h4 class="font-semibold text-gray-900">' + p.name + '</h4>';
        html += '<span class="text-xs text-gray-400">' + p.created + '</span></div>';
        html += '<p class="text-sm text-gray-500 mt-1">' + locCount + ' location' + (locCount !== 1 ? 's' : '') + '</p>';
        html += '<div class="mt-4 flex gap-2">';
        html += UI.button('Timeline', "Portfolio.showTimeline('" + p.id + "')", 'primary');
        html += UI.button('Edit', "Portfolio.showEdit('" + p.id + "')", 'secondary');
        html += UI.button('Delete', "Portfolio.confirmDelete('" + p.id + "')", 'danger');
        html += '</div></div>';
      });
      html += '</div>';
    }

    el.innerHTML = html;
  },

  showCreate() {
    const scenarios = Store.getScenarios();
    if (scenarios.length === 0) {
      alert('Create at least one scenario first.');
      window.location.hash = 'new-analysis';
      return;
    }
    Portfolio.currentId = null;
    Portfolio.renderForm(null);
  },

  showEdit(id) {
    Portfolio.currentId = id;
    Portfolio.renderForm(Store.getPortfolio(id));
  },

  renderForm(existing) {
    const el = App.getContent();
    const scenarios = Store.getScenarios();
    const p = existing || { name: '', locations: [{ scenarioId: scenarios[0].id, openMonth: 0 }] };

    let html = UI.pageHeader(existing ? 'Edit Portfolio' : 'New Portfolio', 'Define locations and their opening timeline',
      UI.button('&larr; Back', 'Portfolio.renderList()', 'secondary'));

    html += '<div id="portfolio-form" class="bg-white rounded-lg border border-gray-200 p-6 space-y-4">';
    html += UI.inputField('Portfolio Name', 'portfolioName', p.name, 'text');

    html += '<h3 class="font-semibold text-gray-800 mt-4">Locations</h3>';
    html += '<div id="location-rows">';
    p.locations.forEach((loc, i) => {
      html += Portfolio.locationRow(i, loc, scenarios);
    });
    html += '</div>';

    html += '<div class="mt-2">';
    html += '<button onclick="Portfolio.addRow()" class="text-sm text-emerald-600 hover:text-emerald-800 font-medium">+ Add Location</button>';
    html += '</div>';

    html += '<div class="mt-6 flex gap-3">';
    html += UI.button(existing ? 'Save Changes' : 'Create Portfolio', 'Portfolio.saveForm()', 'primary');
    html += UI.button('Cancel', 'Portfolio.renderList()', 'secondary');
    html += '</div></div>';

    el.innerHTML = html;
  },

  locationRow(index, loc, scenarios) {
    const opts = scenarios.map(s => '<option value="' + s.id + '"' + (s.id === loc.scenarioId ? ' selected' : '') + '>' + s.name + '</option>').join('');
    return '<div class="flex gap-3 items-end mb-3 location-row" data-index="' + index + '">' +
      '<div class="flex-1"><label class="text-sm text-gray-700">Scenario</label><select name="loc-scenario-' + index + '" class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">' + opts + '</select></div>' +
      '<div class="w-32"><label class="text-sm text-gray-700">Opens Month</label><input type="number" name="loc-month-' + index + '" value="' + loc.openMonth + '" min="0" class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"></div>' +
      '<button onclick="this.parentElement.remove()" class="text-red-400 hover:text-red-600 pb-2 text-lg">&times;</button>' +
      '</div>';
  },

  addRow() {
    const container = document.getElementById('location-rows');
    const scenarios = Store.getScenarios();
    const index = container.querySelectorAll('.location-row').length;
    const div = document.createElement('div');
    div.innerHTML = Portfolio.locationRow(index, { scenarioId: scenarios[0].id, openMonth: index * 12 }, scenarios);
    container.appendChild(div.firstElementChild);
  },

  saveForm() {
    const name = document.querySelector('[name="portfolioName"]').value || 'Untitled Portfolio';
    const rows = document.querySelectorAll('.location-row');
    const locations = [];
    rows.forEach((row, i) => {
      const scenarioSelect = row.querySelector('select');
      const monthInput = row.querySelector('input[type="number"]');
      if (scenarioSelect && monthInput) {
        locations.push({
          scenarioId: scenarioSelect.value,
          openMonth: parseInt(monthInput.value) || 0,
        });
      }
    });

    const data = { name, locations };
    if (Portfolio.currentId) data.id = Portfolio.currentId;
    Store.savePortfolio(data);
    Portfolio.renderList();
  },

  // ── Timeline View ──
  showTimeline(id) {
    const portfolio = Store.getPortfolio(id);
    if (!portfolio) return;
    Portfolio.currentId = id;

    const el = App.getContent();
    const locations = portfolio.locations.map(loc => ({
      ...loc,
      scenario: Store.getScenario(loc.scenarioId),
    })).filter(l => l.scenario);

    if (locations.length === 0) {
      el.innerHTML = UI.pageHeader(portfolio.name, 'Timeline View',
        UI.button('&larr; Back', 'Portfolio.renderList()', 'secondary')) +
        UI.emptyState('&#128203;', 'No valid scenarios', 'The scenarios in this portfolio may have been deleted.');
      return;
    }

    const timeline = Engine.calcPortfolioTimeline(locations, 60);

    let html = UI.pageHeader(portfolio.name + ' — Timeline', locations.length + ' locations over 5 years',
      UI.button('&larr; Back', 'Portfolio.renderList()', 'secondary'));

    // ── Portfolio Summary Stats ──
    html += '<div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">';
    html += UI.metricCard('Total Capital', UI.currency(timeline.totalInvestment));
    html += UI.metricCard('Combined Cash Flow', UI.currency(timeline.combinedMonthlyCashFlow), '/month (at month 60)');
    html += UI.metricCard('Portfolio ROI', UI.pct(timeline.portfolioROI), 'Over 5 years');
    html += UI.metricCard('Locations', locations.length);
    html += '</div>';

    // ── Milestones ──
    if (timeline.milestones.length > 0) {
      html += '<div class="bg-white rounded-lg border border-gray-200 p-5 mb-8">';
      html += '<h3 class="font-semibold text-gray-900 mb-3">Key Milestones</h3>';
      html += '<div class="space-y-2">';
      timeline.milestones.forEach(m => {
        html += '<div class="flex items-center gap-3"><span class="text-xs font-mono bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded">Month ' + m.month + '</span><span class="text-sm text-gray-700">' + m.text + '</span></div>';
      });
      html += '</div></div>';
    }

    // ── Cash Flow Chart (CSS bar chart) ──
    html += '<div class="bg-white rounded-lg border border-gray-200 p-5 mb-8">';
    html += '<h3 class="font-semibold text-gray-900 mb-3">Monthly Cash Flow</h3>';
    html += '<div class="overflow-x-auto">';
    html += '<div class="flex items-end gap-px" style="height:200px; min-width:' + (timeline.monthly.length * 12) + 'px">';

    const maxCF = Math.max(...timeline.monthly.map(m => m.cashFlow), 1);
    timeline.monthly.forEach((m, i) => {
      const height = Math.max(1, Math.round((m.cashFlow / maxCF) * 180));
      const isOpening = timeline.milestones.some(ms => ms.month === i && ms.text.includes('opens'));
      const barColor = isOpening ? 'bg-amber-400' : (m.cashFlow >= 0 ? 'bg-emerald-400' : 'bg-red-400');
      html += '<div class="flex-1 ' + barColor + ' rounded-t-sm relative group" style="height:' + height + 'px; min-width:8px">';
      html += '<div class="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 hidden group-hover:block bg-gray-900 text-white text-xs px-2 py-1 rounded whitespace-nowrap z-10">Mo ' + i + ': ' + UI.currency(m.cashFlow) + '/mo<br>Cumulative: ' + UI.currency(m.cumulative) + '</div>';
      html += '</div>';
    });

    html += '</div>';
    html += '<div class="flex justify-between text-xs text-gray-400 mt-1"><span>Month 0</span><span>Month 60</span></div>';
    html += '</div></div>';

    // ── Cumulative Chart ──
    html += '<div class="bg-white rounded-lg border border-gray-200 p-5">';
    html += '<h3 class="font-semibold text-gray-900 mb-3">Cumulative Cash Flow</h3>';
    html += '<div class="overflow-x-auto">';
    html += '<div class="flex items-end gap-px" style="height:200px; min-width:' + (timeline.monthly.length * 12) + 'px">';

    const maxCum = Math.max(...timeline.monthly.map(m => m.cumulative), 1);
    timeline.monthly.forEach((m, i) => {
      const height = Math.max(1, Math.round((Math.max(0, m.cumulative) / maxCum) * 180));
      const barColor = m.cumulative >= 0 ? 'bg-blue-400' : 'bg-red-300';
      html += '<div class="flex-1 ' + barColor + ' rounded-t-sm relative group" style="height:' + height + 'px; min-width:8px">';
      html += '<div class="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 hidden group-hover:block bg-gray-900 text-white text-xs px-2 py-1 rounded whitespace-nowrap z-10">Mo ' + i + ': ' + UI.currency(m.cumulative) + ' total</div>';
      html += '</div>';
    });

    html += '</div>';
    html += '<div class="flex justify-between text-xs text-gray-400 mt-1"><span>Month 0</span><span>Month 60</span></div>';
    html += '</div></div>';

    el.innerHTML = html;
  },

  // ── Comparison View ──
  showCompare() {
    const el = App.getContent();
    const scenarios = Store.getScenarios();

    if (scenarios.length < 2) {
      el.innerHTML = UI.pageHeader('Compare Scenarios', '',
        UI.button('&larr; Back', 'Portfolio.renderList()', 'secondary')) +
        UI.emptyState('&#128200;', 'Need at least 2 scenarios', 'Create more scenarios to compare them side-by-side.');
      return;
    }

    let html = UI.pageHeader('Compare Scenarios', 'Side-by-side analysis of up to 4 scenarios',
      UI.button('&larr; Back', 'Portfolio.renderList()', 'secondary'));

    // Scenario selector checkboxes
    html += '<div class="bg-white rounded-lg border border-gray-200 p-4 mb-6">';
    html += '<p class="text-sm text-gray-500 mb-2">Select 2-4 scenarios to compare:</p>';
    html += '<div class="flex flex-wrap gap-3">';
    scenarios.forEach((s, i) => {
      const checked = i < 4 ? 'checked' : '';
      html += '<label class="flex items-center gap-2 text-sm"><input type="checkbox" class="compare-check" value="' + s.id + '" ' + checked + ' onchange="Portfolio.updateCompare()"> ' + s.name + '</label>';
    });
    html += '</div></div>';

    html += '<div id="compare-table"></div>';
    el.innerHTML = html;
    Portfolio.updateCompare();
  },

  updateCompare() {
    const checked = Array.from(document.querySelectorAll('.compare-check:checked')).map(c => c.value).slice(0, 4);
    const container = document.getElementById('compare-table');
    if (checked.length < 2) {
      container.innerHTML = '<p class="text-gray-500 text-sm">Select at least 2 scenarios.</p>';
      return;
    }

    const scenarios = checked.map(id => Store.getScenario(id)).filter(Boolean);
    const computed = scenarios.map(s => Engine.calcScenario(s.inputs));

    const metrics = [
      { label: 'Investment', key: 'totalInvestment', fmt: UI.currency, fromInputs: true, higherBetter: false },
      { label: 'Monthly Revenue', key: 'monthlyRevenue', fmt: UI.currency, fromInputs: true, higherBetter: true },
      { label: 'Monthly Cash Flow', key: 'monthlyCashFlow', fmt: UI.currency, fromInputs: false, higherBetter: true },
      { label: 'Break-Even', key: 'breakEvenMonth', fmt: UI.months, fromInputs: false, higherBetter: false },
      { label: 'First Year ROI', key: 'firstYearROI', fmt: UI.pct, fromInputs: false, higherBetter: true },
      { label: 'Annual Earnings', key: 'annualOwnerEarnings', fmt: UI.currency, fromInputs: false, higherBetter: true },
      { label: 'Food Cost %', key: 'foodCostPct', fmt: UI.pct, fromInputs: true, higherBetter: false },
      { label: 'Labor %', key: 'laborPct', fmt: UI.pct, fromInputs: true, higherBetter: false },
    ];

    const headers = ['Metric', ...scenarios.map(s => s.name)];
    const rows = metrics.map(metric => {
      const values = scenarios.map((s, i) => {
        return metric.fromInputs ? s.inputs[metric.key] : computed[i][metric.key];
      });
      // Rank values
      const sorted = [...values].sort((a, b) => metric.higherBetter ? b - a : a - b);
      const cells = [metric.label, ...values.map((v, i) => {
        const rank = sorted.indexOf(v);
        return '<span class="' + UI.rankColor(rank, values.length) + '">' + metric.fmt(v) + '</span>';
      })];
      return { cells };
    });

    container.innerHTML = UI.table(headers, rows);
  },

  confirmDelete(id) {
    if (confirm('Delete this portfolio? This cannot be undone.')) {
      Store.deletePortfolio(id);
      Portfolio.renderList();
    }
  }
};
```

- [ ] **Step 2: Open index.html, create at least 2 scenarios via wizards, then test portfolio:**

- Create a new portfolio with 2 locations at different open months
- Timeline view shows: summary stats, milestones, cash flow bar chart, cumulative chart
- Hovering bars shows tooltip with month and dollar amount
- Compare view shows checkboxes for scenario selection
- Comparison table ranks metrics with green (best) / red (worst) coloring
- Edit portfolio lets you add/remove locations and change open months
- Delete works

- [ ] **Step 3: Commit**

```bash
git add js/portfolio.js
git commit -m "feat: add portfolio planner with timeline visualization and scenario comparison"
```

---

### Task 10: Final integration + polish

**Files:**
- Modify: `index.html` (minor)
- Modify: `js/app.js` (minor)

Wire up any loose ends, make sure export/import works end-to-end, and do a full smoke test.

- [ ] **Step 1: Test export/import roundtrip**

1. Create a template, 2 scenarios, and 1 portfolio
2. Click "Export Data (JSON)" in sidebar — file downloads
3. Clear localStorage in dev tools (Application → Local Storage → delete all `fcc_*` keys)
4. Refresh page — should show empty dashboard
5. Click "Import Data" — select the exported JSON file
6. Verify all templates, scenarios, and portfolios are restored

- [ ] **Step 2: Test print view**

1. Navigate to a scenario summary
2. Click Print (or Ctrl+P)
3. Verify sidebar is hidden, metric cards have borders instead of shadows, sliders are hidden

- [ ] **Step 3: Full smoke test checklist**

- [ ] Dashboard renders with no scenarios (empty state)
- [ ] Create Marco's Pizza scenario via FDD wizard
- [ ] Create a second scenario via Location wizard
- [ ] Create a third scenario via Capital wizard — feasibility cards show correctly
- [ ] Dashboard shows all 3 scenarios with correct metrics
- [ ] Click each scenario — summary loads with correct P&L
- [ ] Sensitivity sliders recalculate in real time
- [ ] Templates page shows Marco's Pizza — edit and save works
- [ ] Duplicate a template, verify copy appears
- [ ] Create a portfolio with 2 locations
- [ ] Portfolio timeline shows bar chart and milestones
- [ ] Compare scenarios — table ranks with colors
- [ ] Export → clear → import roundtrip works
- [ ] No console errors on any page

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: complete Franchise Command Center v1"
```

---

## Summary

| Task | What it builds | Key files |
|------|---------------|-----------|
| 1 | Repo + HTML shell + router | index.html, js/app.js |
| 2 | Data layer + tests | js/store.js, test.html |
| 3 | Financial engine + tests | js/engine.js, test.html |
| 4 | UI helpers + Marco's default | js/ui.js |
| 5 | Template CRUD views | js/templates.js |
| 6 | Three wizard entry points | js/wizards.js |
| 7 | Scenario summary + sliders | js/scenario.js |
| 8 | Dashboard overview | js/dashboard.js |
| 9 | Portfolio timeline + comparison | js/portfolio.js |
| 10 | Integration + polish | All files |
