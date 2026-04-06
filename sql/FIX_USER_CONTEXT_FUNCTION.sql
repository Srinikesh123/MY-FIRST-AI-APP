-- ============================================
-- FIXED USER CONTEXT FUNCTION
-- Run this to fix the "column reference user_id is ambiguous" error
-- ============================================

-- Function to get or create user context (FIXED VERSION)
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
        RETURNING id, user_id, display_name, bio, response_style,
                  personality_traits, interests, profession, expertise_level,
                  preferred_topics, ai_personality_preference, communication_style,
                  created_at, updated_at
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
