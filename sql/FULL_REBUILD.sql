-- ============================================
-- FULL DATABASE REBUILD FOR VOIDZENZI
-- Run this ONCE in Supabase SQL Editor to fix everything
-- This is SAFE: uses CREATE TABLE IF NOT EXISTS
-- ============================================

-- ============================================
-- 1. USERS TABLE
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

CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(email);
CREATE INDEX IF NOT EXISTS idx_users_plan ON public.users(plan);
CREATE INDEX IF NOT EXISTS idx_users_username ON public.users(username);

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Users RLS policies (NO self-referencing queries to avoid infinite recursion)

-- All authenticated users can see all users (needed for friend search, DMs, etc.)
DROP POLICY IF EXISTS "Users can view their own profile" ON public.users;
DROP POLICY IF EXISTS "Admins can view all users" ON public.users;
DROP POLICY IF EXISTS "Authenticated users can view all users" ON public.users;
CREATE POLICY "Authenticated users can view all users"
  ON public.users FOR SELECT USING (auth.role() = 'authenticated');

-- Users can update their own profile
DROP POLICY IF EXISTS "Users can update their own profile" ON public.users;
CREATE POLICY "Users can update their own profile"
  ON public.users FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- Admin updates handled via service role on server, no self-referencing policy needed
DROP POLICY IF EXISTS "Admins can update all users" ON public.users;

-- Allow inserting own user record
DROP POLICY IF EXISTS "Users can insert own record" ON public.users;
CREATE POLICY "Users can insert own record"
  ON public.users FOR INSERT WITH CHECK (auth.uid() = id);

-- Auto-create user on signup trigger
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  referral_code text;
  inviter_id uuid;
BEGIN
  referral_code := NEW.raw_user_meta_data->>'referral_code';
  IF referral_code IS NOT NULL THEN
    SELECT user_id INTO inviter_id FROM public.referral_codes WHERE code = UPPER(referral_code);
  END IF;

  INSERT INTO public.users (id, email, username, plan, invites_count, invited_by, coins)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1)),
    'free',
    0,
    inviter_id,
    0
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

-- Backfill existing auth users into public.users
INSERT INTO public.users (id, email, username, plan, coins)
SELECT
  id,
  email,
  COALESCE(raw_user_meta_data->>'name', raw_user_meta_data->>'username', split_part(email, '@', 1)),
  'free',
  0
FROM auth.users
ON CONFLICT (id) DO UPDATE SET
  email = EXCLUDED.email,
  username = COALESCE(EXCLUDED.username, public.users.username);

