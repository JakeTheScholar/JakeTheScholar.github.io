-- Prop Firm Tracker — initial schema
-- Supabase Auth handles auth.users

CREATE TABLE accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  firm TEXT NOT NULL CHECK (firm IN ('apex','topstep','mff','alpha','lucid')),
  phase TEXT NOT NULL CHECK (phase IN ('eval','funded','live')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','archived')),
  subtype TEXT CHECK (subtype IN ('normal','consistency','core','rapid')),
  rules TEXT,
  starting_balance NUMERIC NOT NULL DEFAULT 50000,
  trailing_drawdown NUMERIC,
  traded_by TEXT DEFAULT 'manual' CHECK (traded_by IN ('manual','bot')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  archived_at TIMESTAMPTZ
);

CREATE TABLE journal_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  pnl NUMERIC NOT NULL,
  entry_price NUMERIC,
  exit_price NUMERIC,
  entry_time TEXT,
  exit_time TEXT,
  symbol TEXT,
  contracts INTEGER,
  fees NUMERIC DEFAULT 0,
  traded_by TEXT DEFAULT 'manual',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE payouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  amount NUMERIC NOT NULL CHECK (amount > 0),
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Row Level Security
ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE journal_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE payouts ENABLE ROW LEVEL SECURITY;

CREATE POLICY accounts_user ON accounts FOR ALL USING (user_id = auth.uid());
CREATE POLICY journal_user ON journal_entries FOR ALL USING (user_id = auth.uid());
CREATE POLICY payouts_user ON payouts FOR ALL USING (user_id = auth.uid());

-- Indexes
CREATE INDEX idx_accounts_user ON accounts(user_id);
CREATE INDEX idx_journal_account ON journal_entries(account_id);
CREATE INDEX idx_journal_user_date ON journal_entries(user_id, date);
CREATE INDEX idx_payouts_account ON payouts(account_id);
