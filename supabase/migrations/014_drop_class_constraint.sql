-- Drop the hardcoded CHECK on profiles.character_class.
-- After 011 introduced the character_classes table, this constraint
-- blocks any newly-added class codes (cls_xxxxxxxx etc).

ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_character_class_check;