-- ============================================
-- 2. USER SETTINGS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.user_settings (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own settings" ON public.user_settings;
CREATE POLICY "Users can view their own settings"
  ON public.user_settings FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own settings" ON public.user_settings;
CREATE POLICY "Users can insert their own settings"
  ON public.user_settings FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own settings" ON public.user_settings;
CREATE POLICY "Users can update their own settings"
  ON public.user_settings FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ============================================
-- 3. CHATS TABLE (AI conversations)
-- ============================================
CREATE TABLE IF NOT EXISTS public.chats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_chats_user_id ON public.chats(user_id);
CREATE INDEX IF NOT EXISTS idx_chats_updated_at ON public.chats(updated_at DESC);

ALTER TABLE public.chats ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own chats" ON public.chats;
CREATE POLICY "Users can view their own chats"
  ON public.chats FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own chats" ON public.chats;
CREATE POLICY "Users can insert their own chats"
  ON public.chats FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own chats" ON public.chats;
CREATE POLICY "Users can update their own chats"
  ON public.chats FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own chats" ON public.chats;
CREATE POLICY "Users can delete their own chats"
  ON public.chats FOR DELETE USING (auth.uid() = user_id);

-- ============================================
-- 4. MESSAGES TABLE (AI conversation messages)
-- ============================================
CREATE TABLE IF NOT EXISTS public.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  chat_id uuid NOT NULL REFERENCES public.chats(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('user', 'assistant')),
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_messages_user_id ON public.messages(user_id);
CREATE INDEX IF NOT EXISTS idx_messages_chat_id ON public.messages(chat_id);
CREATE INDEX IF NOT EXISTS idx_messages_user_chat ON public.messages(user_id, chat_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON public.messages(created_at);

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own messages" ON public.messages;
CREATE POLICY "Users can view their own messages"
  ON public.messages FOR SELECT
  USING (auth.uid() = user_id AND EXISTS (SELECT 1 FROM public.chats WHERE chats.id = messages.chat_id AND chats.user_id = auth.uid()));

DROP POLICY IF EXISTS "Users can insert their own messages" ON public.messages;
CREATE POLICY "Users can insert their own messages"
  ON public.messages FOR INSERT
  WITH CHECK (auth.uid() = user_id AND EXISTS (SELECT 1 FROM public.chats WHERE chats.id = messages.chat_id AND chats.user_id = auth.uid()));

DROP POLICY IF EXISTS "Users can update their own messages" ON public.messages;
CREATE POLICY "Users can update their own messages"
  ON public.messages FOR UPDATE
  USING (auth.uid() = user_id AND EXISTS (SELECT 1 FROM public.chats WHERE chats.id = messages.chat_id AND chats.user_id = auth.uid()))
  WITH CHECK (auth.uid() = user_id AND EXISTS (SELECT 1 FROM public.chats WHERE chats.id = messages.chat_id AND chats.user_id = auth.uid()));

DROP POLICY IF EXISTS "Users can delete their own messages" ON public.messages;
CREATE POLICY "Users can delete their own messages"
  ON public.messages FOR DELETE
  USING (auth.uid() = user_id AND EXISTS (SELECT 1 FROM public.chats WHERE chats.id = messages.chat_id AND chats.user_id = auth.uid()));

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

ALTER TABLE public.usage_limits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own usage" ON public.usage_limits;
CREATE POLICY "Users can view their own usage"
  ON public.usage_limits FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own usage" ON public.usage_limits;
CREATE POLICY "Users can update their own usage"
  ON public.usage_limits FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own usage" ON public.usage_limits;
CREATE POLICY "Users can insert their own usage"
  ON public.usage_limits FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can view all usage" ON public.usage_limits;
CREATE POLICY "Admins can view all usage"
  ON public.usage_limits FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND is_admin = true));

-- Init usage limits trigger
CREATE OR REPLACE FUNCTION public.init_usage_limits()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.usage_limits (user_id) VALUES (NEW.id) ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_user_created_usage ON public.users;
CREATE TRIGGER on_user_created_usage
  AFTER INSERT ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.init_usage_limits();

-- Backfill usage limits for existing users
INSERT INTO public.usage_limits (user_id)
SELECT id FROM public.users
ON CONFLICT (user_id) DO NOTHING;

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

INSERT INTO public.games (name, reward_coins, reward_tokens, description) VALUES
  ('Bounce Game', 10, 0, 'Bounce the ball and score points'),
  ('Click Speed', 15, 0, 'Click as fast as you can'),
  ('Memory Tiles', 20, 0, 'Match the tiles'),
  ('Reaction Test', 12, 0, 'Test your reaction time'),
  ('Number Guess', 18, 0, 'Guess the number'),
  ('Word Puzzle', 25, 5, 'Solve word puzzles')
ON CONFLICT (name) DO NOTHING;

ALTER TABLE public.games ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Everyone can view games" ON public.games;
CREATE POLICY "Everyone can view games"
  ON public.games FOR SELECT USING (true);

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

CREATE INDEX IF NOT EXISTS idx_game_results_user_id ON public.game_results(user_id);
CREATE INDEX IF NOT EXISTS idx_game_results_game_id ON public.game_results(game_id);
CREATE INDEX IF NOT EXISTS idx_game_results_created_at ON public.game_results(created_at);

ALTER TABLE public.game_results ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own game results" ON public.game_results;
CREATE POLICY "Users can view their own game results"
  ON public.game_results FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own game results" ON public.game_results;
CREATE POLICY "Users can insert their own game results"
  ON public.game_results FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can view all game results" ON public.game_results;
