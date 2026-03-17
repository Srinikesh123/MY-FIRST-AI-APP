-- ============================================
-- FIX: Infinite recursion in group_members RLS
-- Run this in Supabase SQL Editor
-- ============================================

-- Create a SECURITY DEFINER function so the membership check
-- runs as the DB owner (bypasses RLS), breaking the recursion.
CREATE OR REPLACE FUNCTION public.check_group_member(gid uuid, uid uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.group_members
    WHERE group_id = gid AND user_id = uid
  );
$$;

-- Fix group_chats SELECT policy — uses the function instead of a subquery
DROP POLICY IF EXISTS "Group members can view groups" ON public.group_chats;
CREATE POLICY "Group members can view groups" ON public.group_chats
  FOR SELECT USING (
    auth.uid() = creator_id OR
    public.check_group_member(id, auth.uid())
  );

-- Fix group_members SELECT policy — uses the function, no self-reference
DROP POLICY IF EXISTS "Members can view group members" ON public.group_members;
CREATE POLICY "Members can view group members" ON public.group_members
  FOR SELECT USING (
    auth.uid() = user_id OR
    public.check_group_member(group_id, auth.uid())
  );

-- ============================================
-- DONE! Group creation should now work.
-- ============================================
