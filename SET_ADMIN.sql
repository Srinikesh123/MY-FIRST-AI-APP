-- ============================================
-- Set your account as admin
-- Run this in Supabase SQL Editor
-- ============================================

UPDATE public.users
SET is_admin = true
WHERE email = 'howtotutorialbysrinikesh@gmail.com';

-- Verify it worked:
SELECT id, email, is_admin FROM public.users WHERE email = 'howtotutorialbysrinikesh@gmail.com';