CREATE POLICY "Admins can view all game results"
  ON public.game_results FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND is_admin = true));

-- Award coins on game win
CREATE OR REPLACE FUNCTION public.award_game_rewards()
RETURNS TRIGGER AS $$
DECLARE
  game_reward_coins integer;
  game_reward_tokens integer;
BEGIN
  IF NEW.won = true THEN
    SELECT reward_coins, COALESCE(reward_tokens, 0)
    INTO game_reward_coins, game_reward_tokens
    FROM public.games WHERE id = NEW.game_id;

    UPDATE public.users SET coins = coins + COALESCE(game_reward_coins, 0) WHERE id = NEW.user_id;
    NEW.coins_earned = COALESCE(game_reward_coins, 0);
    NEW.tokens_earned = COALESCE(game_reward_tokens, 0);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_game_result_won ON public.game_results;
CREATE TRIGGER on_game_result_won
  BEFORE INSERT ON public.game_results
  FOR EACH ROW EXECUTE FUNCTION public.award_game_rewards();

-- ============================================
-- 8. MEMORIES TABLE
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

CREATE INDEX IF NOT EXISTS idx_memories_user_id ON public.memories(user_id);
CREATE INDEX IF NOT EXISTS idx_memories_chat_id ON public.memories(chat_id);
CREATE INDEX IF NOT EXISTS idx_memories_type ON public.memories(memory_type);

ALTER TABLE public.memories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own memories" ON public.memories;
CREATE POLICY "Users can view their own memories"
  ON public.memories FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own memories" ON public.memories;
CREATE POLICY "Users can insert their own memories"
  ON public.memories FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own memories" ON public.memories;
CREATE POLICY "Users can update their own memories"
  ON public.memories FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own memories" ON public.memories;
CREATE POLICY "Users can delete their own memories"
  ON public.memories FOR DELETE USING (auth.uid() = user_id);

-- ============================================
-- 9. FILES TABLE
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

CREATE INDEX IF NOT EXISTS idx_files_user_id ON public.files(user_id);
CREATE INDEX IF NOT EXISTS idx_files_chat_id ON public.files(chat_id);

ALTER TABLE public.files ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own files" ON public.files;
CREATE POLICY "Users can view their own files"
  ON public.files FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own files" ON public.files;
CREATE POLICY "Users can insert their own files"
  ON public.files FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own files" ON public.files;
CREATE POLICY "Users can delete their own files"
  ON public.files FOR DELETE USING (auth.uid() = user_id);

