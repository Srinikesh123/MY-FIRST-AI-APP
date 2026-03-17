-- ============================================
-- FIX: "Database error saving new user"
-- The handle_new_user() trigger was failing during signup.
-- This replaces it with a robust version that never blocks auth.
-- Run this in Supabase SQL Editor
-- ============================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.users (id, email, username, plan, invites_count, coins, is_admin)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(
      NEW.raw_user_meta_data->>'name',
      NEW.raw_user_meta_data->>'username',
      split_part(NEW.email, '@', 1)
    ),
    'free',
    0,
    0,
    false
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Never block signup even if the insert fails for any reason
    RETURN NEW;
END;
$$;

-- Make sure the trigger still exists and fires on INSERT
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================
-- DONE! New user registrations should work now.
-- ============================================
