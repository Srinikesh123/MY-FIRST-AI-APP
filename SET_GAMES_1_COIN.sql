-- ============================================
-- SET ALL GAMES TO 1 COIN PER WIN
-- Run this SQL in your Supabase SQL Editor
-- ============================================

-- Update all games to give 1 coin per win
UPDATE public.games
SET reward_coins = 1
WHERE reward_coins > 1;

-- Verify the changes
SELECT name, reward_coins, reward_tokens, description 
FROM public.games 
ORDER BY reward_coins DESC;

-- ============================================
-- SET ADMIN FLAG FOR USER
-- ============================================

-- Set admin flag for your account
UPDATE public.users
SET is_admin = true
WHERE email = 'howtotutorialbysreenikesh@gmail.com';

-- Verify admin status
SELECT email, is_admin 
FROM public.users 
WHERE email = 'howtotutorialbysreenikesh@gmail.com';