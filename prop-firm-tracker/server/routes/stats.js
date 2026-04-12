"use strict";

const { Router } = require('express');
const { supabase } = require('../lib/db');
const Rules = require('../lib/rules');

const router = Router();

// GET /api/accounts/:id/stats — computed stats for one account
router.get('/accounts/:id/stats', async (req, res) => {
  // Fetch account
  const { data: account, error: accErr } = await supabase
    .from('accounts')
    .select('*')
    .eq('id', req.params.id)
    .eq('user_id', req.userId)
    .single();

  if (accErr || !account) return res.status(404).json({ error: 'Account not found' });

  // Fetch journal entries
  const { data: entries, error: entErr } = await supabase
    .from('journal_entries')
    .select('*')
    .eq('account_id', account.id)
    .eq('user_id', req.userId)
    .order('date');

  if (entErr) { console.error('DB error:', entErr.message); return res.status(500).json({ error: 'Database operation failed' }); }

  // Normalize DB column names to Rules engine format
  const normalized = (entries || []).map(e => ({
    date: e.date,
    pnl: Number(e.pnl),
    accountId: e.account_id,
  }));

  const accountObj = {
    id: account.id,
    name: account.name,
    rules: account.rules,
    startingBalance: Number(account.starting_balance),
    trailingDrawdown: account.trailing_drawdown != null ? Number(account.trailing_drawdown) : null,
  };

  const stats = Rules.compute(accountObj, normalized);
  res.json(stats);
});

// GET /api/dashboard — aggregate dashboard data
router.get('/dashboard', async (req, res) => {
  // Fetch all active accounts
  const { data: accounts, error: accErr } = await supabase
    .from('accounts')
    .select('*')
    .eq('user_id', req.userId)
    .eq('status', 'active');

  if (accErr) { console.error('DB error:', accErr.message); return res.status(500).json({ error: 'Database operation failed' }); }

  // Fetch all journal entries
  const { data: entries, error: entErr } = await supabase
    .from('journal_entries')
    .select('*')
    .eq('user_id', req.userId);

  if (entErr) { console.error('DB error:', entErr.message); return res.status(500).json({ error: 'Database operation failed' }); }

  // Fetch all payouts
  const { data: payouts, error: payErr } = await supabase
    .from('payouts')
    .select('*')
    .eq('user_id', req.userId);

  if (payErr) { console.error('DB error:', payErr.message); return res.status(500).json({ error: 'Database operation failed' }); }

  // Compute stats per account
  const accountStats = (accounts || []).map(a => {
    const acctEntries = (entries || [])
      .filter(e => e.account_id === a.id)
      .map(e => ({ date: e.date, pnl: Number(e.pnl), accountId: e.account_id }));

    const accountObj = {
      id: a.id, name: a.name, firm: a.firm, phase: a.phase,
      status: a.status, subtype: a.subtype, rules: a.rules,
      startingBalance: Number(a.starting_balance),
      trailingDrawdown: a.trailing_drawdown != null ? Number(a.trailing_drawdown) : null,
      tradedBy: a.traded_by,
    };

    return {
      account: accountObj,
      stats: Rules.compute(accountObj, acctEntries),
      entryCount: acctEntries.length,
    };
  });

  res.json({
    accounts: accountStats,
    payouts: payouts || [],
    totalAccounts: (accounts || []).length,
  });
});

module.exports = router;
