-- Item registry for pre-registering item values
CREATE TABLE item_registry (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  grade TEXT,
  gold_value BIGINT DEFAULT 0,
  guild_id UUID NOT NULL REFERENCES guilds(id) ON DELETE CASCADE,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- RLS
ALTER TABLE item_registry ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_read" ON item_registry FOR SELECT USING (true);
CREATE POLICY "admin_write" ON item_registry FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Index
CREATE INDEX idx_item_registry_guild ON item_registry(guild_id);
