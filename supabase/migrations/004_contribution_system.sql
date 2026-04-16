-- =============================================
-- 기여도 기반 분배 시스템
-- =============================================

-- 1) Guild settings (healer bonus etc.)
CREATE TABLE guild_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guild_id UUID NOT NULL REFERENCES guilds(id) ON DELETE CASCADE UNIQUE,
  healer_bonus_rate NUMERIC(3,2) DEFAULT 0.20,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- RLS
ALTER TABLE guild_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_read" ON guild_settings FOR SELECT USING (true);
CREATE POLICY "admin_write" ON guild_settings FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Insert default settings
INSERT INTO guild_settings (guild_id, healer_bonus_rate)
VALUES ('00000000-0000-0000-0000-000000000001', 0.20);

-- 2) Contribution scores VIEW
CREATE OR REPLACE VIEW contribution_scores AS
SELECT
  p.id AS profile_id,
  p.nickname,
  p.character_class,
  e.content_type,
  e.season_id,
  SUM(
    CASE a.status
      WHEN 'present' THEN 2
      WHEN 'afk' THEN 1
      ELSE 0
    END
  ) AS raw_score,
  COUNT(*) AS total_events,
  COUNT(*) FILTER (WHERE a.status = 'present') AS present_count,
  COUNT(*) FILTER (WHERE a.status = 'afk') AS afk_count,
  COUNT(*) FILTER (WHERE a.status = 'absent') AS absent_count
FROM profiles p
JOIN attendances a ON a.profile_id = p.id
JOIN events e ON e.id = a.event_id
WHERE p.is_active = true
GROUP BY p.id, p.nickname, p.character_class, e.content_type, e.season_id;

-- 3) Lotteries table extensions
ALTER TABLE lotteries ADD COLUMN weight_mode TEXT DEFAULT 'equal'
  CHECK (weight_mode IN ('equal', 'contribution', 'value_based'));
ALTER TABLE lotteries ADD COLUMN weight_season_id UUID REFERENCES seasons(id);
ALTER TABLE lotteries ADD COLUMN weight_content_type TEXT;
ALTER TABLE lotteries ADD COLUMN healer_bonus_enabled BOOLEAN DEFAULT false;
ALTER TABLE lotteries ADD COLUMN participant_weights JSONB;
ALTER TABLE lotteries ADD COLUMN item_values JSONB;
