-- Diamond distribution tracking
CREATE TABLE diamond_distributions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guild_id UUID NOT NULL REFERENCES guilds(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  total_amount INTEGER NOT NULL,
  per_person INTEGER NOT NULL,
  recipient_count INTEGER NOT NULL,
  is_distributed BOOLEAN DEFAULT false,
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE diamond_distribution_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  distribution_id UUID NOT NULL
    REFERENCES diamond_distributions(id) ON DELETE CASCADE,
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  is_received BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE diamond_distributions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_read" ON diamond_distributions FOR SELECT USING (true);
CREATE POLICY "admin_write" ON diamond_distributions
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE diamond_distribution_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_read" ON diamond_distribution_members FOR SELECT USING (true);
CREATE POLICY "admin_write" ON diamond_distribution_members
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE INDEX idx_diamond_dist_guild ON diamond_distributions(guild_id);
CREATE INDEX idx_diamond_dist_members ON diamond_distribution_members(distribution_id);
