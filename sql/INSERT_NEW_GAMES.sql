-- ============================================
-- INSERT 5 NEW GAMES - USER REQUESTED
-- Run this SQL in your Supabase SQL Editor
-- ============================================

-- Delete old games (optional - comment out if you want to keep them)
-- DELETE FROM public.games;

-- Insert the 5 new games
INSERT INTO public.games (name, reward_coins, reward_tokens, description) VALUES
  ('1v1 Quick Duel', 50, 0, 'Two players fight! Winner gets +50 coins, loser gets +10 coins.'),
  ('Speed Run Challenge', 40, 0, 'Complete a short obby/level as fast as possible! Fastest time gets coins based on rank.'),
  ('Guess the Right Door', 30, 0, 'Pick 1 out of 3 doors. Correct door = win coins, wrong door = lose or get nothing.'),
  ('Last Player Standing', 45, 0, 'Players get eliminated one by one (lava rising, falling platforms). Last alive wins coins.'),
  ('Mini Quiz Battle', 35, 5, 'Answer 5 quick questions. More correct answers = win and earn coins.')
ON CONFLICT (name) DO UPDATE SET
  reward_coins = EXCLUDED.reward_coins,
  reward_tokens = EXCLUDED.reward_tokens,
  description = EXCLUDED.description;

-- Verify games were inserted
SELECT name, reward_coins, reward_tokens, description 
FROM public.games 
WHERE name IN ('1v1 Quick Duel', 'Speed Run Challenge', 'Guess the Right Door', 'Last Player Standing', 'Mini Quiz Battle')
ORDER BY reward_coins DESC;

