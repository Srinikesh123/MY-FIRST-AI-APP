export async function loadUserInfo(supabase, userId) {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('id', userId)
    .single();

  if (error) throw error;
  return data;
}

export async function updateUserPlan(supabase, userId, plan, coinsToDeduct) {
  const { data: user } = await supabase
    .from('users')
    .select('coins')
    .eq('id', userId)
    .single();

  const currentCoins = user?.coins || 0;
  if (currentCoins < coinsToDeduct) throw new Error('Not enough coins');

  const { error } = await supabase
    .from('users')
    .update({ plan, coins: currentCoins - coinsToDeduct })
    .eq('id', userId);

  if (error) throw error;
  return { plan, coins: currentCoins - coinsToDeduct };
}

export async function updateAvatar(supabase, userId, avatarUrl) {
  const { error } = await supabase
    .from('users')
    .update({ avatar_url: avatarUrl })
    .eq('id', userId);

  if (error) throw error;
}
