-- ============================================
-- FIX: Infinite Recursion in RLS Policies
-- ============================================
-- This fixes the "infinite recursion detected in policy for relation 'users'" error
-- Run this SQL in your Supabase SQL Editor
-- (Dashboard → SQL Editor → New Query → Paste this → Run)

-- ============================================
-- Step 1: Create SECURITY DEFINER function to check admin status
-- This function bypasses RLS, preventing infinite recursion
-- ============================================
CREATE OR REPLACE FUNCTION public.is_admin(user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  admin_status boolean;
BEGIN
  SELECT is_admin INTO admin_status
  FROM public.users
  WHERE id = user_id;
  
  RETURN COALESCE(admin_status, false);
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.is_admin(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin(uuid) TO anon;

-- ============================================
-- Step 2: Fix users table policies
-- ============================================

-- Drop the problematic admin policies
DROP POLICY IF EXISTS "Admins can view all users" ON public.users;
DROP POLICY IF EXISTS "Admins can update all users" ON public.users;

-- Create new admin policies using the function (no recursion!)
CREATE POLICY "Admins can view all users"
  ON public.users FOR SELECT
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can update all users"
  ON public.users FOR UPDATE
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- ============================================
-- Step 3: Fix usage_limits table policies
-- ============================================

DROP POLICY IF EXISTS "Admins can view all usage" ON public.usage_limits;

CREATE POLICY "Admins can view all usage"
  ON public.usage_limits FOR SELECT
  USING (public.is_admin(auth.uid()));

-- ============================================
-- Step 4: Fix game_results table policies
-- ============================================

DROP POLICY IF EXISTS "Admins can view all game results" ON public.game_results;

CREATE POLICY "Admins can view all game results"
  ON public.game_results FOR SELECT
  USING (public.is_admin(auth.uid()));

-- ============================================
-- Step 5: Verify the fix
-- ============================================
-- After running this, try querying the users table again
-- The infinite recursion error should be resolved

