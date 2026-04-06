-- ============================================================
-- FIX_CHAT_TABLES.sql
-- Supabase: Create / repair all chat-related tables, FKs,
-- RLS policies and realtime publication.
-- ============================================================


-- ============================================================
-- SECTION 1: CREATE TABLES (IF NOT EXISTS)
-- ============================================================

-- direct_chats
CREATE TABLE IF NOT EXISTS public.direct_chats (
    id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user1_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    user2_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    last_message     text,
    last_message_at  timestamptz,
    created_at       timestamptz NOT NULL DEFAULT now(),
    UNIQUE (user1_id, user2_id),
    CHECK (user1_id < user2_id)
);

-- direct_messages
CREATE TABLE IF NOT EXISTS public.direct_messages (
    id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    chat_id      uuid NOT NULL REFERENCES public.direct_chats(id) ON DELETE CASCADE,
    sender_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    content      text,
    message_type text NOT NULL DEFAULT 'text',
    media_url    text,
    status       text NOT NULL DEFAULT 'sent',
    created_at   timestamptz NOT NULL DEFAULT now()
);

-- group_chats
CREATE TABLE IF NOT EXISTS public.group_chats (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name            text NOT NULL,
    creator_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    last_message    text,
    last_message_at timestamptz,
    created_at      timestamptz NOT NULL DEFAULT now()
);

-- group_members
CREATE TABLE IF NOT EXISTS public.group_members (
    group_id  uuid NOT NULL REFERENCES public.group_chats(id) ON DELETE CASCADE,
    user_id   uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role      text NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'member')),
    joined_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (group_id, user_id)
);

-- group_messages
CREATE TABLE IF NOT EXISTS public.group_messages (
    id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id     uuid NOT NULL REFERENCES public.group_chats(id) ON DELETE CASCADE,
    sender_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    content      text,
    message_type text NOT NULL DEFAULT 'text',
    media_url    text,
    created_at   timestamptz NOT NULL DEFAULT now()
);


-- ============================================================
-- SECTION 2: ADD MISSING COLUMNS TO EXISTING TABLES
-- ============================================================

ALTER TABLE public.direct_messages
    ADD COLUMN IF NOT EXISTS status       text NOT NULL DEFAULT 'sent',
    ADD COLUMN IF NOT EXISTS message_type text NOT NULL DEFAULT 'text',
    ADD COLUMN IF NOT EXISTS media_url    text;

ALTER TABLE public.group_messages
    ADD COLUMN IF NOT EXISTS message_type text NOT NULL DEFAULT 'text',
    ADD COLUMN IF NOT EXISTS media_url    text;


-- ============================================================
-- SECTION 3: FIX FOREIGN KEYS ON CHAT TABLES → auth.users
-- ============================================================

-- direct_chats: user1_id_fkey
ALTER TABLE public.direct_chats
    DROP CONSTRAINT IF EXISTS direct_chats_user1_id_fkey;
