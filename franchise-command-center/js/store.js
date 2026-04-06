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

  // Templates
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

  // Scenarios
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
    const portfolios = this.getPortfolios().map(p => ({
      ...p,
      locations: p.locations.filter(l => l.scenarioId !== id)
    }));
    this._set('portfolios', portfolios);
  },

  // Portfolios
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

  // Export / Import
  exportAll() {
    return {
      templates: this.getTemplates(),
      scenarios: this.getScenarios(),
      portfolios: this.getPortfolios()
    };
  },
  _isObj(v) { return v && typeof v === 'object' && !Array.isArray(v); },
  _isStr(v) { return typeof v === 'string'; },
  _isNum(v) { return typeof v === 'number' && isFinite(v); },

  _validateTemplate(t) {
    return this._isObj(t) && this._isStr(t.name) && t.name.length <= 200 &&
      this._isObj(t.fees) && this._isNum(t.fees.royaltyPct) && this._isNum(t.fees.adFundPct);
  },
  _validateScenario(s) {
    return this._isObj(s) && this._isStr(s.name) && s.name.length <= 200 &&
      this._isObj(s.inputs) && this._isNum(s.inputs.totalInvestment) && this._isNum(s.inputs.monthlyRevenue);
  },
  _validatePortfolio(p) {
    return this._isObj(p) && this._isStr(p.name) && p.name.length <= 200 &&
      Array.isArray(p.locations);
  },

  importAll(data) {
    if (!data || typeof data !== 'object') return false;
    let imported = 0;
    if (Array.isArray(data.templates) && data.templates.every(t => this._validateTemplate(t))) {
      this._set('templates', data.templates);
      imported++;
    }
    if (Array.isArray(data.scenarios) && data.scenarios.every(s => this._validateScenario(s))) {
      this._set('scenarios', data.scenarios);
      imported++;
    }
    if (Array.isArray(data.portfolios) && data.portfolios.every(p => this._validatePortfolio(p))) {
      this._set('portfolios', data.portfolios);
      imported++;
    }
    return imported > 0;
  }
};
