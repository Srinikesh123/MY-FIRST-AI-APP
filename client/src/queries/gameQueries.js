// ============================================
// GAME QUERIES — load games, play/reward
// ============================================

export async function loadGames(supabase) {
  const { data, error } = await supabase
    .from('games')
    .select('*')
    .order('name');

  if (error) throw error;
  return data || [];
}

// Re-export addCoins from userQueries for backward compatibility
export { addCoins } from './userQueries';
