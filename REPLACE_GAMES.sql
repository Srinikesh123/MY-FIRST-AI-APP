-- ============================================
-- REPLACE ALL GAMES WITH NEW GAMES
-- Run this SQL in your Supabase SQL Editor
-- ============================================

-- Delete all existing games
DELETE FROM public.games;

-- Insert new fun games
INSERT INTO public.games (name, reward_coins, reward_tokens, description) VALUES
  ('Color Memory', 15, 0, 'Remember and repeat the color sequence!'),
  ('Number Rush', 20, 0, 'Click numbers in order as fast as you can!'),
  ('Word Scramble', 25, 5, 'Unscramble words to earn coins!'),
  ('Reaction Master', 18, 0, 'Test your reflexes - click when you see the signal!'),
  ('Math Blitz', 22, 0, 'Solve math problems quickly to win!'),
  ('Pattern Match', 20, 0, 'Match the pattern to advance!'),
  ('Speed Typing', 24, 0, 'Type words as fast as possible!'),
  ('Memory Cards', 28, 0, 'Flip and match pairs of cards!'),
  ('Bubble Pop', 15, 0, 'Pop bubbles before they reach the top!'),
  ('Dodge Game', 30, 0, 'Dodge obstacles and survive as long as possible!'),
  ('Quiz Challenge', 25, 5, 'Answer trivia questions correctly!'),
  ('Puzzle Solver', 30, 0, 'Solve puzzles to unlock rewards!'),
  ('Rhythm Game', 22, 0, 'Tap to the beat and keep the rhythm!'),
  ('Aim Trainer', 20, 0, 'Click targets as they appear!'),
  ('Word Search', 18, 0, 'Find hidden words in the grid!')
ON CONFLICT (name) DO UPDATE SET
  reward_coins = EXCLUDED.reward_coins,
  reward_tokens = EXCLUDED.reward_tokens,
  description = EXCLUDED.description;

-- Verify games were inserted
SELECT name, reward_coins, reward_tokens, description 
FROM public.games 
ORDER BY reward_coins DESC;

