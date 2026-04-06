export async function loadGames(supabase) {
  const { data, error } = await supabase
    .from('games')
    .select('*')
    .order('name');

  if (error) throw error;
  return data || [];
}

export async function addCoins(supabase, userId, amount) {
  const { data: user } = await supabase
    .from('users')
    .select('coins')
    .eq('id', userId)
    .single();

  const newCoins = (user?.coins || 0) + amount;
  const { error } = await supabase
    .from('users')
    .update({ coins: newCoins })
    .eq('id', userId);

  if (error) throw error;
  return newCoins;
}
