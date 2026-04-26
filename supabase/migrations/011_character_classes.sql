-- Character classes registry — admins can add/edit/delete classes from 관리 page

CREATE TABLE IF NOT EXISTS character_classes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guild_id UUID NOT NULL REFERENCES guilds(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  label TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (guild_id, code)
);

CREATE INDEX IF NOT EXISTS idx_character_classes_guild
  ON character_classes (guild_id, sort_order);

ALTER TABLE character_classes ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "character_classes anon read" ON character_classes
    FOR SELECT TO anon USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "character_classes auth all" ON character_classes
    FOR ALL TO authenticated USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Seed default classes for the main guild
INSERT INTO character_classes (guild_id, code, label, sort_order)
VALUES
  ('00000000-0000-0000-0000-000000000001', 'archer',    '활',       1),
  ('00000000-0000-0000-0000-000000000001', 'healer',    '힐러',     2),
  ('00000000-0000-0000-0000-000000000001', 'swordsman', '쌍검',     3),
  ('00000000-0000-0000-0000-000000000001', 'lancer',    '창',       4),
  ('00000000-0000-0000-0000-000000000001', 'gunner',    '화포',     5),
  ('00000000-0000-0000-0000-000000000001', 'rapier',    '레이피어', 6),
  ('00000000-0000-0000-0000-000000000001', 'sword',     '한손검',   7)
ON CONFLICT (guild_id, code) DO NOTHING;
