"use strict";

const { Router } = require('express');
const { supabase } = require('../lib/db');
const { validateAccount } = require('../middleware/validation');

const router = Router();

function isValidId(v) { return typeof v === 'string' && v.length <= 100 && /^[\w-]+$/.test(v); }

// GET /api/accounts — list user's accounts
router.get('/', async (req, res) => {
  const { data, error } = await supabase
    .from('accounts')
    .select('*')
    .eq('user_id', req.userId)
    .order('created_at', { ascending: false });

  if (error) { console.error('DB error:', error.message); return res.status(500).json({ error: 'Database operation failed' }); }
  res.json(data);
});

// POST /api/accounts — create account
router.post('/', async (req, res) => {
  const err = validateAccount(req.body);
  if (err) return res.status(400).json({ error: err });

  const { name, firm, phase, status, subtype, rules, startingBalance, trailingDrawdown, tradedBy } = req.body;

  const { data, error } = await supabase
    .from('accounts')
    .insert({
      user_id: req.userId,
      name: name.trim(),
      firm, phase,
      status: status || 'active',
      subtype: subtype || null,
      rules: rules || null,
      starting_balance: startingBalance,
      trailing_drawdown: trailingDrawdown ?? null,
      traded_by: tradedBy || 'manual',
    })
    .select()
    .single();

  if (error) { console.error('DB error:', error.message); return res.status(500).json({ error: 'Database operation failed' }); }
  res.status(201).json(data);
});

// PUT /api/accounts/:id — update account
router.put('/:id', async (req, res) => {
  const err = validateAccount(req.body);
  if (err) return res.status(400).json({ error: err });

  const { name, firm, phase, status, subtype, rules, startingBalance, trailingDrawdown, tradedBy } = req.body;

  const { data, error } = await supabase
    .from('accounts')
    .update({
      name: name.trim(),
      firm, phase,
      status: status || 'active',
      subtype: subtype || null,
      rules: rules || null,
      starting_balance: startingBalance,
      trailing_drawdown: trailingDrawdown ?? null,
      traded_by: tradedBy || 'manual',
      archived_at: status === 'archived' ? new Date().toISOString() : null,
    })
    .eq('id', req.params.id)
    .eq('user_id', req.userId)
    .select()
    .single();

  if (error) { console.error('DB error:', error.message); return res.status(500).json({ error: 'Database operation failed' }); }
  if (!data) return res.status(404).json({ error: 'Account not found' });
  res.json(data);
});

// DELETE /api/accounts/:id — delete account (cascades journal + payouts via FK)
router.delete('/:id', async (req, res) => {
  if (!isValidId(req.params.id)) return res.status(400).json({ error: 'Invalid ID format' });

  const { error } = await supabase
    .from('accounts')
    .delete()
    .eq('id', req.params.id)
    .eq('user_id', req.userId);

  if (error) { console.error('DB error:', error.message); return res.status(500).json({ error: 'Database operation failed' }); }
  res.json({ ok: true });
});

module.exports = router;
