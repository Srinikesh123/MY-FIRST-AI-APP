-- ============================================
-- DIRECT CHAT TABLES ONLY (safe - does NOT touch users table)
-- Only run this if you already have the users table set up
-- For full rebuild, use FULL_REBUILD.sql instead
-- ============================================

-- Friends
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
ALTER TABLE public.friends ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view their friendships" ON public.friends;
CREATE POLICY "Users can view their friendships" ON public.friends FOR SELECT USING (auth.uid() = user_id OR auth.uid() = friend_id);
DROP POLICY IF EXISTS "Users can send friend requests" ON public.friends;
CREATE POLICY "Users can send friend requests" ON public.friends FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can update friend status" ON public.friends;
CREATE POLICY "Users can update friend status" ON public.friends FOR UPDATE USING (auth.uid() = user_id OR auth.uid() = friend_id);
DROP POLICY IF EXISTS "Users can remove friends" ON public.friends;
CREATE POLICY "Users can remove friends" ON public.friends FOR DELETE USING (auth.uid() = user_id OR auth.uid() = friend_id);

-- Direct Chats
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
ALTER TABLE public.direct_chats ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view their direct chats" ON public.direct_chats;
CREATE POLICY "Users can view their direct chats" ON public.direct_chats FOR SELECT USING (auth.uid() = user1_id OR auth.uid() = user2_id);
DROP POLICY IF EXISTS "Users can create direct chats" ON public.direct_chats;
CREATE POLICY "Users can create direct chats" ON public.direct_chats FOR INSERT WITH CHECK (auth.uid() = user1_id OR auth.uid() = user2_id);
DROP POLICY IF EXISTS "Users can update their direct chats" ON public.direct_chats;
CREATE POLICY "Users can update their direct chats" ON public.direct_chats FOR UPDATE USING (auth.uid() = user1_id OR auth.uid() = user2_id);

-- Direct Messages
CREATE TABLE IF NOT EXISTS public.direct_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id uuid NOT NULL REFERENCES public.direct_chats(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  content text,
  message_type text NOT NULL DEFAULT 'text' CHECK (message_type IN ('text', 'image', 'video', 'link', 'file')),
  media_url text, media_name text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.direct_messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view direct messages" ON public.direct_messages;
CREATE POLICY "Users can view direct messages" ON public.direct_messages FOR SELECT USING (EXISTS (SELECT 1 FROM public.direct_chats WHERE direct_chats.id = direct_messages.chat_id AND (direct_chats.user1_id = auth.uid() OR direct_chats.user2_id = auth.uid())));
DROP POLICY IF EXISTS "Users can send direct messages" ON public.direct_messages;
CREATE POLICY "Users can send direct messages" ON public.direct_messages FOR INSERT WITH CHECK (auth.uid() = sender_id AND EXISTS (SELECT 1 FROM public.direct_chats WHERE direct_chats.id = direct_messages.chat_id AND (direct_chats.user1_id = auth.uid() OR direct_chats.user2_id = auth.uid())));

-- Group Chats
CREATE TABLE IF NOT EXISTS public.group_chats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  creator_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  avatar_url text, last_message text, last_message_at timestamptz DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Group Members
CREATE TABLE IF NOT EXISTS public.group_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.group_chats(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'member')),
  joined_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT unique_group_member UNIQUE (group_id, user_id)
);

ALTER TABLE public.group_chats ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Group members can view groups" ON public.group_chats;
CREATE POLICY "Group members can view groups" ON public.group_chats FOR SELECT USING (auth.uid() = creator_id OR EXISTS (SELECT 1 FROM public.group_members WHERE group_members.group_id = group_chats.id AND group_members.user_id = auth.uid()));
DROP POLICY IF EXISTS "Users can create groups" ON public.group_chats;
CREATE POLICY "Users can create groups" ON public.group_chats FOR INSERT WITH CHECK (auth.uid() = creator_id);
DROP POLICY IF EXISTS "Group admins can update" ON public.group_chats;
CREATE POLICY "Group admins can update" ON public.group_chats FOR UPDATE USING (auth.uid() = creator_id OR EXISTS (SELECT 1 FROM public.group_members WHERE group_members.group_id = group_chats.id AND group_members.user_id = auth.uid()));

ALTER TABLE public.group_members ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Members can view group members" ON public.group_members;
CREATE POLICY "Members can view group members" ON public.group_members FOR SELECT USING (EXISTS (SELECT 1 FROM public.group_members gm WHERE gm.group_id = group_members.group_id AND gm.user_id = auth.uid()));
DROP POLICY IF EXISTS "Creator or self can add members" ON public.group_members;
CREATE POLICY "Creator or self can add members" ON public.group_members FOR INSERT WITH CHECK (auth.uid() = user_id OR EXISTS (SELECT 1 FROM public.group_chats WHERE group_chats.id = group_members.group_id AND group_chats.creator_id = auth.uid()));
DROP POLICY IF EXISTS "Admins or self can remove members" ON public.group_members;
CREATE POLICY "Admins or self can remove members" ON public.group_members FOR DELETE USING (auth.uid() = user_id OR EXISTS (SELECT 1 FROM public.group_members gm WHERE gm.group_id = group_members.group_id AND gm.user_id = auth.uid() AND gm.role = 'admin'));
DROP POLICY IF EXISTS "Admins can update member roles" ON public.group_members;
CREATE POLICY "Admins can update member roles" ON public.group_members FOR UPDATE USING (EXISTS (SELECT 1 FROM public.group_members gm WHERE gm.group_id = group_members.group_id AND gm.user_id = auth.uid() AND gm.role = 'admin'));

-- Group Messages
CREATE TABLE IF NOT EXISTS public.group_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.group_chats(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  content text,
  message_type text NOT NULL DEFAULT 'text' CHECK (message_type IN ('text', 'image', 'video', 'link', 'file')),
  media_url text, media_name text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.group_messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Group members can view messages" ON public.group_messages;
CREATE POLICY "Group members can view messages" ON public.group_messages FOR SELECT USING (EXISTS (SELECT 1 FROM public.group_members WHERE group_members.group_id = group_messages.group_id AND group_members.user_id = auth.uid()));
DROP POLICY IF EXISTS "Group members can send messages" ON public.group_messages;
CREATE POLICY "Group members can send messages" ON public.group_messages FOR INSERT WITH CHECK (auth.uid() = sender_id AND EXISTS (SELECT 1 FROM public.group_members WHERE group_members.group_id = group_messages.group_id AND group_members.user_id = auth.uid()));

-- Chat media bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('chat-media', 'chat-media', true) ON CONFLICT (id) DO NOTHING;
