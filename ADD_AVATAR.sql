-- ============================================
-- ADD AVATAR/PROFILE PICTURE SUPPORT
-- Run this in Supabase SQL Editor
-- ============================================

-- Add avatar_url column to users table
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS avatar_url text;

-- ============================================
-- DONE! Run this once, then restart the app.
-- ============================================
