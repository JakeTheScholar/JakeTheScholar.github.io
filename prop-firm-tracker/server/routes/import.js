"use strict";

const { Router } = require('express');
const { supabase } = require('../lib/db');
const { validateAccount, validateEntry, validatePayout } = require('../middleware/validation');
const { importLimiter } = require('../middleware/rate-limit');

const router = Router();

// POST /api/import — import TCC v1 JSON export (5 per hour max)
router.post('/import', importLimiter, async (req, res) => {
  const data = req.body;

  if (!data || typeof data !== 'object') {
    return res.status(400).json({ error: 'Invalid import data' });
  }
  if (!Array.isArray(data.accounts) || !Array.isArray(data.journal)) {
    return res.status(400).json({ error: 'Import must contain accounts and journal arrays' });
  }
  if (data.accounts.length > 10000) {
    return res.status(400).json({ error: 'Too many accounts (max 10000)' });
  }
  if (data.journal.length > 100000) {
    return res.status(400).json({ error: 'Too many journal entries (max 100000)' });
  }
  if (data.payouts && data.payouts.length > 50000) {
    return res.status(400).json({ error: 'Too many payouts (max 50000)' });
  }

  // Validate all entries
  for (const a of data.accounts) {
    const err = validateAccount(a);
    if (err) return res.status(400).json({ error: `Account "${a.name || '?'}": ${err}` });
  }
  for (const e of data.journal) {
    const err = validateEntry(e);
    if (err) return res.status(400).json({ error: `Journal entry: ${err}` });
  }
  if (data.payouts) {
    for (const p of data.payouts) {
      const err = validatePayout(p);
      if (err) return res.status(400).json({ error: `Payout: ${err}` });
    }
  }

  try {
    // Map old TCC IDs → new Supabase UUIDs
    const idMap = {};

    // Insert accounts
    for (const a of data.accounts) {
      const { data: inserted, error } = await supabase
        .from('accounts')
        .insert({
          user_id: req.userId,
          name: a.name.trim(),
          firm: a.firm,
          phase: a.phase,
          status: a.status || 'active',
          subtype: a.subtype || null,
          rules: a.rules || null,
          starting_balance: a.startingBalance,
          trailing_drawdown: a.trailingDrawdown ?? null,
          traded_by: a.tradedBy || 'manual',
        })
        .select()
        .single();

      if (error) { console.error('Import account error:', error.message); return res.status(500).json({ error: 'Failed to import accounts' }); }
      idMap[a.id] = inserted.id;
    }

    // Insert journal entries in batches of 100
    const journalRows = data.journal
      .filter(e => idMap[e.accountId]) // Skip entries for missing accounts
      .map(e => ({
        user_id: req.userId,
        account_id: idMap[e.accountId],
        date: e.date,
        pnl: e.pnl,
        entry_price: e.entryPrice ?? null,
        exit_price: e.exitPrice ?? null,
        entry_time: e.entryTime || null,
        exit_time: e.exitTime || null,
        symbol: e.symbol || null,
        contracts: e.contracts ?? null,
        fees: e.fees ?? 0,
        traded_by: e.tradedBy || 'manual',
        notes: e.notes || null,
      }));

    for (let i = 0; i < journalRows.length; i += 100) {
      const batch = journalRows.slice(i, i + 100);
      const { error } = await supabase.from('journal_entries').insert(batch);
      if (error) { console.error('Import journal error:', error.message); return res.status(500).json({ error: 'Failed to import journal entries' }); }
    }

    // Insert payouts
    if (data.payouts) {
      const payoutRows = data.payouts
        .filter(p => idMap[p.accountId])
        .map(p => ({
          user_id: req.userId,
          account_id: idMap[p.accountId],
          date: p.date,
          amount: p.amount,
          note: p.note || null,
        }));

      for (let i = 0; i < payoutRows.length; i += 100) {
        const batch = payoutRows.slice(i, i + 100);
        const { error } = await supabase.from('payouts').insert(batch);
        if (error) { console.error('Import payouts error:', error.message); return res.status(500).json({ error: 'Failed to import payouts' }); }
      }
    }

    res.json({
      ok: true,
      imported: {
        accounts: data.accounts.length,
        journal: journalRows.length,
        payouts: data.payouts ? data.payouts.filter(p => idMap[p.accountId]).length : 0,
      },
    });
  } catch (err) {
    console.error('Import error:', err.message);
    res.status(500).json({ error: 'Import failed' });
  }
});

// GET /api/export — export all data as JSON
router.get('/export', async (req, res) => {
  const [accounts, journal, payouts] = await Promise.all([
    supabase.from('accounts').select('*').eq('user_id', req.userId),
    supabase.from('journal_entries').select('*').eq('user_id', req.userId).order('date'),
    supabase.from('payouts').select('*').eq('user_id', req.userId).order('date'),
  ]);

  if (accounts.error || journal.error || payouts.error) {
    return res.status(500).json({ error: 'Export failed' });
  }

  // Normalize to TCC-compatible format for portability
  res.json({
    version: 2,
    exportedAt: new Date().toISOString(),
    accounts: (accounts.data || []).map(a => ({
      id: a.id, name: a.name, firm: a.firm, phase: a.phase,
      status: a.status, subtype: a.subtype, rules: a.rules,
      startingBalance: Number(a.starting_balance),
      trailingDrawdown: a.trailing_drawdown != null ? Number(a.trailing_drawdown) : null,
      tradedBy: a.traded_by, createdAt: a.created_at, archivedAt: a.archived_at,
    })),
    journal: (journal.data || []).map(e => ({
      id: e.id, accountId: e.account_id, date: e.date,
      pnl: Number(e.pnl),
      entryPrice: e.entry_price != null ? Number(e.entry_price) : null,
      exitPrice: e.exit_price != null ? Number(e.exit_price) : null,
      entryTime: e.entry_time, exitTime: e.exit_time,
      symbol: e.symbol, contracts: e.contracts,
      fees: e.fees != null ? Number(e.fees) : 0,
      tradedBy: e.traded_by, notes: e.notes, createdAt: e.created_at,
    })),
    payouts: (payouts.data || []).map(p => ({
      id: p.id, accountId: p.account_id, date: p.date,
      amount: Number(p.amount), note: p.note, createdAt: p.created_at,
    })),
  });
});

module.exports = router;
