"use strict";

// Ported from trading-command-center/js/store.js validation logic

const FIRMS = ['apex', 'topstep', 'mff', 'alpha', 'lucid'];
const PHASES = ['eval', 'funded', 'live'];
const STATUSES = ['active', 'archived'];
const SUBTYPES = ['normal', 'consistency', 'core', 'rapid'];
const TRADED_BY = ['manual', 'bot'];

function isStr(v, max) { return typeof v === 'string' && (!max || v.length <= max); }
function isNum(v) { return typeof v === 'number' && isFinite(v); }
function isId(v) { return typeof v === 'string' && v.length <= 100 && /^[\w-]+$/.test(v); }
function isDate(v) { return typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v); }

function validateAccount(a) {
  if (!a || typeof a !== 'object') return 'Invalid request body';
  if (!isStr(a.name, 200) || !a.name.trim()) return 'Name is required (max 200 chars)';
  if (!FIRMS.includes(a.firm)) return 'Invalid firm';
  if (!PHASES.includes(a.phase)) return 'Invalid phase';
  if (a.status && !STATUSES.includes(a.status)) return 'Invalid status';
  if (!isNum(a.startingBalance) || Math.abs(a.startingBalance) > 1e9) return 'Invalid starting balance';
  if (a.tradedBy && !TRADED_BY.includes(a.tradedBy)) return 'Invalid tradedBy';
  if (a.subtype && !SUBTYPES.includes(a.subtype)) return 'Invalid subtype';
  if (a.rules && !isStr(a.rules, 100)) return 'Invalid rules key';
  if (a.trailingDrawdown != null && (!isNum(a.trailingDrawdown) || a.trailingDrawdown < 0 || a.trailingDrawdown > 1e9)) return 'Invalid trailing drawdown';
  return null;
}

function validateEntry(e) {
  if (!e || typeof e !== 'object') return 'Invalid request body';
  if (!isId(e.accountId)) return 'Invalid account ID';
  if (!isDate(e.date)) return 'Invalid date (YYYY-MM-DD)';
  if (!isNum(e.pnl) || Math.abs(e.pnl) > 1e9) return 'Invalid P&L';
  if (e.notes && !isStr(e.notes, 5000)) return 'Notes too long (max 5000)';
  if (e.entryTime && !isStr(e.entryTime, 10)) return 'Invalid entry time';
  if (e.exitTime && !isStr(e.exitTime, 10)) return 'Invalid exit time';
  if (e.entryPrice != null && (!isNum(e.entryPrice) || Math.abs(e.entryPrice) > 1e9)) return 'Invalid entry price';
  if (e.exitPrice != null && (!isNum(e.exitPrice) || Math.abs(e.exitPrice) > 1e9)) return 'Invalid exit price';
  if (e.tradedBy && !TRADED_BY.includes(e.tradedBy)) return 'Invalid tradedBy';
  if (e.contracts != null && (!isNum(e.contracts) || e.contracts < 0 || e.contracts > 10000)) return 'Invalid contracts';
  if (e.fees != null && (!isNum(e.fees) || e.fees < 0 || e.fees > 1e6)) return 'Invalid fees';
  if (e.symbol && !isStr(e.symbol, 10)) return 'Invalid symbol';
  return null;
}

function validatePayout(p) {
  if (!p || typeof p !== 'object') return 'Invalid request body';
  if (!isId(p.accountId)) return 'Invalid account ID';
  if (!isDate(p.date)) return 'Invalid date (YYYY-MM-DD)';
  if (!isNum(p.amount) || p.amount <= 0 || p.amount > 1e9) return 'Invalid amount';
  if (p.note && !isStr(p.note, 1000)) return 'Note too long (max 1000)';
  return null;
}

module.exports = { validateAccount, validateEntry, validatePayout, FIRMS, PHASES, STATUSES };
