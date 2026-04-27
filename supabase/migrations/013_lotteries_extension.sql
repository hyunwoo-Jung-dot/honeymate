-- Phase B: Extend lotteries to support unified distribution system
-- (asset / items target × all / random / weighted / ranked selection modes)

-- ====================================================================
-- 1) Extend lotteries
-- ====================================================================
ALTER TABLE lotteries
  ADD COLUMN IF NOT EXISTS target_kind TEXT
    CHECK (target_kind IN ('asset','items')),
  ADD COLUMN IF NOT EXISTS selection_mode TEXT
    CHECK (selection_mode IN ('all','random_pick','weighted_pick','ranked')),
  ADD COLUMN IF NOT EXISTS asset_id UUID REFERENCES distribution_assets(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS total_amount NUMERIC,
  ADD COLUMN IF NOT EXISTS recipient_count INT,
  ADD COLUMN IF NOT EXISTS rank_ratios NUMERIC[];

-- Backfill existing rows: legacy lottery rows are item-target, random pick (1:1)
UPDATE lotteries
SET target_kind = 'items', selection_mode = 'random_pick'
WHERE target_kind IS NULL;

-- ====================================================================
-- 2) Lottery basis events (which events were used to compute scores)
-- ====================================================================
CREATE TABLE IF NOT EXISTS lottery_basis_events (
  lottery_id UUID NOT NULL REFERENCES lotteries(id) ON DELETE CASCADE,
  event_id   UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  PRIMARY KEY (lottery_id, event_id)
);

CREATE INDEX IF NOT EXISTS idx_lottery_basis_events_event
  ON lottery_basis_events (event_id);

ALTER TABLE lottery_basis_events ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "lottery_basis_events anon read" ON lottery_basis_events
    FOR SELECT TO anon USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "lottery_basis_events auth all" ON lottery_basis_events
    FOR ALL TO authenticated USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ====================================================================
-- 3) Per-member allocations (for asset distributions and ranked items)
-- ====================================================================
CREATE TABLE IF NOT EXISTS lottery_allocations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lottery_id UUID NOT NULL REFERENCES lotteries(id) ON DELETE CASCADE,
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  rank INT,
  score NUMERIC,
  amount NUMERIC,
  item TEXT,
  is_received BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (lottery_id, profile_id)
);

CREATE INDEX IF NOT EXISTS idx_lottery_allocations_lottery
  ON lottery_allocations (lottery_id);

ALTER TABLE lottery_allocations ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "lottery_allocations anon read" ON lottery_allocations
    FOR SELECT TO anon USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "lottery_allocations auth all" ON lottery_allocations
    FOR ALL TO authenticated USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
