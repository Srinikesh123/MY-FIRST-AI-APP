-- ============================================
-- SUPABASE DATABASE SETUP FOR AI ASSISTANT
-- ============================================
-- Run this SQL in your Supabase SQL Editor
-- (Dashboard → SQL Editor → New Query → Paste this → Run)

-- 1. Create the chat_messages table
CREATE TABLE IF NOT EXISTS public.chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id text NOT NULL,
  role text NOT NULL CHECK (role IN ('user', 'assistant')),
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 2. Create an index for faster queries
CREATE INDEX IF NOT EXISTS idx_chat_messages_user_id ON public.chat_messages(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_session_id ON public.chat_messages(session_id);

-- 3. Enable Row Level Security (RLS)
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

-- 4. Create policies to allow users to insert their own messages
CREATE POLICY "Users can insert their own messages"
  ON public.chat_messages FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- 5. Create policies to allow users to select their own messages
CREATE POLICY "Users can select their own messages"
  ON public.chat_messages FOR SELECT
  USING (auth.uid() = user_id);

-- 6. Create policies to allow users to update their own messages (optional)
CREATE POLICY "Users can update their own messages"
  ON public.chat_messages FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 7. Create policies to allow users to delete their own messages (optional)
CREATE POLICY "Users can delete their own messages"
  ON public.chat_messages FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================
-- IMPORTANT: DISABLE EMAIL CONFIRMATION
-- ============================================
-- Go to: Dashboard → Authentication → Providers → Email
-- Turn OFF "Confirm email" to allow instant login without email verification

