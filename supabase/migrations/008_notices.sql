-- Notices (announcements)
CREATE TABLE notices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guild_id UUID NOT NULL REFERENCES guilds(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  is_pinned BOOLEAN DEFAULT false,
  created_by UUID REFERENCES admin_users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- RLS
ALTER TABLE notices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_read" ON notices FOR SELECT USING (true);
CREATE POLICY "admin_write" ON notices FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Index
CREATE INDEX idx_notices_guild ON notices(guild_id);
CREATE INDEX idx_notices_pinned ON notices(is_pinned, created_at DESC);
