"use strict";

const { Router } = require('express');
const { supabase } = require('../lib/db');
const { validatePayout } = require('../middleware/validation');

const router = Router();

// GET /api/accounts/:accountId/payouts — payouts for account
router.get('/accounts/:accountId/payouts', async (req, res) => {
  const { data, error } = await supabase
    .from('payouts')
    .select('*')
    .eq('account_id', req.params.accountId)
    .eq('user_id', req.userId)
    .order('date', { ascending: false });

  if (error) { console.error('DB error:', error.message); return res.status(500).json({ error: 'Database operation failed' }); }
  res.json(data);
});

// GET /api/payouts — all payouts for user
router.get('/payouts', async (req, res) => {
  const { data, error } = await supabase
    .from('payouts')
    .select('*')
    .eq('user_id', req.userId)
    .order('date', { ascending: false });

  if (error) { console.error('DB error:', error.message); return res.status(500).json({ error: 'Database operation failed' }); }
  res.json(data);
});

// POST /api/payouts — create payout
router.post('/payouts', async (req, res) => {
  const err = validatePayout(req.body);
  if (err) return res.status(400).json({ error: err });

  const p = req.body;

  // Verify account belongs to user
  const { data: account } = await supabase
    .from('accounts')
    .select('id')
    .eq('id', p.accountId)
    .eq('user_id', req.userId)
    .single();

  if (!account) return res.status(403).json({ error: 'Account not found or not yours' });

  const { data, error } = await supabase
    .from('payouts')
    .insert({
      user_id: req.userId,
      account_id: account.id,
      date: p.date,
      amount: p.amount,
      note: p.note || null,
    })
    .select()
    .single();

  if (error) { console.error('DB error:', error.message); return res.status(500).json({ error: 'Database operation failed' }); }
  res.status(201).json(data);
});

// DELETE /api/payouts/:id — delete payout
router.delete('/payouts/:id', async (req, res) => {
  const { error } = await supabase
    .from('payouts')
    .delete()
    .eq('id', req.params.id)
    .eq('user_id', req.userId);

  if (error) { console.error('DB error:', error.message); return res.status(500).json({ error: 'Database operation failed' }); }
  res.json({ ok: true });
});

module.exports = router;
