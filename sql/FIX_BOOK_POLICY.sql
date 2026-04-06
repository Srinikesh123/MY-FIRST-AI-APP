-- Fix book_pages RLS — allow any logged-in user to add pages
DROP POLICY IF EXISTS "Admins modify book" ON public.book_pages;
DROP POLICY IF EXISTS "Users add book pages" ON public.book_pages;
DROP POLICY IF EXISTS "Users delete book pages" ON public.book_pages;

CREATE POLICY "Users add book pages" ON public.book_pages
    FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Users delete book pages" ON public.book_pages
    FOR DELETE USING (auth.uid() IS NOT NULL);