-- ============================================
-- 10. REFERRAL CODES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.referral_codes (
  code text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_referral_codes_user_id ON public.referral_codes(user_id);

ALTER TABLE public.referral_codes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own referral code" ON public.referral_codes;
CREATE POLICY "Users can view their own referral code"
  ON public.referral_codes FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Everyone can check referral codes" ON public.referral_codes;
CREATE POLICY "Everyone can check referral codes"
  ON public.referral_codes FOR SELECT USING (true);

-- Generate referral code on user creation
CREATE OR REPLACE FUNCTION public.generate_referral_code()
RETURNS TRIGGER AS $$
DECLARE ref_code text;
BEGIN
  ref_code := UPPER(SUBSTRING(MD5(RANDOM()::text || NEW.id::text) FROM 1 FOR 8));
  WHILE EXISTS (SELECT 1 FROM public.referral_codes WHERE code = ref_code) LOOP
    ref_code := UPPER(SUBSTRING(MD5(RANDOM()::text || NEW.id::text || NOW()::text) FROM 1 FOR 8));
  END LOOP;
  INSERT INTO public.referral_codes (code, user_id) VALUES (ref_code, NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_user_created_referral ON public.users;
CREATE TRIGGER on_user_created_referral
  AFTER INSERT ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.generate_referral_code();

-- Handle referral signup
CREATE OR REPLACE FUNCTION public.handle_referral_signup()
RETURNS TRIGGER AS $$
DECLARE current_invites integer; new_plan text;
BEGIN
  IF NEW.invited_by IS NOT NULL THEN
    SELECT invites_count INTO current_invites FROM public.users WHERE id = NEW.invited_by;
    UPDATE public.users SET invites_count = COALESCE(current_invites, 0) + 1 WHERE id = NEW.invited_by;
    SELECT invites_count + 1 INTO current_invites FROM public.users WHERE id = NEW.invited_by;
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

DROP TRIGGER IF EXISTS on_user_referral_handled ON public.users;
CREATE TRIGGER on_user_referral_handled
  AFTER INSERT ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_referral_signup();

-- ============================================
-- 11. USER CONTEXT TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.user_context (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  display_name text,
  bio text,
  response_style text DEFAULT 'balanced' CHECK (response_style IN ('short', 'balanced', 'detailed', 'casual', 'formal', 'gamer', 'technical')),
  personality_traits jsonb DEFAULT '[]'::jsonb,
  interests jsonb DEFAULT '[]'::jsonb,
  profession text,
  expertise_level text DEFAULT 'intermediate' CHECK (expertise_level IN ('beginner', 'intermediate', 'expert')),
  preferred_topics jsonb DEFAULT '[]'::jsonb,
  ai_personality_preference text DEFAULT 'friendly' CHECK (ai_personality_preference IN ('friendly', 'professional', 'casual', 'funny', 'serious')),
  communication_style text DEFAULT 'adaptive' CHECK (communication_style IN ('adaptive', 'direct', 'detailed', 'brief')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_context_user_id ON public.user_context(user_id);

ALTER TABLE public.user_context ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own context" ON public.user_context;
CREATE POLICY "Users can view their own context"
  ON public.user_context FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own context" ON public.user_context;
CREATE POLICY "Users can insert their own context"
  ON public.user_context FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own context" ON public.user_context;
CREATE POLICY "Users can update their own context"
  ON public.user_context FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ============================================
-- 12. USER PROFILES (memory system)
-- ============================================
CREATE TABLE IF NOT EXISTS public.user_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text, preferred_name text, bio text, job_title text, profession text,
  company text, industry text, expertise_level text,
  interests jsonb DEFAULT '[]', hobbies jsonb DEFAULT '[]', skills jsonb DEFAULT '[]',
  devices jsonb DEFAULT '[]', favorite_apps jsonb DEFAULT '[]',
  favorite_technologies jsonb DEFAULT '[]', operating_systems jsonb DEFAULT '[]',
  vehicles jsonb DEFAULT '[]', dream_vehicle text,
  favorite_sports jsonb DEFAULT '[]', favorite_teams jsonb DEFAULT '[]',
  fitness_activities jsonb DEFAULT '[]',
  favorite_movies jsonb DEFAULT '[]', favorite_music jsonb DEFAULT '[]',
  favorite_books jsonb DEFAULT '[]', favorite_games jsonb DEFAULT '[]',
  streaming_services jsonb DEFAULT '[]',
  news_interests jsonb DEFAULT '[]', information_sources jsonb DEFAULT '[]',
  favorite_places jsonb DEFAULT '[]', places_visited jsonb DEFAULT '[]',
  dream_destinations jsonb DEFAULT '[]',
  favorite_cuisines jsonb DEFAULT '[]', dietary_preferences jsonb DEFAULT '[]',
  favorite_restaurants jsonb DEFAULT '[]',
  favorite_brands jsonb DEFAULT '[]', shopping_preferences jsonb DEFAULT '[]',
  personality_style text, communication_preferences jsonb DEFAULT '[]',
  response_style text, daily_routine text,
  life_goals jsonb DEFAULT '[]', values jsonb DEFAULT '[]',
  preferred_topics jsonb DEFAULT '[]', disliked_topics jsonb DEFAULT '[]',
  ai_personality_preference text, ai_voice_preference text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_profiles_user_id ON public.user_profiles(user_id);

ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own profile data" ON public.user_profiles;
CREATE POLICY "Users can view their own profile data"
  ON public.user_profiles FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own profile data" ON public.user_profiles;
CREATE POLICY "Users can insert their own profile data"
  ON public.user_profiles FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own profile data" ON public.user_profiles;
CREATE POLICY "Users can update their own profile data"
  ON public.user_profiles FOR UPDATE USING (auth.uid() = user_id);

-- Service role access for server-side memory extraction
DROP POLICY IF EXISTS "Service can manage profiles" ON public.user_profiles;
CREATE POLICY "Service can manage profiles"
  ON public.user_profiles FOR ALL USING (true);

-- ============================================
-- 13. USER CUSTOM TERMS (memory system)
-- ============================================
CREATE TABLE IF NOT EXISTS public.user_custom_terms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  term text NOT NULL,
  meaning text,
  context text,
  category text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT unique_user_term UNIQUE (user_id, term)
);

ALTER TABLE public.user_custom_terms ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage their terms" ON public.user_custom_terms;
CREATE POLICY "Users can manage their terms" ON public.user_custom_terms FOR ALL USING (true);

-- ============================================
-- 14. USER RELATIONSHIPS (memory system)
-- ============================================
CREATE TABLE IF NOT EXISTS public.user_relationships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  person_name text NOT NULL,
  relationship_type text,
  relationship_description text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT unique_user_person UNIQUE (user_id, person_name)
);

ALTER TABLE public.user_relationships ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage their relationships" ON public.user_relationships;
CREATE POLICY "Users can manage their relationships" ON public.user_relationships FOR ALL USING (true);

-- ============================================
-- 15. USER PRIVATE FACTS (memory system)
-- ============================================
CREATE TABLE IF NOT EXISTS public.user_private_facts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  fact_type text,
  fact text NOT NULL,
  context text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.user_private_facts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage their facts" ON public.user_private_facts;
CREATE POLICY "Users can manage their facts" ON public.user_private_facts FOR ALL USING (true);

-- ============================================
-- 16. MEMORY EXTRACTION LOG
-- ============================================
CREATE TABLE IF NOT EXISTS public.memory_extraction_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  extraction_type text,
  source_message text,
  extracted_data jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.memory_extraction_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Service can manage extraction log" ON public.memory_extraction_log;
CREATE POLICY "Service can manage extraction log" ON public.memory_extraction_log FOR ALL USING (true);

-- ============================================
-- 17. FRIENDS TABLE (social)
-- ============================================
CREATE TABLE IF NOT EXISTS public.friends (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  friend_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'blocked')),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT different_friends CHECK (user_id != friend_id),
  CONSTRAINT unique_friend_pair UNIQUE (user_id, friend_id)
);

