-- Item categories for grouping items
CREATE TABLE item_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guild_id UUID NOT NULL REFERENCES guilds(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE item_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_read" ON item_categories FOR SELECT USING (true);
CREATE POLICY "admin_write" ON item_categories
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE INDEX idx_item_categories_guild ON item_categories(guild_id);

-- Add category_id to item_registry
ALTER TABLE item_registry ADD COLUMN category_id UUID
  REFERENCES item_categories(id) ON DELETE SET NULL;

-- Default categories seed
INSERT INTO item_categories (guild_id, name, sort_order) VALUES
('00000000-0000-0000-0000-000000000001', '제작재료', 1),
('00000000-0000-0000-0000-000000000001', '상자', 2),
('00000000-0000-0000-0000-000000000001', '장비', 3),
('00000000-0000-0000-0000-000000000001', '소비아이템', 4),
('00000000-0000-0000-0000-000000000001', '기타', 5);
