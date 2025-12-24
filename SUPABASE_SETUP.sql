-- ============================================
-- SUPABASE DATABASE SETUP FOR VOIDZENZI AI ASSISTANT
-- COMPLETE SCHEMA WITH PLANS, TOKENS, GAMES, ADMIN
-- ============================================
-- Run this SQL in your Supabase SQL Editor
-- (Dashboard → SQL Editor → New Query → Paste this → Run)

-- ============================================
-- 1. USERS TABLE (Custom table - REQUIRED)
-- ============================================
CREATE TABLE IF NOT EXISTS public.users (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  username text,
  plan text NOT NULL DEFAULT 'free' CHECK (plan IN ('free', 'pro', 'ultra')),
  invites_count integer NOT NULL DEFAULT 0,
  invited_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  coins integer NOT NULL DEFAULT 0,
  is_admin boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(email);
CREATE INDEX IF NOT EXISTS idx_users_plan ON public.users(plan);

-- Enable RLS
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Policies for users
DROP POLICY IF EXISTS "Users can view their own profile" ON public.users;
CREATE POLICY "Users can view their own profile"
  ON public.users FOR SELECT
  USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update their own profile" ON public.users;
CREATE POLICY "Users can update their own profile"
  ON public.users FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Admin can view all users
DROP POLICY IF EXISTS "Admins can view all users" ON public.users;
CREATE POLICY "Admins can view all users"
  ON public.users FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND is_admin = true
    )
  );

-- Admin can update all users
DROP POLICY IF EXISTS "Admins can update all users" ON public.users;
CREATE POLICY "Admins can update all users"
  ON public.users FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND is_admin = true
    )
  );

-- Function to create user record on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  referral_code text;
  inviter_id uuid;
