-- =============================================
-- 꿀메이트 Guild Management - Initial Schema
-- =============================================

-- 1) Alliances
CREATE TABLE alliances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 2) Guilds
CREATE TABLE guilds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  alliance_id UUID REFERENCES alliances(id) ON DELETE SET NULL,
  max_members INTEGER DEFAULT 50,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 3) Profiles (guild members - no auth needed)
CREATE TABLE profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nickname TEXT NOT NULL,
  server_name TEXT,
  character_class TEXT CHECK (
    character_class IN ('warrior', 'swordsman', 'mage', 'archer')
  ),
  combat_power INTEGER DEFAULT 0,
  guild_id UUID NOT NULL REFERENCES guilds(id) ON DELETE CASCADE,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 4) Admin users (officers - linked to Supabase Auth)
CREATE TABLE admin_users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  display_name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'officer'
    CHECK (role IN ('owner', 'officer')),
  guild_id UUID NOT NULL REFERENCES guilds(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 5) Events (guild content sessions)
CREATE TABLE events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guild_id UUID NOT NULL REFERENCES guilds(id) ON DELETE CASCADE,
  alliance_id UUID REFERENCES alliances(id) ON DELETE SET NULL,
  content_type TEXT NOT NULL CHECK (
    content_type IN (
      'guild_dungeon', 'guild_war', 'crusade',
      'boss_raid', 'ice_dungeon', 'faction_war'
    )
  ),
  title TEXT NOT NULL,
  difficulty TEXT,
  boss_name TEXT,
  scheduled_at TIMESTAMPTZ NOT NULL,
  status TEXT DEFAULT 'scheduled'
    CHECK (status IN ('scheduled', 'in_progress', 'completed')),
  note TEXT,
  created_by UUID REFERENCES admin_users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 6) Attendance records
CREATE TABLE attendances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'absent'
    CHECK (status IN ('present', 'afk', 'absent')),
  note TEXT,
  checked_by UUID REFERENCES admin_users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(event_id, profile_id)
);

-- 7) Lotteries (commit-reveal fair draw)
CREATE TABLE lotteries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID REFERENCES events(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('ladder', 'random_pick')),
  participants JSONB NOT NULL,
  items JSONB NOT NULL,
  seed_timestamp TIMESTAMPTZ NOT NULL,
  server_secret TEXT NOT NULL,
  commit_hash TEXT NOT NULL,
  result JSONB,
  revealed_at TIMESTAMPTZ,
  status TEXT DEFAULT 'pending'
    CHECK (status IN ('pending', 'committed', 'revealed')),
  created_by UUID REFERENCES admin_users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 8) Distribution records
CREATE TABLE distributions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID REFERENCES events(id) ON DELETE SET NULL,
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  item_name TEXT NOT NULL,
  item_grade TEXT,
  quantity INTEGER DEFAULT 1,
  gold_value BIGINT,
  method TEXT NOT NULL DEFAULT 'manual'
    CHECK (method IN ('manual', 'ladder', 'random')),
  lottery_id UUID REFERENCES lotteries(id) ON DELETE SET NULL,
  distributed_by UUID REFERENCES admin_users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- =============================================
-- Indexes
-- =============================================
CREATE INDEX idx_profiles_guild ON profiles(guild_id);
CREATE INDEX idx_events_guild ON events(guild_id);
CREATE INDEX idx_events_scheduled ON events(scheduled_at DESC);
CREATE INDEX idx_attendances_event ON attendances(event_id);
CREATE INDEX idx_attendances_profile ON attendances(profile_id);
CREATE INDEX idx_distributions_event ON distributions(event_id);
CREATE INDEX idx_distributions_profile ON distributions(profile_id);

-- =============================================
-- Attendance rates view
-- =============================================
CREATE OR REPLACE VIEW attendance_rates AS
SELECT
  p.id AS profile_id,
  p.nickname,
  e.content_type,
  COUNT(*) AS total_events,
  COUNT(*) FILTER (WHERE a.status = 'present') AS present_count,
  COUNT(*) FILTER (WHERE a.status = 'afk') AS afk_count,
  COUNT(*) FILTER (WHERE a.status = 'absent') AS absent_count,
  ROUND(
    COUNT(*) FILTER (WHERE a.status = 'present')::NUMERIC
    / NULLIF(COUNT(*), 0) * 100, 1
  ) AS attendance_rate
FROM profiles p
JOIN attendances a ON a.profile_id = p.id
JOIN events e ON e.id = a.event_id
WHERE p.is_active = true
GROUP BY p.id, p.nickname, e.content_type;

-- =============================================
-- RLS Policies
-- =============================================
ALTER TABLE guilds ENABLE ROW LEVEL SECURITY;
ALTER TABLE alliances ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendances ENABLE ROW LEVEL SECURITY;
ALTER TABLE lotteries ENABLE ROW LEVEL SECURITY;
ALTER TABLE distributions ENABLE ROW LEVEL SECURITY;

-- Everyone can read (anon + authenticated)
CREATE POLICY "anon_read" ON guilds FOR SELECT USING (true);
CREATE POLICY "anon_read" ON alliances FOR SELECT USING (true);
CREATE POLICY "anon_read" ON profiles FOR SELECT USING (true);
CREATE POLICY "anon_read" ON admin_users FOR SELECT USING (true);
CREATE POLICY "anon_read" ON events FOR SELECT USING (true);
CREATE POLICY "anon_read" ON attendances FOR SELECT USING (true);
CREATE POLICY "anon_read" ON lotteries FOR SELECT USING (true);
CREATE POLICY "anon_read" ON distributions FOR SELECT USING (true);

-- Only authenticated (admin) can write
CREATE POLICY "admin_write" ON profiles
  FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

CREATE POLICY "admin_write" ON events
  FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

CREATE POLICY "admin_write" ON attendances
  FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

CREATE POLICY "admin_write" ON lotteries
  FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

CREATE POLICY "admin_write" ON distributions
  FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

CREATE POLICY "admin_write" ON guilds
  FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

CREATE POLICY "admin_write" ON alliances
  FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

-- Admin users table: only self can read own row, but select all is fine
CREATE POLICY "admin_write" ON admin_users
  FOR ALL TO authenticated
  USING (true) WITH CHECK (true);
