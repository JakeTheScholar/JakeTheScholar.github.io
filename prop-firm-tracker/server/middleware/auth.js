"use strict";

const { supabase } = require('../lib/db');

// Verify JWT from Authorization header and attach user to request
async function requireAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid authorization header' });
  }

  const token = header.slice(7);
  if (!token) {
    return res.status(401).json({ error: 'Invalid token' });
  }

  try {
    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data?.user) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }
    req.user = data.user;
    req.userId = data.user.id;
    next();
  } catch {
    return res.status(401).json({ error: 'Authentication failed' });
  }
}

module.exports = { requireAuth };