BEGIN
  -- Check for referral code in metadata
  referral_code := NEW.raw_user_meta_data->>'referral_code';
  
  -- Find inviter if referral code provided
  IF referral_code IS NOT NULL THEN
    SELECT user_id INTO inviter_id
    FROM public.referral_codes
    WHERE code = UPPER(referral_code);
  END IF;
  
  INSERT INTO public.users (id, email, username, plan, invites_count, invited_by, coins)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'username', NEW.email),
    'free',
    0,
    inviter_id,
    0
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create user on signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================
-- 2. USER SETTINGS TABLE (JSONB for future-proof storage)
-- ============================================
CREATE TABLE IF NOT EXISTS public.user_settings (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;

-- Policies for user_settings
DROP POLICY IF EXISTS "Users can view their own settings" ON public.user_settings;
CREATE POLICY "Users can view their own settings"
  ON public.user_settings FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own settings" ON public.user_settings;
CREATE POLICY "Users can insert their own settings"
  ON public.user_settings FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own settings" ON public.user_settings;
CREATE POLICY "Users can update their own settings"
  ON public.user_settings FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ============================================
-- 3. CHATS TABLE (one row per chat)
-- ============================================
CREATE TABLE IF NOT EXISTS public.chats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes for chats
CREATE INDEX IF NOT EXISTS idx_chats_user_id ON public.chats(user_id);
CREATE INDEX IF NOT EXISTS idx_chats_updated_at ON public.chats(updated_at DESC);

-- Enable RLS
ALTER TABLE public.chats ENABLE ROW LEVEL SECURITY;

-- Policies for chats
DROP POLICY IF EXISTS "Users can view their own chats" ON public.chats;
CREATE POLICY "Users can view their own chats"
  ON public.chats FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own chats" ON public.chats;
CREATE POLICY "Users can insert their own chats"
  ON public.chats FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own chats" ON public.chats;
CREATE POLICY "Users can update their own chats"
  ON public.chats FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own chats" ON public.chats;
CREATE POLICY "Users can delete their own chats"
  ON public.chats FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================
-- 4. MESSAGES TABLE (one row per message)
-- CRITICAL: Must filter by BOTH user_id AND chat_id
-- ============================================
CREATE TABLE IF NOT EXISTS public.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  chat_id uuid NOT NULL REFERENCES public.chats(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('user', 'assistant')),
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes for messages (CRITICAL for performance)
CREATE INDEX IF NOT EXISTS idx_messages_user_id ON public.messages(user_id);
CREATE INDEX IF NOT EXISTS idx_messages_chat_id ON public.messages(chat_id);
CREATE INDEX IF NOT EXISTS idx_messages_user_chat ON public.messages(user_id, chat_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON public.messages(created_at);

-- Enable RLS
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- Policies for messages (CRITICAL: Must check BOTH user_id AND chat ownership)
DROP POLICY IF EXISTS "Users can view their own messages" ON public.messages;
CREATE POLICY "Users can view their own messages"
  ON public.messages FOR SELECT
  USING (
    auth.uid() = user_id AND
    EXISTS (
      SELECT 1 FROM public.chats
      WHERE chats.id = messages.chat_id AND chats.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can insert their own messages" ON public.messages;
CREATE POLICY "Users can insert their own messages"
  ON public.messages FOR INSERT
  WITH CHECK (
    auth.uid() = user_id AND
    EXISTS (
      SELECT 1 FROM public.chats
      WHERE chats.id = messages.chat_id AND chats.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can update their own messages" ON public.messages;
CREATE POLICY "Users can update their own messages"
  ON public.messages FOR UPDATE
  USING (
    auth.uid() = user_id AND
    EXISTS (
      SELECT 1 FROM public.chats
      WHERE chats.id = messages.chat_id AND chats.user_id = auth.uid()
    )
  )
  WITH CHECK (
    auth.uid() = user_id AND
    EXISTS (
      SELECT 1 FROM public.chats
      WHERE chats.id = messages.chat_id AND chats.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can delete their own messages" ON public.messages;
CREATE POLICY "Users can delete their own messages"
  ON public.messages FOR DELETE
  USING (
    auth.uid() = user_id AND
    EXISTS (
      SELECT 1 FROM public.chats
      WHERE chats.id = messages.chat_id AND chats.user_id = auth.uid()
    )
  );

-- ============================================
-- 5. USAGE LIMITS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.usage_limits (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  messages_used integer NOT NULL DEFAULT 0,
  images_used integer NOT NULL DEFAULT 0,
  code_generations_used integer NOT NULL DEFAULT 0,
  reset_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.usage_limits ENABLE ROW LEVEL SECURITY;

-- Policies for usage_limits
DROP POLICY IF EXISTS "Users can view their own usage" ON public.usage_limits;
CREATE POLICY "Users can view their own usage"
  ON public.usage_limits FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own usage" ON public.usage_limits;
CREATE POLICY "Users can update their own usage"
  ON public.usage_limits FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Admin can view all usage
DROP POLICY IF EXISTS "Admins can view all usage" ON public.usage_limits;
CREATE POLICY "Admins can view all usage"
  ON public.usage_limits FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND is_admin = true
    )
  );

-- Function to initialize usage limits
CREATE OR REPLACE FUNCTION public.init_usage_limits()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.usage_limits (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create usage limits on user creation
DROP TRIGGER IF EXISTS on_user_created_usage ON public.users;
CREATE TRIGGER on_user_created_usage
  AFTER INSERT ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.init_usage_limits();

-- ============================================
-- 6. GAMES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.games (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  reward_coins integer NOT NULL DEFAULT 10,
  reward_tokens integer DEFAULT 0,
  description text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Insert default games
INSERT INTO public.games (name, reward_coins, reward_tokens, description) VALUES
  ('Bounce Game', 10, 0, 'Bounce the ball and score points'),
  ('Click Speed', 15, 0, 'Click as fast as you can'),
  ('Memory Tiles', 20, 0, 'Match the tiles'),
  ('Reaction Test', 12, 0, 'Test your reaction time'),
  ('Number Guess', 18, 0, 'Guess the number'),
  ('Word Puzzle', 25, 5, 'Solve word puzzles')
ON CONFLICT (name) DO NOTHING;

-- Enable RLS
ALTER TABLE public.games ENABLE ROW LEVEL SECURITY;

-- Everyone can view games
DROP POLICY IF EXISTS "Everyone can view games" ON public.games;
CREATE POLICY "Everyone can view games"
  ON public.games FOR SELECT
  USING (true);

-- ============================================
-- 7. GAME RESULTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.game_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  game_id uuid NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
  won boolean NOT NULL,
  coins_earned integer NOT NULL DEFAULT 0,
  tokens_earned integer NOT NULL DEFAULT 0,
  score integer,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_game_results_user_id ON public.game_results(user_id);
CREATE INDEX IF NOT EXISTS idx_game_results_game_id ON public.game_results(game_id);
CREATE INDEX IF NOT EXISTS idx_game_results_created_at ON public.game_results(created_at);

-- Enable RLS
ALTER TABLE public.game_results ENABLE ROW LEVEL SECURITY;

-- Policies for game_results
DROP POLICY IF EXISTS "Users can view their own game results" ON public.game_results;
CREATE POLICY "Users can view their own game results"
  ON public.game_results FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own game results" ON public.game_results;
CREATE POLICY "Users can insert their own game results"
  ON public.game_results FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Admin can view all game results
DROP POLICY IF EXISTS "Admins can view all game results" ON public.game_results;
CREATE POLICY "Admins can view all game results"
  ON public.game_results FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND is_admin = true
    )
  );

-- ============================================
-- 8. MEMORIES TABLE (optional long-term memory)
-- ============================================
CREATE TABLE IF NOT EXISTS public.memories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  chat_id uuid REFERENCES public.chats(id) ON DELETE CASCADE,
  memory_type text NOT NULL CHECK (memory_type IN ('short_term', 'long_term')),
  content text NOT NULL,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes for memories
CREATE INDEX IF NOT EXISTS idx_memories_user_id ON public.memories(user_id);
CREATE INDEX IF NOT EXISTS idx_memories_chat_id ON public.memories(chat_id);
CREATE INDEX IF NOT EXISTS idx_memories_type ON public.memories(memory_type);

-- Enable RLS
ALTER TABLE public.memories ENABLE ROW LEVEL SECURITY;

-- Policies for memories
DROP POLICY IF EXISTS "Users can view their own memories" ON public.memories;
CREATE POLICY "Users can view their own memories"
  ON public.memories FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own memories" ON public.memories;
CREATE POLICY "Users can insert their own memories"
  ON public.memories FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own memories" ON public.memories;
CREATE POLICY "Users can update their own memories"
  ON public.memories FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own memories" ON public.memories;
CREATE POLICY "Users can delete their own memories"
  ON public.memories FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================
-- 9. FILES TABLE (for uploads metadata)
-- ============================================
CREATE TABLE IF NOT EXISTS public.files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  chat_id uuid REFERENCES public.chats(id) ON DELETE CASCADE,
  filename text NOT NULL,
  file_url text NOT NULL,
  file_type text,
  file_size bigint,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes for files
CREATE INDEX IF NOT EXISTS idx_files_user_id ON public.files(user_id);
CREATE INDEX IF NOT EXISTS idx_files_chat_id ON public.files(chat_id);

-- Enable RLS
ALTER TABLE public.files ENABLE ROW LEVEL SECURITY;

-- Policies for files
DROP POLICY IF EXISTS "Users can view their own files" ON public.files;
CREATE POLICY "Users can view their own files"
  ON public.files FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own files" ON public.files;
CREATE POLICY "Users can insert their own files"
  ON public.files FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own files" ON public.files;
CREATE POLICY "Users can delete their own files"
  ON public.files FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================
-- 10. FUNCTIONS: Auto-update updated_at timestamp
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for updated_at
CREATE TRIGGER update_chats_updated_at BEFORE UPDATE ON public.chats
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_settings_updated_at BEFORE UPDATE ON public.user_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_usage_limits_updated_at BEFORE UPDATE ON public.usage_limits
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 11. FUNCTION: Award coins and tokens from game wins
-- ============================================
CREATE OR REPLACE FUNCTION public.award_game_rewards()
RETURNS TRIGGER AS $$
DECLARE
  game_reward_coins integer;
  game_reward_tokens integer;
BEGIN
  IF NEW.won = true THEN
    -- Get game rewards
    SELECT reward_coins, COALESCE(reward_tokens, 0)
    INTO game_reward_coins, game_reward_tokens
    FROM public.games
    WHERE id = NEW.game_id;

    -- Update user coins
    UPDATE public.users
    SET coins = coins + COALESCE(game_reward_coins, 0)
    WHERE id = NEW.user_id;

    -- Update user tokens if any
    IF game_reward_tokens > 0 THEN
      UPDATE public.users
      SET tokens_remaining = tokens_remaining + game_reward_tokens
      WHERE id = NEW.user_id;
    END IF;

    -- Update game result with actual rewards
    NEW.coins_earned = COALESCE(game_reward_coins, 0);
    NEW.tokens_earned = COALESCE(game_reward_tokens, 0);
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to award rewards on game win
DROP TRIGGER IF EXISTS on_game_result_won ON public.game_results;
CREATE TRIGGER on_game_result_won
  BEFORE INSERT ON public.game_results
  FOR EACH ROW EXECUTE FUNCTION public.award_game_rewards();

-- ============================================
-- 12. REFERRAL CODES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.referral_codes (
  code text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_referral_codes_user_id ON public.referral_codes(user_id);

-- Enable RLS
ALTER TABLE public.referral_codes ENABLE ROW LEVEL SECURITY;

-- Policies for referral_codes
DROP POLICY IF EXISTS "Users can view their own referral code" ON public.referral_codes;
CREATE POLICY "Users can view their own referral code"
  ON public.referral_codes FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Everyone can check referral codes" ON public.referral_codes;
CREATE POLICY "Everyone can check referral codes"
  ON public.referral_codes FOR SELECT
  USING (true);

-- Function to generate referral code on user creation
CREATE OR REPLACE FUNCTION public.generate_referral_code()
RETURNS TRIGGER AS $$
DECLARE
  ref_code text;
BEGIN
  -- Generate unique referral code (8 characters)
  ref_code := UPPER(SUBSTRING(MD5(RANDOM()::text || NEW.id::text) FROM 1 FOR 8));
  
  -- Ensure uniqueness
  WHILE EXISTS (SELECT 1 FROM public.referral_codes WHERE code = ref_code) LOOP
    ref_code := UPPER(SUBSTRING(MD5(RANDOM()::text || NEW.id::text || NOW()::text) FROM 1 FOR 8));
  END LOOP;
  
  INSERT INTO public.referral_codes (code, user_id)
  VALUES (ref_code, NEW.id);
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create referral code on user creation
DROP TRIGGER IF EXISTS on_user_created_referral ON public.users;
CREATE TRIGGER on_user_created_referral
  AFTER INSERT ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.generate_referral_code();

-- Function to handle referral signup
CREATE OR REPLACE FUNCTION public.handle_referral_signup()
RETURNS TRIGGER AS $$
DECLARE
  inviter_id uuid;
  current_invites integer;
  new_plan text;
BEGIN
  -- Check if user was invited
  IF NEW.invited_by IS NOT NULL THEN
    -- Get inviter's current invite count
    SELECT invites_count INTO current_invites
    FROM public.users
    WHERE id = NEW.invited_by;
    
    -- Increment inviter's invite count
    UPDATE public.users
    SET invites_count = COALESCE(current_invites, 0) + 1
    WHERE id = NEW.invited_by;
    
    -- Check if inviter should be upgraded
    SELECT invites_count + 1 INTO current_invites
    FROM public.users
    WHERE id = NEW.invited_by;
    
    -- Auto-upgrade based on invites
    IF current_invites >= 10 THEN
      new_plan := 'ultra';
    ELSIF current_invites >= 3 THEN
      new_plan := 'pro';
    END IF;
    
    -- Update inviter's plan if needed
    IF new_plan IS NOT NULL THEN
      UPDATE public.users
      SET plan = new_plan
      WHERE id = NEW.invited_by AND plan != new_plan;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to handle referral on user creation
DROP TRIGGER IF EXISTS on_user_referral_handled ON public.users;
CREATE TRIGGER on_user_referral_handled
  AFTER INSERT ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_referral_signup();

-- ============================================
-- 13. SET ADMIN USER
-- ============================================
-- IMPORTANT: Run this AFTER creating your account
-- Replace 'howtotutorialbysreenikesh@gmail.com' with your actual email
UPDATE public.users
SET is_admin = true
WHERE email = 'howtotutorialbysreenikesh@gmail.com';

-- ============================================
-- IMPORTANT: DISABLE EMAIL CONFIRMATION
-- ============================================
-- Go to: Dashboard → Authentication → Providers → Email
-- Turn OFF "Confirm email" to allow instant login without email verification

-- ============================================
-- ENABLE REALTIME (if not already enabled)
-- ============================================
-- Go to: Dashboard → Database → Replication
-- Enable replication for: chats, messages, user_settings, memories, users, game_results
