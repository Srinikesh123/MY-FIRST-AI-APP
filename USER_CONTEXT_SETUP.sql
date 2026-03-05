-- ============================================
-- USER CONTEXT AND IDENTITY TABLE SETUP
-- Add this to your existing SUPABASE_SETUP.sql or run separately
-- ============================================

-- ============================================
-- USER CONTEXT TABLE
-- Stores user identity, preferences, and context
-- ============================================
CREATE TABLE IF NOT EXISTS public.user_context (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Identity Information
  display_name text,  -- User's preferred name (e.g., "Nithya")
  bio text,           -- User's self-description (e.g., "I'm a gamer")
  
  -- Preferences that affect AI responses
  response_style text DEFAULT 'balanced' CHECK (response_style IN ('short', 'balanced', 'detailed', 'casual', 'formal', 'gamer', 'technical')),
  personality_traits jsonb DEFAULT '[]', -- Array of traits like ["friendly", "technical", "creative"]
  interests jsonb DEFAULT '[]', -- Array of interests like ["gaming", "coding", "music"]
  
  -- Context Information
  profession text,    -- User's profession
  expertise_level text DEFAULT 'intermediate' CHECK (expertise_level IN ('beginner', 'intermediate', 'expert')),
  preferred_topics jsonb DEFAULT '[]', -- Topics user likes to discuss
  
  -- AI Interaction Preferences
  ai_personality_preference text DEFAULT 'friendly' CHECK (ai_personality_preference IN ('friendly', 'professional', 'casual', 'funny', 'serious')),
  communication_style text DEFAULT 'adaptive' CHECK (communication_style IN ('adaptive', 'direct', 'detailed', 'brief')),
  
  -- Metadata
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  
  -- Ensure one context record per user
  UNIQUE(user_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_context_user_id ON public.user_context(user_id);
CREATE INDEX IF NOT EXISTS idx_user_context_display_name ON public.user_context(display_name);

-- Enable RLS
ALTER TABLE public.user_context ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS "Users can view their own context" ON public.user_context;
CREATE POLICY "Users can view their own context"
  ON public.user_context FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own context" ON public.user_context;
CREATE POLICY "Users can insert their own context"
  ON public.user_context FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own context" ON public.user_context;
CREATE POLICY "Users can update their own context"
  ON public.user_context FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Admin can view all user contexts
DROP POLICY IF EXISTS "Admins can view all contexts" ON public.user_context;
CREATE POLICY "Admins can view all contexts"
  ON public.user_context FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND is_admin = true
    )
  );

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update updated_at
DROP TRIGGER IF EXISTS handle_user_context_updated_at ON public.user_context;
CREATE TRIGGER handle_user_context_updated_at
    BEFORE UPDATE ON public.user_context
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

-- Function to get or create user context
CREATE OR REPLACE FUNCTION public.get_or_create_user_context(
  p_user_id uuid,
  p_display_name text DEFAULT NULL,
  p_bio text DEFAULT NULL,
  p_response_style text DEFAULT 'balanced',
  p_personality_traits jsonb DEFAULT '[]',
  p_interests jsonb DEFAULT '[]',
  p_profession text DEFAULT NULL,
  p_expertise_level text DEFAULT 'intermediate',
  p_preferred_topics jsonb DEFAULT '[]',
  p_ai_personality_preference text DEFAULT 'friendly',
  p_communication_style text DEFAULT 'adaptive'
)
RETURNS TABLE (
  id uuid,
  user_id uuid,
  display_name text,
  bio text,
  response_style text,
  personality_traits jsonb,
  interests jsonb,
  profession text,
  expertise_level text,
  preferred_topics jsonb,
  ai_personality_preference text,
  communication_style text,
  created_at timestamptz,
  updated_at timestamptz
) AS $$
BEGIN
    -- Try to get existing context first
    RETURN QUERY
    SELECT uc.id, uc.user_id, uc.display_name, uc.bio, uc.response_style,
           uc.personality_traits, uc.interests, uc.profession, uc.expertise_level,
           uc.preferred_topics, uc.ai_personality_preference, uc.communication_style,
           uc.created_at, uc.updated_at
    FROM public.user_context uc
    WHERE uc.user_id = p_user_id;
    
    -- If no context exists, create it
    IF NOT FOUND THEN
        INSERT INTO public.user_context (
            user_id, display_name, bio, response_style, personality_traits,
            interests, profession, expertise_level, preferred_topics,
            ai_personality_preference, communication_style
        ) VALUES (
            p_user_id, p_display_name, p_bio, p_response_style, p_personality_traits,
            p_interests, p_profession, p_expertise_level, p_preferred_topics,
            p_ai_personality_preference, p_communication_style
        )
        ON CONFLICT (user_id) DO NOTHING
        RETURNING uc.id, uc.user_id, uc.display_name, uc.bio, uc.response_style,
                  uc.personality_traits, uc.interests, uc.profession, uc.expertise_level,
                  uc.preferred_topics, uc.ai_personality_preference, uc.communication_style,
                  uc.created_at, uc.updated_at
        INTO 
            id, user_id, display_name, bio, response_style,
            personality_traits, interests, profession, expertise_level,
            preferred_topics, ai_personality_preference, communication_style,
            created_at, updated_at;
            
        -- Return the newly created context
        RETURN QUERY
        SELECT uc.id, uc.user_id, uc.display_name, uc.bio, uc.response_style,
               uc.personality_traits, uc.interests, uc.profession, uc.expertise_level,
               uc.preferred_topics, uc.ai_personality_preference, uc.communication_style,
               uc.created_at, uc.updated_at
        FROM public.user_context uc
        WHERE uc.user_id = p_user_id;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
