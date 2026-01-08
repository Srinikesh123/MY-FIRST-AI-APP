-- ============================================
-- INSERT GAMES INTO SUPABASE
-- Run this SQL in your Supabase SQL Editor
-- ============================================

-- Clear existing games (optional - remove if you want to keep existing games)
-- DELETE FROM public.games;

-- Insert all games
INSERT INTO public.games (name, reward_coins, reward_tokens, description) VALUES
  ('Bounce Game', 10, 0, 'Bounce the ball and score points!'),
  ('Click Speed Challenge', 15, 0, 'Click as fast as you can in 10 seconds!'),
  ('Memory Tiles', 20, 0, 'Match pairs of tiles to test your memory!'),
  ('Reaction Test', 12, 0, 'Test your reaction time - click when you see green!'),
  ('Number Guess', 18, 0, 'Guess the number between 1 and 100!'),
  ('Word Puzzle', 25, 5, 'Solve word puzzles and earn bonus tokens!'),
  ('Color Match', 15, 0, 'Match colors as fast as possible!'),
  ('Math Challenge', 20, 0, 'Solve math problems quickly!'),
  ('Typing Speed', 22, 0, 'Type words as fast as you can!'),
  ('Snake Game', 30, 0, 'Classic snake game - grow as long as possible!'),
  ('Tetris', 35, 5, 'Stack blocks and clear lines!'),
  ('Pong', 15, 0, 'Classic pong game - bounce the ball!'),
  ('2048', 28, 0, 'Combine tiles to reach 2048!'),
  ('Rock Paper Scissors', 10, 0, 'Beat the AI in rock paper scissors!'),
  ('Tic Tac Toe', 12, 0, 'Play tic tac toe against the AI!'),
  ('Simon Says', 25, 0, 'Repeat the sequence of colors!'),
  ('Whack a Mole', 20, 0, 'Whack moles as they appear!'),
  ('Space Invaders', 40, 10, 'Defend Earth from aliens!'),
  ('Breakout', 18, 0, 'Break all the bricks!'),
  ('Frogger', 22, 0, 'Help the frog cross the road!')
ON CONFLICT (name) DO UPDATE SET
  reward_coins = EXCLUDED.reward_coins,
  reward_tokens = EXCLUDED.reward_tokens,
  description = EXCLUDED.description;

-- Verify games were inserted
SELECT name, reward_coins, reward_tokens, description 
FROM public.games 
ORDER BY reward_coins DESC;









