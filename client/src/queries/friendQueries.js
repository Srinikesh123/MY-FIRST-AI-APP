export async function loadFriends(supabase, userId) {
  const { data, error } = await supabase
    .from('friends')
    .select('*')
    .or(`user_id.eq.${userId},friend_id.eq.${userId}`)
    .eq('status', 'accepted');

  if (error) throw error;
  return data || [];
}

export async function loadPendingRequests(supabase, userId) {
  const { data, error } = await supabase
    .from('friends')
    .select('*')
    .or(`user_id.eq.${userId},friend_id.eq.${userId}`)
    .eq('status', 'pending');

  if (error) throw error;
  return data || [];
}

export async function searchUsers(supabase, query) {
  const { data, error } = await supabase
    .from('users')
    .select('id, email, username, avatar_url')
    .or(`email.ilike.%${query}%,username.ilike.%${query}%`)
    .limit(20);

  if (error) throw error;
  return data || [];
}

export async function checkExistingFriendship(supabase, userId, friendId) {
  const { data } = await supabase
    .from('friends')
    .select('id, status')
    .or(
      `and(user_id.eq.${userId},friend_id.eq.${friendId}),and(user_id.eq.${friendId},friend_id.eq.${userId})`
    )
    .limit(1);
  return data?.[0] || null;
}

export async function sendFriendRequest(supabase, userId, friendId) {
  // Check if already friends or pending
  const existing = await checkExistingFriendship(supabase, userId, friendId);
  if (existing) {
    if (existing.status === 'accepted') throw new Error('Already friends');
    if (existing.status === 'pending') throw new Error('Request already pending');
  }

  const { data, error } = await supabase
    .from('friends')
    .insert({ user_id: userId, friend_id: friendId, status: 'pending' })
    .select()
    .single();

  if (error) {
    if (error.code === '23505') throw new Error('Friend request already exists');
    throw error;
  }
  return data;
}

export async function acceptRequest(supabase, requestId) {
  const { error } = await supabase
    .from('friends')
    .update({ status: 'accepted' })
    .eq('id', requestId);

  if (error) throw error;
}

export async function declineRequest(supabase, requestId) {
  const { error } = await supabase
    .from('friends')
    .delete()
    .eq('id', requestId);

  if (error) throw error;
}

export async function removeFriend(supabase, userId, friendId) {
  const { error } = await supabase
    .from('friends')
    .delete()
    .or(`and(user_id.eq.${userId},friend_id.eq.${friendId}),and(user_id.eq.${friendId},friend_id.eq.${userId})`);

  if (error) throw error;
}
