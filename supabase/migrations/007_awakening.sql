-- Add awakening field to profiles
ALTER TABLE profiles ADD COLUMN is_awakened BOOLEAN DEFAULT false;
