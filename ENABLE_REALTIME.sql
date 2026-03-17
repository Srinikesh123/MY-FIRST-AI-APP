-- ============================================
-- STEP 1: Enable realtime for chat tables
-- Run this in Supabase SQL Editor
-- ============================================

-- Required: full row data in realtime events
ALTER TABLE public.direct_messages REPLICA IDENTITY FULL;
ALTER TABLE public.group_messages   REPLICA IDENTITY FULL;
ALTER TABLE public.direct_chats     REPLICA IDENTITY FULL;
ALTER TABLE public.group_chats      REPLICA IDENTITY FULL;

-- Add tables to the Supabase realtime publication
DO $$
BEGIN
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
END $$;

-- ============================================
-- STEP 2: Voice / Video call tables (WebRTC signaling)
-- ============================================

CREATE TABLE IF NOT EXISTS public.calls (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  caller_id   uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  callee_id   uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  call_type   text NOT NULL DEFAULT 'voice' CHECK (call_type IN ('voice','video')),
  status      text NOT NULL DEFAULT 'ringing' CHECK (status IN ('ringing','active','ended','rejected')),
  offer       jsonb,
  answer      jsonb,
  created_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT different_call_users CHECK (caller_id != callee_id)
);

CREATE TABLE IF NOT EXISTS public.call_candidates (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  call_id     uuid NOT NULL REFERENCES public.calls(id) ON DELETE CASCADE,
  sender_id   uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  candidate   jsonb NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- RLS for calls
ALTER TABLE public.calls ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Call participants can see calls" ON public.calls;
CREATE POLICY "Call participants can see calls" ON public.calls
  FOR SELECT USING (auth.uid() = caller_id OR auth.uid() = callee_id);
DROP POLICY IF EXISTS "Users can create calls" ON public.calls;
CREATE POLICY "Users can create calls" ON public.calls
  FOR INSERT WITH CHECK (auth.uid() = caller_id);
DROP POLICY IF EXISTS "Call participants can update calls" ON public.calls;
CREATE POLICY "Call participants can update calls" ON public.calls
  FOR UPDATE USING (auth.uid() = caller_id OR auth.uid() = callee_id);
DROP POLICY IF EXISTS "Call participants can delete calls" ON public.calls;
CREATE POLICY "Call participants can delete calls" ON public.calls
  FOR DELETE USING (auth.uid() = caller_id OR auth.uid() = callee_id);

-- RLS for call_candidates
ALTER TABLE public.call_candidates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Call participants can see candidates" ON public.call_candidates;
CREATE POLICY "Call participants can see candidates" ON public.call_candidates
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.calls
      WHERE calls.id = call_candidates.call_id
        AND (calls.caller_id = auth.uid() OR calls.callee_id = auth.uid())
    )
  );
DROP POLICY IF EXISTS "Users can send candidates" ON public.call_candidates;
CREATE POLICY "Users can send candidates" ON public.call_candidates
  FOR INSERT WITH CHECK (auth.uid() = sender_id);

-- Enable realtime for calls tables
ALTER TABLE public.calls           REPLICA IDENTITY FULL;
ALTER TABLE public.call_candidates REPLICA IDENTITY FULL;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'calls') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.calls;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'call_candidates') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.call_candidates;
  END IF;
END $$;

-- ============================================
-- DONE! Run STEP 1 and STEP 2 together.
-- Then in Supabase Dashboard:
--   Table Editor → each chat table → toggle "Realtime" ON
-- ============================================
