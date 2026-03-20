-- ============================================================
-- PUSH SUBSCRIPTIONS (Web Push notifications)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
    user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    subscription jsonb NOT NULL,
    updated_at timestamptz DEFAULT now()
);
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "User manages own push sub" ON public.push_subscriptions;
CREATE POLICY "User manages own push sub" ON public.push_subscriptions
    FOR ALL USING (auth.uid() = user_id);

-- ============================================================
-- BOOK PAGES (admin uploads images, everyone can read)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.book_pages (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    page_order int NOT NULL DEFAULT 0,
    image_url text NOT NULL,
    caption text DEFAULT '',
    created_at timestamptz DEFAULT now()
);
ALTER TABLE public.book_pages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone reads book" ON public.book_pages;
DROP POLICY IF EXISTS "Admins modify book" ON public.book_pages;
CREATE POLICY "Anyone reads book" ON public.book_pages FOR SELECT USING (true);
CREATE POLICY "Admins modify book" ON public.book_pages FOR ALL
    USING (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND is_admin = true));

-- Enable realtime for book pages (so admin additions appear live)
ALTER TABLE public.book_pages REPLICA IDENTITY FULL;