CREATE INDEX IF NOT EXISTS idx_friends_user ON public.friends(user_id);
CREATE INDEX IF NOT EXISTS idx_friends_friend ON public.friends(friend_id);
CREATE INDEX IF NOT EXISTS idx_friends_status ON public.friends(status);

ALTER TABLE public.friends ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their friendships" ON public.friends;
CREATE POLICY "Users can view their friendships"
  ON public.friends FOR SELECT USING (auth.uid() = user_id OR auth.uid() = friend_id);

DROP POLICY IF EXISTS "Users can send friend requests" ON public.friends;
CREATE POLICY "Users can send friend requests"
  ON public.friends FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update friend status" ON public.friends;
CREATE POLICY "Users can update friend status"
  ON public.friends FOR UPDATE USING (auth.uid() = user_id OR auth.uid() = friend_id);

DROP POLICY IF EXISTS "Users can remove friends" ON public.friends;
CREATE POLICY "Users can remove friends"
  ON public.friends FOR DELETE USING (auth.uid() = user_id OR auth.uid() = friend_id);

-- ============================================
-- 18. DIRECT CHATS (1-on-1 messaging)
-- ============================================
CREATE TABLE IF NOT EXISTS public.direct_chats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user1_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  user2_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  last_message text,
  last_message_at timestamptz DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT different_users CHECK (user1_id != user2_id),
  CONSTRAINT unique_chat_pair UNIQUE (user1_id, user2_id)
);

CREATE INDEX IF NOT EXISTS idx_dc_user1 ON public.direct_chats(user1_id);
CREATE INDEX IF NOT EXISTS idx_dc_user2 ON public.direct_chats(user2_id);

