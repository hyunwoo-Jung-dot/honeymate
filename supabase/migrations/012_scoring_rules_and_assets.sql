-- Phase A: distribution assets + per-content scoring rules
-- Replaces hardcoded contribution scoring with admin-configurable rules.

-- ====================================================================
-- 1) Distribution assets (다이아, 길드주화, ...)
-- ====================================================================
CREATE TABLE IF NOT EXISTS distribution_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guild_id UUID NOT NULL REFERENCES guilds(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  unit TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (guild_id, name)
);

CREATE INDEX IF NOT EXISTS idx_distribution_assets_guild
  ON distribution_assets (guild_id, sort_order);

ALTER TABLE distribution_assets ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "distribution_assets anon read" ON distribution_assets
    FOR SELECT TO anon USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "distribution_assets auth all" ON distribution_assets
    FOR ALL TO authenticated USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

INSERT INTO distribution_assets (guild_id, name, unit, sort_order)
VALUES
  ('00000000-0000-0000-0000-000000000001', '다이아',   '다이아', 1),
  ('00000000-0000-0000-0000-000000000001', '길드주화', '주화',   2)
ON CONFLICT (guild_id, name) DO NOTHING;

-- ====================================================================
-- 2) Content scoring rules
-- ====================================================================
CREATE TABLE IF NOT EXISTS content_scoring_rules (
  guild_id UUID NOT NULL REFERENCES guilds(id) ON DELETE CASCADE,
  content_type TEXT NOT NULL,
  present_score NUMERIC NOT NULL DEFAULT 2,
  afk_score     NUMERIC NOT NULL DEFAULT 1,
  absent_score  NUMERIC NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (guild_id, content_type)
);

ALTER TABLE content_scoring_rules ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "content_scoring_rules anon read" ON content_scoring_rules
    FOR SELECT TO anon USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "content_scoring_rules auth all" ON content_scoring_rules
    FOR ALL TO authenticated USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Seed default rules. crusade / faction_war default to afk = -1 (penalty).
INSERT INTO content_scoring_rules (guild_id, content_type, present_score, afk_score, absent_score)
VALUES
  ('00000000-0000-0000-0000-000000000001', 'guild_dungeon', 2,  1, 0),
  ('00000000-0000-0000-0000-000000000001', 'crusade',       2, -1, 0),
  ('00000000-0000-0000-0000-000000000001', 'faction_war',   2, -1, 0),
  ('00000000-0000-0000-0000-000000000001', 'guild_war',     2,  1, 0),
  ('00000000-0000-0000-0000-000000000001', 'boss_raid',     2,  1, 0),
  ('00000000-0000-0000-0000-000000000001', 'ice_dungeon',   2,  1, 0)
ON CONFLICT (guild_id, content_type) DO NOTHING;

-- ====================================================================
-- 3) Redefine contribution_scores VIEW to apply per-content rules
-- ====================================================================
DROP VIEW IF EXISTS contribution_scores;

CREATE VIEW contribution_scores AS
SELECT
  p.id          AS profile_id,
  e.season_id   AS season_id,
  e.content_type AS content_type,
  COALESCE(SUM(
    CASE a.status
      WHEN 'present' THEN COALESCE(r.present_score, 2)
      WHEN 'afk'     THEN COALESCE(r.afk_score, 1)
      WHEN 'absent'  THEN COALESCE(r.absent_score, 0)
      ELSE 0
    END
  ), 0) AS raw_score,
  COUNT(a.id) AS event_count
FROM profiles p
LEFT JOIN events e
  ON e.guild_id = p.guild_id
LEFT JOIN attendances a
  ON a.event_id = e.id AND a.profile_id = p.id
LEFT JOIN content_scoring_rules r
  ON r.guild_id = e.guild_id AND r.content_type = e.content_type
WHERE p.is_active = true
GROUP BY p.id, e.season_id, e.content_type;
