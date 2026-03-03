-- ═══════════════════════════════════════════════════════════════════════════
-- CHIIRAG STOCK JOURNAL — Supabase Schema
-- Run this entire file in: Supabase → SQL Editor → New Query → Run
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. ACCOUNTS table (dynamic dropdown names) ──────────────────────────────
CREATE TABLE IF NOT EXISTS accounts (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id    UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name       TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, name)
);

ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "accounts_select" ON accounts FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "accounts_insert" ON accounts FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "accounts_delete" ON accounts FOR DELETE USING (auth.uid() = user_id);


-- ── 2. TRADES table (all 17 columns from Excel model) ───────────────────────
CREATE TABLE IF NOT EXISTS trades (
  id                  UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id             UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,

  -- Core trade info
  account             TEXT,                          -- ACCOUNT
  ticker              TEXT NOT NULL,                 -- Ticker
  status              TEXT DEFAULT 'OPEN'
                      CHECK (status IN ('OPEN','CLOSED')),  -- Status
  direction           TEXT DEFAULT 'LONG'
                      CHECK (direction IN ('LONG','SHORT')), -- Direction

  -- Entry
  entry_date          DATE NOT NULL,                 -- Entry Date
  entry_price         NUMERIC NOT NULL,              -- Entry Price
  quantity            NUMERIC NOT NULL,              -- Quantity
  invested_capital    NUMERIC,                       -- Invested Capital (auto)

  -- Exit
  exit_date           DATE,                          -- Exit Date
  exit_price          NUMERIC,                       -- Exit Price
  exit_notes          TEXT,                          -- Exit notes

  -- P&L
  unrealized_gains    NUMERIC,                       -- Unrealized Gains (computed live)
  realized_gains      NUMERIC,                       -- Realized Gains (set on close)

  -- MTF
  mtf_value           NUMERIC,                       -- MTF VALUE
  mtf_interest_rate   NUMERIC,                       -- MTF INTEREST rate % p.a.

  -- Meta
  notes               TEXT,                          -- Strategy / notes
  created_at          TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE trades ENABLE ROW LEVEL SECURITY;

CREATE POLICY "trades_select" ON trades FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "trades_insert" ON trades FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "trades_update" ON trades FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "trades_delete" ON trades FOR DELETE USING (auth.uid() = user_id);

-- Indexes
CREATE INDEX IF NOT EXISTS trades_user_idx ON trades(user_id);
CREATE INDEX IF NOT EXISTS trades_date_idx ON trades(created_at DESC);
CREATE INDEX IF NOT EXISTS trades_status_idx ON trades(status);