ALTER TABLE public.direct_chats ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their direct chats" ON public.direct_chats;
CREATE POLICY "Users can view their direct chats"
  ON public.direct_chats FOR SELECT USING (auth.uid() = user1_id OR auth.uid() = user2_id);

DROP POLICY IF EXISTS "Users can create direct chats" ON public.direct_chats;
CREATE POLICY "Users can create direct chats"
  ON public.direct_chats FOR INSERT WITH CHECK (auth.uid() = user1_id OR auth.uid() = user2_id);

DROP POLICY IF EXISTS "Users can update their direct chats" ON public.direct_chats;
CREATE POLICY "Users can update their direct chats"
  ON public.direct_chats FOR UPDATE USING (auth.uid() = user1_id OR auth.uid() = user2_id);

-- ============================================
-- 19. DIRECT MESSAGES
-- ============================================
CREATE TABLE IF NOT EXISTS public.direct_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id uuid NOT NULL REFERENCES public.direct_chats(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  content text,
  message_type text NOT NULL DEFAULT 'text' CHECK (message_type IN ('text', 'image', 'video', 'link', 'file')),
  media_url text,
  media_name text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_dm_chat ON public.direct_messages(chat_id);
CREATE INDEX IF NOT EXISTS idx_dm_sender ON public.direct_messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_dm_created ON public.direct_messages(created_at);

ALTER TABLE public.direct_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view direct messages" ON public.direct_messages;
CREATE POLICY "Users can view direct messages"
  ON public.direct_messages FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.direct_chats WHERE direct_chats.id = direct_messages.chat_id AND (direct_chats.user1_id = auth.uid() OR direct_chats.user2_id = auth.uid())));

DROP POLICY IF EXISTS "Users can send direct messages" ON public.direct_messages;
CREATE POLICY "Users can send direct messages"
  ON public.direct_messages FOR INSERT
  WITH CHECK (auth.uid() = sender_id AND EXISTS (SELECT 1 FROM public.direct_chats WHERE direct_chats.id = direct_messages.chat_id AND (direct_chats.user1_id = auth.uid() OR direct_chats.user2_id = auth.uid())));

-- ============================================
-- 20. GROUP CHATS
-- ============================================
CREATE TABLE IF NOT EXISTS public.group_chats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  creator_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  avatar_url text,
  last_message text,
  last_message_at timestamptz DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_gc_creator ON public.group_chats(creator_id);

-- ============================================
-- 21. GROUP MEMBERS (create BEFORE group_chats RLS)
-- ============================================
CREATE TABLE IF NOT EXISTS public.group_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.group_chats(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'member')),
  joined_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT unique_group_member UNIQUE (group_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_gm_group ON public.group_members(group_id);
CREATE INDEX IF NOT EXISTS idx_gm_user ON public.group_members(user_id);

-- Group chats RLS
ALTER TABLE public.group_chats ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Group members can view groups" ON public.group_chats;
CREATE POLICY "Group members can view groups"
  ON public.group_chats FOR SELECT
  USING (auth.uid() = creator_id OR EXISTS (SELECT 1 FROM public.group_members WHERE group_members.group_id = group_chats.id AND group_members.user_id = auth.uid()));

DROP POLICY IF EXISTS "Users can create groups" ON public.group_chats;
CREATE POLICY "Users can create groups"
  ON public.group_chats FOR INSERT WITH CHECK (auth.uid() = creator_id);

DROP POLICY IF EXISTS "Group admins can update" ON public.group_chats;
CREATE POLICY "Group admins can update"
  ON public.group_chats FOR UPDATE
  USING (auth.uid() = creator_id OR EXISTS (SELECT 1 FROM public.group_members WHERE group_members.group_id = group_chats.id AND group_members.user_id = auth.uid()));

-- Group members RLS
ALTER TABLE public.group_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members can view group members" ON public.group_members;
CREATE POLICY "Members can view group members"
  ON public.group_members FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.group_members gm WHERE gm.group_id = group_members.group_id AND gm.user_id = auth.uid()));

