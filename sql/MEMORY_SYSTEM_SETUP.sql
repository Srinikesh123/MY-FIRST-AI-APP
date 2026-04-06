-- ============================================
-- ENHANCED USER MEMORY SYSTEM
-- Complete Memory Schema with User Isolation
-- ============================================

-- 1. USER_PROFILES TABLE - Comprehensive user memory
-- Stores structured memory: name, job, interests, hobbies, etc.
-- ============================================
CREATE TABLE IF NOT EXISTS public.user_profiles (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- Basic Identity
    name text,
    preferred_name text,
    bio text,
    
    -- Professional
    job_title text,
    profession text,
    company text,
    industry text,
    expertise_level text,
    
    -- Interests (JSONB array for open-ended interests)
    interests jsonb DEFAULT '[]'::jsonb,
    
    -- Hobbies (JSONB array)
    hobbies jsonb DEFAULT '[]'::jsonb,
    
    -- Skills (JSONB array)
    skills jsonb DEFAULT '[]'::jsonb,
    
    -- Devices & Technology
    devices jsonb DEFAULT '[]'::jsonb,  -- phones, laptops, tablets
    favorite_apps jsonb DEFAULT '[]'::jsonb,
    favorite_technologies jsonb DEFAULT '[]'::jsonb,
    operating_systems jsonb DEFAULT '[]'::jsonb,
    
    -- Vehicles
    vehicles jsonb DEFAULT '[]'::jsonb,
    dream_vehicle text,
    
    -- Sports & Fitness
    favorite_sports jsonb DEFAULT '[]'::jsonb,
    favorite_teams jsonb DEFAULT '[]'::jsonb,
    fitness_activities jsonb DEFAULT '[]'::jsonb,
    
    -- Entertainment
    favorite_movies jsonb DEFAULT '[]'::jsonb,
    favorite_music jsonb DEFAULT '[]'::jsonb,
    favorite_books jsonb DEFAULT '[]'::jsonb,
    favorite_games jsonb DEFAULT '[]'::jsonb,
    streaming_services jsonb DEFAULT '[]'::jsonb,
    
    -- News & Information
    news_interests jsonb DEFAULT '[]'::jsonb,
    information_sources jsonb DEFAULT '[]'::jsonb,
    
    -- Travel & Places
    favorite_places jsonb DEFAULT '[]'::jsonb,
    places_visited jsonb DEFAULT '[]'::jsonb,
    dream_destinations jsonb DEFAULT '[]'::jsonb,
    
    -- Food & Dining
    favorite_cuisines jsonb DEFAULT '[]'::jsonb,
    dietary_preferences jsonb DEFAULT '[]'::jsonb,
    favorite_restaurants jsonb DEFAULT '[]'::jsonb,
    
    -- Shopping & Brands
    favorite_brands jsonb DEFAULT '[]'::jsonb,
    shopping_preferences jsonb DEFAULT '[]'::jsonb,
    
    -- Personality & Communication
    personality_style text,
    communication_preferences jsonb DEFAULT '[]'::jsonb,
    response_style text,
    
    -- Lifestyle
    daily_routine text,
    life_goals jsonb DEFAULT '[]'::jsonb,
    values jsonb DEFAULT '[]'::jsonb,
    
    -- Preferences
    preferred_topics jsonb DEFAULT '[]'::jsonb,
    disliked_topics jsonb DEFAULT '[]'::jsonb,
    
    -- AI Interaction
    ai_personality_preference text,
    ai_voice_preference text,
    
    -- Metadata
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes for user_profiles
CREATE INDEX IF NOT EXISTS idx_user_profiles_user_id ON public.user_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_profiles_name ON public.user_profiles(name);

-- Enable RLS
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

-- RLS Policies for user_profiles
DROP POLICY IF EXISTS "Users can view their own profile" ON public.user_profiles;
CREATE POLICY "Users can view their own profile"
    ON public.user_profiles FOR SELECT
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own profile" ON public.user_profiles;
CREATE POLICY "Users can insert their own profile"
    ON public.user_profiles FOR INSERT
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own profile" ON public.user_profiles;
CREATE POLICY "Users can update their own profile"
    ON public.user_profiles FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can view all profiles" ON public.user_profiles;
CREATE POLICY "Admins can view all profiles"
    ON public.user_profiles FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE users.id = auth.uid() AND users.is_admin = true
        )
    );

