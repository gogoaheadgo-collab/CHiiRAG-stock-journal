-- ═══════════════════════════════════════════════════════════════════════════
-- RISK MANAGEMENT — portfolios + per-trade manual inputs
-- Run in: Supabase → SQL Editor → New Query → Run
-- Does not touch the trades / executions tables.
-- ═══════════════════════════════════════════════════════════════════════════

-- A named group of accounts (own and/or subscriber accounts).
-- members: [{ "owner_id": "<auth user id>", "account": "<account name>" }, ...]
-- excluded_trade_ids: trades removed from this portfolio's calculations
CREATE TABLE IF NOT EXISTS risk_portfolios (
  id                  UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id             UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name                TEXT NOT NULL,
  members             JSONB NOT NULL DEFAULT '[]'::jsonb,
  excluded_trade_ids  UUID[] NOT NULL DEFAULT '{}',
  portfolio_size      NUMERIC,      -- capital used for open-risk %
  created_at          TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE risk_portfolios ADD COLUMN IF NOT EXISTS portfolio_size NUMERIC;

ALTER TABLE risk_portfolios ENABLE ROW LEVEL SECURITY;
CREATE POLICY "risk_portfolios_select" ON risk_portfolios FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "risk_portfolios_insert" ON risk_portfolios FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "risk_portfolios_update" ON risk_portfolios FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "risk_portfolios_delete" ON risk_portfolios FOR DELETE USING (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS risk_portfolios_user_idx ON risk_portfolios(user_id);

-- Values typed on the Risk Management page, one row per (viewer, trade).
CREATE TABLE IF NOT EXISTS risk_trade_inputs (
  user_id     UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  trade_id    UUID REFERENCES trades(id) ON DELETE CASCADE NOT NULL,
  risk_pct    NUMERIC,          -- 1 = 1% of account
  stop_loss   NUMERIC,          -- original stop loss, entered manually
  setup       TEXT,             -- overrides the trade's strategy when set
  dma20       NUMERIC,
  dma50       NUMERIC,
  mae         NUMERIC,
  updated_at  TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, trade_id)
);

ALTER TABLE risk_trade_inputs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "risk_trade_inputs_select" ON risk_trade_inputs FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "risk_trade_inputs_insert" ON risk_trade_inputs FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "risk_trade_inputs_update" ON risk_trade_inputs FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "risk_trade_inputs_delete" ON risk_trade_inputs FOR DELETE USING (auth.uid() = user_id);
