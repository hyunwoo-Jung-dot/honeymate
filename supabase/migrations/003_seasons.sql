-- Seasons table
CREATE TABLE seasons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE,
  is_active BOOLEAN DEFAULT false,
  guild_id UUID NOT NULL REFERENCES guilds(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Add season_id to events
ALTER TABLE events ADD COLUMN season_id UUID REFERENCES seasons(id) ON DELETE SET NULL;

-- RLS
ALTER TABLE seasons ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_read" ON seasons FOR SELECT USING (true);
CREATE POLICY "admin_write" ON seasons FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Index
CREATE INDEX idx_events_season ON events(season_id);
CREATE INDEX idx_seasons_active ON seasons(is_active) WHERE is_active = true;

-- Insert default season
INSERT INTO seasons (name, start_date, is_active, guild_id)
VALUES ('시즌 1', '2026-04-01', true, '00000000-0000-0000-0000-000000000001');