-- ============================================
-- 2. USER_CUSTOM_TERMS TABLE - Inside jokes, personal meanings
-- ============================================
CREATE TABLE IF NOT EXISTS public.user_custom_terms (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    
    term text NOT NULL,
    meaning text NOT NULL,
    context text,
    category text,  -- 'project', 'person', 'inside_joke', 'slang', etc.
    
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    
    UNIQUE(user_id, term)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_custom_terms_user_id ON public.user_custom_terms(user_id);
CREATE INDEX IF NOT EXISTS idx_custom_terms_term ON public.user_custom_terms(term);
CREATE INDEX IF NOT EXISTS idx_custom_terms_category ON public.user_custom_terms(category);

-- Enable RLS
ALTER TABLE public.user_custom_terms ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS "Users can manage their own terms" ON public.user_custom_terms;
CREATE POLICY "Users can manage their own terms"
    ON public.user_custom_terms FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- ============================================
-- 3. USER_RELATIONSHIPS TABLE - Personal relationships
-- ============================================
CREATE TABLE IF NOT EXISTS public.user_relationships (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    
    person_name text NOT NULL,
    relationship_type text,  -- 'friend', 'family', 'colleague', 'pet', etc.
    relationship_description text,
    notes text,  -- "Alex always breaks my laptop"
    
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    
    UNIQUE(user_id, person_name)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_relationships_user_id ON public.user_relationships(user_id);
CREATE INDEX IF NOT EXISTS idx_relationships_name ON public.user_relationships(person_name);

-- Enable RLS
ALTER TABLE public.user_relationships ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS "Users can manage their own relationships" ON public.user_relationships;
CREATE POLICY "Users can manage their own relationships"
    ON public.user_relationships FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- ============================================
-- 4. USER_PRIVATE_FACTS TABLE - Personal facts that can't be found online
-- ============================================
CREATE TABLE IF NOT EXISTS public.user_private_facts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    
    fact_type text,  -- 'personal_story', 'habit', 'preference', 'unique_trait', etc.
    fact text NOT NULL,
    context text,
    
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_private_facts_user_id ON public.user_private_facts(user_id);
CREATE INDEX IF NOT EXISTS idx_private_facts_type ON public.user_private_facts(fact_type);

-- Enable RLS
ALTER TABLE public.user_private_facts ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS "Users can manage their own private facts" ON public.user_private_facts;
CREATE POLICY "Users can manage their own private facts"
    ON public.user_private_facts FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- ============================================
-- 5. USER_CONVERSATION_CONTEXT TABLE - Session-specific context
-- ============================================
CREATE TABLE IF NOT EXISTS public.user_conversation_context (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    chat_id uuid REFERENCES public.chats(id) ON DELETE CASCADE,
    
    -- Recent topics discussed
    recent_topics jsonb DEFAULT '[]'::jsonb,
    
    -- Pending questions or tasks
    pending_items jsonb DEFAULT '[]'::jsonb,
    
    -- Mood/sentiment of recent conversation
    recent_mood text,
    
    -- Last discussed topics for continuity
    last_discussed jsonb DEFAULT '{}'::jsonb,
    
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    
    UNIQUE(user_id, chat_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_conversation_context_user_id ON public.user_conversation_context(user_id);
CREATE INDEX IF NOT EXISTS idx_conversation_context_chat_id ON public.user_conversation_context(chat_id);

-- Enable RLS
ALTER TABLE public.user_conversation_context ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS "Users can manage their own conversation context" ON public.user_conversation_context;
CREATE POLICY "Users can manage their own conversation context"
    ON public.user_conversation_context FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- ============================================
-- AUTO-UPDATE TRIGGERS
-- ============================================
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for all tables
DROP TRIGGER IF EXISTS handle_user_profiles_updated_at ON public.user_profiles;
CREATE TRIGGER handle_user_profiles_updated_at
    BEFORE UPDATE ON public.user_profiles
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS handle_custom_terms_updated_at ON public.user_custom_terms;
CREATE TRIGGER handle_custom_terms_updated_at
    BEFORE UPDATE ON public.user_custom_terms
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS handle_relationships_updated_at ON public.user_relationships;
CREATE TRIGGER handle_relationships_updated_at
    BEFORE UPDATE ON public.user_relationships
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS handle_private_facts_updated_at ON public.user_private_facts;
CREATE TRIGGER handle_private_facts_updated_at
    BEFORE UPDATE ON public.user_private_facts
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS handle_conversation_context_updated_at ON public.user_conversation_context;
CREATE TRIGGER handle_conversation_context_updated_at
    BEFORE UPDATE ON public.user_conversation_context
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ============================================
-- HELPER FUNCTIONS
-- ============================================

-- Function to get or create user profile
CREATE OR REPLACE FUNCTION public.get_or_create_user_profile(p_user_id uuid)
RETURNS public.user_profiles AS $$
DECLARE
    profile public.user_profiles;
BEGIN
    -- Try to get existing profile
    SELECT * INTO profile
    FROM public.user_profiles
    WHERE user_id = p_user_id;
    
    -- If not found, create one
    IF NOT FOUND THEN
        INSERT INTO public.user_profiles (user_id)
        VALUES (p_user_id)
        RETURNING * INTO profile;
    END IF;
    
    RETURN profile;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to merge JSONB arrays without duplicates
CREATE OR REPLACE FUNCTION public.merge_jsonb_arrays(arr1 jsonb, arr2 jsonb)
RETURNS jsonb AS $$
BEGIN
    RETURN (
        SELECT jsonb_agg(DISTINCT elem)
        FROM (
            SELECT elem FROM jsonb_array_elements_text(COALESCE(arr1, '[]'::jsonb)) elem
            UNION
            SELECT elem FROM jsonb_array_elements_text(COALESCE(arr2, '[]'::jsonb)) elem
        ) sub
    );
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ============================================
-- MEMORY EXTRACTION LOG
-- Track when memories were extracted
-- ============================================
CREATE TABLE IF NOT EXISTS public.memory_extraction_log (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    extraction_type text,  -- 'profile_update', 'custom_term', 'relationship', 'private_fact'
    source_message text,
    extracted_data jsonb,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_extraction_log_user_id ON public.memory_extraction_log(user_id);
CREATE INDEX IF NOT EXISTS idx_extraction_log_type ON public.memory_extraction_log(extraction_type);

ALTER TABLE public.memory_extraction_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own extraction log" ON public.memory_extraction_log;
CREATE POLICY "Users can view their own extraction log"
    ON public.memory_extraction_log FOR SELECT
    USING (auth.uid() = user_id);

