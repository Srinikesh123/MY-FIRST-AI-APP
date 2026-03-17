-- ============================================
-- FIX ALL BROKEN POLICIES - Run this NOW
-- Fixes infinite recursion on users table
-- Does NOT drop any tables or data
-- ============================================

-- STEP 0: Drop broken function first, then add missing columns
DROP FUNCTION IF EXISTS public.is_admin(uuid) CASCADE;

-- Add missing columns to users table if they don't exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'invited_by') THEN
    ALTER TABLE public.users ADD COLUMN invited_by uuid;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'avatar') THEN
    ALTER TABLE public.users ADD COLUMN avatar text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'avatar_url') THEN
    ALTER TABLE public.users ADD COLUMN avatar_url text;
  END IF;
END $$;

-- Fix the referral signup trigger to handle missing invited_by gracefully
CREATE OR REPLACE FUNCTION public.handle_referral_signup()
RETURNS TRIGGER AS $$
DECLARE current_invites integer; new_plan text;
BEGIN
  IF NEW.invited_by IS NOT NULL THEN
    UPDATE public.users SET invites_count = invites_count + 1 WHERE id = NEW.invited_by;
    SELECT invites_count INTO current_invites FROM public.users WHERE id = NEW.invited_by;
    IF current_invites >= 10 THEN new_plan := 'ultra';
    ELSIF current_invites >= 3 THEN new_plan := 'pro';
    END IF;
    IF new_plan IS NOT NULL THEN
      UPDATE public.users SET plan = new_plan WHERE id = NEW.invited_by AND plan != new_plan;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Fix the new user trigger to also handle invited_by
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  referral_code text;
  inviter_id uuid;
BEGIN
  referral_code := NEW.raw_user_meta_data->>'referral_code';
  IF referral_code IS NOT NULL AND referral_code != '' THEN
    BEGIN
      SELECT user_id INTO inviter_id FROM public.referral_codes WHERE code = UPPER(referral_code);
    EXCEPTION WHEN OTHERS THEN
      inviter_id := NULL;
    END;
  END IF;

  INSERT INTO public.users (id, email, username, plan, coins, invited_by)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1)),
    'free',
    0,
    inviter_id
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    username = COALESCE(EXCLUDED.username, public.users.username);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- STEP 1: Create a safe is_admin function (SECURITY DEFINER bypasses RLS)
CREATE OR REPLACE FUNCTION public.is_admin(check_user_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT COALESCE(
    (SELECT is_admin FROM public.users WHERE id = check_user_id),
    false
  );
$$;

-- STEP 2: Drop ALL existing policies on users table
DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies WHERE tablename = 'users' AND schemaname = 'public'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.users', pol.policyname);
  END LOOP;
END $$;

-- STEP 3: Create clean users policies (NO self-referencing = NO recursion)
CREATE POLICY "All authenticated can view users"
  ON public.users FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Users can update self"
  ON public.users FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can insert self"
  ON public.users FOR INSERT
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Admins can update any user"
  ON public.users FOR UPDATE
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can delete users"
  ON public.users FOR DELETE
  USING (public.is_admin(auth.uid()));

-- STEP 4: Fix usage_limits policies (remove ones that query users table directly)
DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies WHERE tablename = 'usage_limits' AND schemaname = 'public'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.usage_limits', pol.policyname);
  END LOOP;
END $$;

CREATE POLICY "Users can view own usage"
  ON public.usage_limits FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own usage"
  ON public.usage_limits FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own usage"
  ON public.usage_limits FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all usage"
  ON public.usage_limits FOR SELECT
  USING (public.is_admin(auth.uid()));

-- STEP 5: Fix game_results policies
DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies WHERE tablename = 'game_results' AND schemaname = 'public'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.game_results', pol.policyname);
  END LOOP;
END $$;

CREATE POLICY "Users can view own results"
  ON public.game_results FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own results"
  ON public.game_results FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all results"
  ON public.game_results FOR SELECT
  USING (public.is_admin(auth.uid()));

-- STEP 6: Fix user_profiles admin policy if it exists
DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE tablename = 'user_profiles' AND schemaname = 'public'
    AND policyname ILIKE '%admin%'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.user_profiles', pol.policyname);
  END LOOP;
END $$;

-- Re-add safe admin policy for user_profiles
CREATE POLICY "Admins can view all profiles"
  ON public.user_profiles FOR SELECT
  USING (public.is_admin(auth.uid()));

-- STEP 7: Backfill any missing users from auth
INSERT INTO public.users (id, email, username, plan, coins)
SELECT
  id, email,
  COALESCE(raw_user_meta_data->>'name', raw_user_meta_data->>'username', split_part(email, '@', 1)),
  'free', 0
FROM auth.users
ON CONFLICT (id) DO UPDATE SET
  email = EXCLUDED.email,
  username = COALESCE(EXCLUDED.username, public.users.username);

-- STEP 8: Make sure usage_limits exist for all users
INSERT INTO public.usage_limits (user_id)
SELECT id FROM public.users
ON CONFLICT (user_id) DO NOTHING;

-- STEP 9: Set admin
UPDATE public.users SET is_admin = true
WHERE email = 'howtotutorialbysreenikesh@gmail.com';

-- STEP 10: Enable realtime for chat tables
DO $$
BEGIN
  -- Set REPLICA IDENTITY FULL for realtime
  BEGIN ALTER TABLE public.direct_messages REPLICA IDENTITY FULL; EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN ALTER TABLE public.group_messages REPLICA IDENTITY FULL; EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN ALTER TABLE public.direct_chats REPLICA IDENTITY FULL; EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN ALTER TABLE public.group_chats REPLICA IDENTITY FULL; EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN ALTER TABLE public.friends REPLICA IDENTITY FULL; EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN ALTER TABLE public.calls REPLICA IDENTITY FULL; EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN ALTER TABLE public.call_candidates REPLICA IDENTITY FULL; EXCEPTION WHEN OTHERS THEN NULL; END;

  -- Add to realtime publication
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'direct_messages') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.direct_messages;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'group_messages') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.group_messages;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'direct_chats') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.direct_chats;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'group_chats') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.group_chats;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'friends') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.friends;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'calls') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.calls;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'call_candidates') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.call_candidates;
  END IF;
END $$;

-- ============================================
-- DONE! Infinite recursion fixed.
-- No tables dropped, no data lost.
-- ============================================
