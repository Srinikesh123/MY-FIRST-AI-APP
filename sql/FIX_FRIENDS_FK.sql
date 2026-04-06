-- ============================================
-- FIX: "insert or update on table 'friends' violates foreign key constraint 'friends_user_id_fkey'"
--
-- The friends table FK points to public.users, but some users only
-- exist in auth.users (trigger failed at signup). Changing the FK to
-- reference auth.users fixes this without losing any data.
--
-- Run this in Supabase SQL Editor
-- ============================================

-- Drop the old foreign key constraints
ALTER TABLE public.friends DROP CONSTRAINT IF EXISTS friends_user_id_fkey;
ALTER TABLE public.friends DROP CONSTRAINT IF EXISTS friends_friend_id_fkey;

-- Re-add them pointing to auth.users instead of public.users
ALTER TABLE public.friends
  ADD CONSTRAINT friends_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.friends
  ADD CONSTRAINT friends_friend_id_fkey
  FOREIGN KEY (friend_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- ============================================
-- DONE! Friend requests should work now.
-- Also run FIX_NEW_USER_TRIGGER.sql so new
-- signups create their public.users row properly.
-- ============================================