DROP POLICY IF EXISTS "Creator or self can add members" ON public.group_members;
CREATE POLICY "Creator or self can add members"
  ON public.group_members FOR INSERT
  WITH CHECK (auth.uid() = user_id OR EXISTS (SELECT 1 FROM public.group_chats WHERE group_chats.id = group_members.group_id AND group_chats.creator_id = auth.uid()));

DROP POLICY IF EXISTS "Admins or self can remove members" ON public.group_members;
CREATE POLICY "Admins or self can remove members"
  ON public.group_members FOR DELETE
  USING (auth.uid() = user_id OR EXISTS (SELECT 1 FROM public.group_members gm WHERE gm.group_id = group_members.group_id AND gm.user_id = auth.uid() AND gm.role = 'admin'));

DROP POLICY IF EXISTS "Admins can update member roles" ON public.group_members;
CREATE POLICY "Admins can update member roles"
  ON public.group_members FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.group_members gm WHERE gm.group_id = group_members.group_id AND gm.user_id = auth.uid() AND gm.role = 'admin'));

-- ============================================
-- 22. GROUP MESSAGES
-- ============================================
CREATE TABLE IF NOT EXISTS public.group_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.group_chats(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  content text,
  message_type text NOT NULL DEFAULT 'text' CHECK (message_type IN ('text', 'image', 'video', 'link', 'file')),
  media_url text,
  media_name text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_gm_msg_group ON public.group_messages(group_id);
CREATE INDEX IF NOT EXISTS idx_gm_msg_sender ON public.group_messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_gm_msg_created ON public.group_messages(created_at);

ALTER TABLE public.group_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Group members can view messages" ON public.group_messages;
CREATE POLICY "Group members can view messages"
  ON public.group_messages FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.group_members WHERE group_members.group_id = group_messages.group_id AND group_members.user_id = auth.uid()));

DROP POLICY IF EXISTS "Group members can send messages" ON public.group_messages;
CREATE POLICY "Group members can send messages"
  ON public.group_messages FOR INSERT
  WITH CHECK (auth.uid() = sender_id AND EXISTS (SELECT 1 FROM public.group_members WHERE group_members.group_id = group_messages.group_id AND group_members.user_id = auth.uid()));

-- ============================================
-- 23. CHAT MEDIA STORAGE BUCKET
-- ============================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('chat-media', 'chat-media', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Authenticated users can upload chat media" ON storage.objects;
CREATE POLICY "Authenticated users can upload chat media"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'chat-media' AND auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Anyone can view chat media" ON storage.objects;
CREATE POLICY "Anyone can view chat media"
  ON storage.objects FOR SELECT USING (bucket_id = 'chat-media');

-- ============================================
-- 24. AUTO-UPDATE TIMESTAMPS
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_chats_updated_at ON public.chats;
CREATE TRIGGER update_chats_updated_at BEFORE UPDATE ON public.chats
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_user_settings_updated_at ON public.user_settings;
CREATE TRIGGER update_user_settings_updated_at BEFORE UPDATE ON public.user_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_users_updated_at ON public.users;
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_usage_limits_updated_at ON public.usage_limits;
CREATE TRIGGER update_usage_limits_updated_at BEFORE UPDATE ON public.usage_limits
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 25. SET ADMIN USER
-- ============================================
UPDATE public.users SET is_admin = true
WHERE email = 'howtotutorialbysreenikesh@gmail.com';

-- Generate referral codes for users who don't have one
INSERT INTO public.referral_codes (code, user_id)
SELECT UPPER(SUBSTRING(MD5(RANDOM()::text || id::text) FROM 1 FOR 8)), id
FROM public.users
WHERE id NOT IN (SELECT user_id FROM public.referral_codes)
ON CONFLICT DO NOTHING;

-- ============================================
-- DONE! All 22 tables + triggers + policies created.
-- ============================================
-- MANUAL STEPS:
-- 1. Go to Dashboard > Database > Replication
--    Enable for: direct_chats, direct_messages, friends,
--    group_chats, group_members, group_messages, chats, messages
-- 2. Go to Dashboard > Authentication > Providers > Email
--    Turn OFF "Confirm email"
-- ============================================
