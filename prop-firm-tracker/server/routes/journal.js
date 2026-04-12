"use strict";

const { Router } = require('express');
const { supabase } = require('../lib/db');
const { validateEntry } = require('../middleware/validation');

const router = Router();

// GET /api/accounts/:accountId/journal — entries for account
router.get('/accounts/:accountId/journal', async (req, res) => {
  const { data, error } = await supabase
    .from('journal_entries')
    .select('*')
    .eq('account_id', req.params.accountId)
    .eq('user_id', req.userId)
    .order('date', { ascending: false });

  if (error) { console.error('DB error:', error.message); return res.status(500).json({ error: 'Database operation failed' }); }
  res.json(data);
});

// GET /api/journal — all journal entries for user
router.get('/journal', async (req, res) => {
  const { data, error } = await supabase
    .from('journal_entries')
    .select('*')
    .eq('user_id', req.userId)
    .order('date', { ascending: false });

  if (error) { console.error('DB error:', error.message); return res.status(500).json({ error: 'Database operation failed' }); }
  res.json(data);
});

// POST /api/journal — create entry (or batch)
router.post('/journal', async (req, res) => {
  const entries = Array.isArray(req.body) ? req.body : [req.body];
  if (entries.length > 500) return res.status(400).json({ error: 'Max 500 entries per batch' });

  for (const e of entries) {
    const err = validateEntry(e);
    if (err) return res.status(400).json({ error: err });
  }

  // Verify all referenced accounts belong to user
  const accountIds = [...new Set(entries.map(e => e.accountId))];
  const { data: accounts } = await supabase
    .from('accounts')
    .select('id')
    .eq('user_id', req.userId)
    .in('id', accountIds);

  const validIds = new Set((accounts || []).map(a => a.id));
  for (const e of entries) {
    if (!validIds.has(e.accountId)) {
      return res.status(403).json({ error: `Account ${e.accountId} not found or not yours` });
    }
  }

  const rows = entries.map(e => ({
    user_id: req.userId,
    account_id: e.accountId,
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

  const { data, error } = await supabase
    .from('journal_entries')
    .insert(rows)
    .select();

  if (error) { console.error('DB error:', error.message); return res.status(500).json({ error: 'Database operation failed' }); }
  res.status(201).json(data);
});

// PUT /api/journal/:id — update entry
router.put('/journal/:id', async (req, res) => {
  const err = validateEntry(req.body);
  if (err) return res.status(400).json({ error: err });

  const e = req.body;

  // Verify account belongs to user
  const { data: account } = await supabase
    .from('accounts')
    .select('id')
    .eq('id', e.accountId)
    .eq('user_id', req.userId)
    .single();

  if (!account) return res.status(403).json({ error: 'Account not found or not yours' });

  const { data, error } = await supabase
    .from('journal_entries')
    .update({
      account_id: e.accountId,
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
    })
    .eq('id', req.params.id)
    .eq('user_id', req.userId)
    .select()
    .single();

  if (error) { console.error('DB error:', error.message); return res.status(500).json({ error: 'Database operation failed' }); }
  if (!data) return res.status(404).json({ error: 'Entry not found' });
  res.json(data);
});

// DELETE /api/journal/:id — delete entry
router.delete('/journal/:id', async (req, res) => {
  const { error } = await supabase
    .from('journal_entries')
    .delete()
    .eq('id', req.params.id)
    .eq('user_id', req.userId);

  if (error) { console.error('DB error:', error.message); return res.status(500).json({ error: 'Database operation failed' }); }
  res.json({ ok: true });
});

module.exports = router;
