-- Boss registry for pre-registering boss names
CREATE TABLE boss_registry (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  content_type TEXT,
  guild_id UUID NOT NULL REFERENCES guilds(id) ON DELETE CASCADE,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- RLS
ALTER TABLE boss_registry ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_read" ON boss_registry FOR SELECT USING (true);
CREATE POLICY "admin_write" ON boss_registry FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Index
CREATE INDEX idx_boss_registry_guild ON boss_registry(guild_id);

-- Seed common Night Crows bosses (길드 던전)
INSERT INTO boss_registry (name, content_type, guild_id) VALUES
('오그론', 'guild_dungeon', '00000000-0000-0000-0000-000000000001'),
('해방자 고엘', 'guild_dungeon', '00000000-0000-0000-0000-000000000001'),
('잔혹한 무쇠심장 코드쉬', 'guild_dungeon', '00000000-0000-0000-0000-000000000001'),
('티그달', 'ice_dungeon', '00000000-0000-0000-0000-000000000001'),
('가트필리언', 'ice_dungeon', '00000000-0000-0000-0000-000000000001'),
('다르달로카', 'ice_dungeon', '00000000-0000-0000-0000-000000000001'),
('호투라', 'ice_dungeon', '00000000-0000-0000-0000-000000000001'),
('다미로스', 'ice_dungeon', '00000000-0000-0000-0000-000000000001'),
('판데어', 'ice_dungeon', '00000000-0000-0000-0000-000000000001'),
('스토미드', 'ice_dungeon', '00000000-0000-0000-0000-000000000001'),
('하키르', 'ice_dungeon', '00000000-0000-0000-0000-000000000001'),
('카프카', 'ice_dungeon', '00000000-0000-0000-0000-000000000001'),
('멜빌', 'ice_dungeon', '00000000-0000-0000-0000-000000000001'),
('몰락의 기사', 'ice_dungeon', '00000000-0000-0000-0000-000000000001'),
('탄달론', 'ice_dungeon', '00000000-0000-0000-0000-000000000001'),
('발타자드', 'ice_dungeon', '00000000-0000-0000-0000-000000000001'),
('트라쉬', 'boss_raid', '00000000-0000-0000-0000-000000000001');