ALTER TABLE public.direct_chats
    ADD CONSTRAINT direct_chats_user1_id_fkey
    FOREIGN KEY (user1_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- direct_chats: user2_id_fkey
ALTER TABLE public.direct_chats
    DROP CONSTRAINT IF EXISTS direct_chats_user2_id_fkey;
ALTER TABLE public.direct_chats
    ADD CONSTRAINT direct_chats_user2_id_fkey
    FOREIGN KEY (user2_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- direct_messages: sender_id_fkey
ALTER TABLE public.direct_messages
    DROP CONSTRAINT IF EXISTS direct_messages_sender_id_fkey;
ALTER TABLE public.direct_messages
    ADD CONSTRAINT direct_messages_sender_id_fkey
    FOREIGN KEY (sender_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- group_chats: creator_id_fkey
ALTER TABLE public.group_chats
    DROP CONSTRAINT IF EXISTS group_chats_creator_id_fkey;
ALTER TABLE public.group_chats
    ADD CONSTRAINT group_chats_creator_id_fkey
    FOREIGN KEY (creator_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- group_members: user_id_fkey
ALTER TABLE public.group_members
    DROP CONSTRAINT IF EXISTS group_members_user_id_fkey;
ALTER TABLE public.group_members
    ADD CONSTRAINT group_members_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- group_messages: sender_id_fkey
ALTER TABLE public.group_messages
    DROP CONSTRAINT IF EXISTS group_messages_sender_id_fkey;
ALTER TABLE public.group_messages
    ADD CONSTRAINT group_messages_sender_id_fkey
    FOREIGN KEY (sender_id) REFERENCES auth.users(id) ON DELETE CASCADE;


-- ============================================================
-- SECTION 4: FIX calls AND call_candidates TABLES (if exist)
-- ============================================================

DO $$
BEGIN
    -- calls: caller_id_fkey
    IF EXISTS (SELECT 1 FROM information_schema.tables
               WHERE table_schema = 'public' AND table_name = 'calls') THEN

        ALTER TABLE public.calls
            DROP CONSTRAINT IF EXISTS calls_caller_id_fkey;
        ALTER TABLE public.calls
            ADD CONSTRAINT calls_caller_id_fkey
            FOREIGN KEY (caller_id) REFERENCES auth.users(id) ON DELETE CASCADE;

        ALTER TABLE public.calls
            DROP CONSTRAINT IF EXISTS calls_callee_id_fkey;
        ALTER TABLE public.calls
            ADD CONSTRAINT calls_callee_id_fkey
            FOREIGN KEY (callee_id) REFERENCES auth.users(id) ON DELETE CASCADE;

    END IF;

    -- call_candidates: sender_id_fkey
    IF EXISTS (SELECT 1 FROM information_schema.tables
               WHERE table_schema = 'public' AND table_name = 'call_candidates') THEN

        ALTER TABLE public.call_candidates
            DROP CONSTRAINT IF EXISTS call_candidates_sender_id_fkey;
        ALTER TABLE public.call_candidates
            ADD CONSTRAINT call_candidates_sender_id_fkey
            FOREIGN KEY (sender_id) REFERENCES auth.users(id) ON DELETE CASCADE;

    END IF;
END $$;


-- ============================================================
-- SECTION 5: SECURITY DEFINER FUNCTION FOR GROUP MEMBERSHIP
-- (avoids recursive RLS on group_members)
-- ============================================================

CREATE OR REPLACE FUNCTION public.is_group_member(gid uuid, uid uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.group_members
        WHERE group_id = gid
          AND user_id   = uid
    );
$$;


-- ============================================================
-- SECTION 6: ENABLE RLS AND CREATE POLICIES
-- ============================================================

-- ---- direct_chats ----
ALTER TABLE public.direct_chats ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "direct_chats_select" ON public.direct_chats;
CREATE POLICY "direct_chats_select" ON public.direct_chats
    FOR SELECT USING (
        user1_id = auth.uid() OR user2_id = auth.uid()
    );

DROP POLICY IF EXISTS "direct_chats_insert" ON public.direct_chats;
CREATE POLICY "direct_chats_insert" ON public.direct_chats
    FOR INSERT WITH CHECK (
        user1_id = auth.uid() OR user2_id = auth.uid()
    );

DROP POLICY IF EXISTS "direct_chats_update" ON public.direct_chats;
CREATE POLICY "direct_chats_update" ON public.direct_chats
    FOR UPDATE USING (
        user1_id = auth.uid() OR user2_id = auth.uid()
    );


-- ---- direct_messages ----
ALTER TABLE public.direct_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "direct_messages_select" ON public.direct_messages;
CREATE POLICY "direct_messages_select" ON public.direct_messages
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.direct_chats dc
            WHERE dc.id = chat_id
              AND (dc.user1_id = auth.uid() OR dc.user2_id = auth.uid())
        )
    );

DROP POLICY IF EXISTS "direct_messages_insert" ON public.direct_messages;
CREATE POLICY "direct_messages_insert" ON public.direct_messages
    FOR INSERT WITH CHECK (
        sender_id = auth.uid()
    );

DROP POLICY IF EXISTS "direct_messages_delete" ON public.direct_messages;
CREATE POLICY "direct_messages_delete" ON public.direct_messages
    FOR DELETE USING (
        sender_id = auth.uid()
    );

DROP POLICY IF EXISTS "direct_messages_update" ON public.direct_messages;
CREATE POLICY "direct_messages_update" ON public.direct_messages
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM public.direct_chats dc
            WHERE dc.id = chat_id
              AND (dc.user1_id = auth.uid() OR dc.user2_id = auth.uid())
        )
    );


-- ---- group_chats ----
ALTER TABLE public.group_chats ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "group_chats_select" ON public.group_chats;
CREATE POLICY "group_chats_select" ON public.group_chats
    FOR SELECT USING (
        creator_id = auth.uid()
        OR public.is_group_member(id, auth.uid())
    );

DROP POLICY IF EXISTS "group_chats_insert" ON public.group_chats;
CREATE POLICY "group_chats_insert" ON public.group_chats
    FOR INSERT WITH CHECK (
        creator_id = auth.uid()
    );

