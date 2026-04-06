-- ============================================
-- QUICK FIX: Remove infinite recursion on users table
-- Run this in Supabase SQL Editor RIGHT NOW
-- ============================================

-- Drop ALL existing SELECT policies on users (they cause recursion)
DROP POLICY IF EXISTS "Users can view their own profile" ON public.users;
DROP POLICY IF EXISTS "Admins can view all users" ON public.users;
DROP POLICY IF EXISTS "Authenticated users can view all users" ON public.users;
DROP POLICY IF EXISTS "Anyone can view users" ON public.users;

-- Create ONE simple policy: all logged-in users can see all users
CREATE POLICY "Authenticated users can view all users"
  ON public.users FOR SELECT
  USING (auth.role() = 'authenticated');

-- Drop the recursive admin update policy
DROP POLICY IF EXISTS "Admins can update all users" ON public.users;

-- Make sure users can update their own profile
DROP POLICY IF EXISTS "Users can update their own profile" ON public.users;
CREATE POLICY "Users can update their own profile"
  ON public.users FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Make sure users can insert their own record
DROP POLICY IF EXISTS "Users can insert own record" ON public.users;
CREATE POLICY "Users can insert own record"
  ON public.users FOR INSERT
  WITH CHECK (auth.uid() = id);

-- ============================================
-- DONE! Recursion fixed.
-- ============================================