DROP POLICY IF EXISTS "group_chats_update" ON public.group_chats;
CREATE POLICY "group_chats_update" ON public.group_chats
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM public.group_members gm
            WHERE gm.group_id = id
              AND gm.user_id  = auth.uid()
              AND gm.role     = 'admin'
        )
    );


-- ---- group_members ----
ALTER TABLE public.group_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "group_members_select" ON public.group_members;
CREATE POLICY "group_members_select" ON public.group_members
    FOR SELECT USING (
        user_id = auth.uid()
        OR public.is_group_member(group_id, auth.uid())
    );

DROP POLICY IF EXISTS "group_members_insert" ON public.group_members;
CREATE POLICY "group_members_insert" ON public.group_members
    FOR INSERT WITH CHECK (
        -- self-join (invited by creator handled at app level)
        user_id = auth.uid()
        OR EXISTS (
            SELECT 1 FROM public.group_members gm
            WHERE gm.group_id = group_id
              AND gm.user_id  = auth.uid()
              AND gm.role     = 'admin'
        )
        OR EXISTS (
            SELECT 1 FROM public.group_chats gc
            WHERE gc.id         = group_id
              AND gc.creator_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "group_members_delete" ON public.group_members;
CREATE POLICY "group_members_delete" ON public.group_members
    FOR DELETE USING (
        -- leaving yourself
        user_id = auth.uid()
        OR EXISTS (
            SELECT 1 FROM public.group_members gm
            WHERE gm.group_id = group_id
              AND gm.user_id  = auth.uid()
              AND gm.role     = 'admin'
        )
    );


-- ---- group_messages ----
ALTER TABLE public.group_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "group_messages_select" ON public.group_messages;
CREATE POLICY "group_messages_select" ON public.group_messages
    FOR SELECT USING (
        public.is_group_member(group_id, auth.uid())
    );

DROP POLICY IF EXISTS "group_messages_insert" ON public.group_messages;
CREATE POLICY "group_messages_insert" ON public.group_messages
    FOR INSERT WITH CHECK (
        sender_id = auth.uid()
        AND public.is_group_member(group_id, auth.uid())
    );

DROP POLICY IF EXISTS "group_messages_delete" ON public.group_messages;
CREATE POLICY "group_messages_delete" ON public.group_messages
    FOR DELETE USING (
        sender_id = auth.uid()
    );


-- ============================================================
-- SECTION 7: ENABLE REALTIME
-- ============================================================

-- Set REPLICA IDENTITY FULL so realtime delivers old/new rows
ALTER TABLE public.direct_chats    REPLICA IDENTITY FULL;
ALTER TABLE public.direct_messages REPLICA IDENTITY FULL;
ALTER TABLE public.group_chats     REPLICA IDENTITY FULL;
ALTER TABLE public.group_members   REPLICA IDENTITY FULL;
ALTER TABLE public.group_messages  REPLICA IDENTITY FULL;

-- Add tables to supabase_realtime publication (skip if already present)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname   = 'supabase_realtime'
          AND schemaname = 'public'
          AND tablename  = 'direct_chats'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.direct_chats;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname   = 'supabase_realtime'
          AND schemaname = 'public'
          AND tablename  = 'direct_messages'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.direct_messages;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname   = 'supabase_realtime'
          AND schemaname = 'public'
          AND tablename  = 'group_chats'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.group_chats;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname   = 'supabase_realtime'
          AND schemaname = 'public'
          AND tablename  = 'group_members'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.group_members;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname   = 'supabase_realtime'
          AND schemaname = 'public'
          AND tablename  = 'group_messages'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.group_messages;
    END IF;
END $$;


-- ============================================================
-- SECTION 8: FIX friends TABLE FKs → auth.users (if exists)
-- ============================================================

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables
               WHERE table_schema = 'public' AND table_name = 'friends') THEN

        ALTER TABLE public.friends
            DROP CONSTRAINT IF EXISTS friends_user_id_fkey;
        ALTER TABLE public.friends
            ADD CONSTRAINT friends_user_id_fkey
            FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

        ALTER TABLE public.friends
            DROP CONSTRAINT IF EXISTS friends_friend_id_fkey;
        ALTER TABLE public.friends
            ADD CONSTRAINT friends_friend_id_fkey
            FOREIGN KEY (friend_id) REFERENCES auth.users(id) ON DELETE CASCADE;

    END IF;
END $$;


-- ============================================================
-- END OF FIX_CHAT_TABLES.sql
-- ============================================================
