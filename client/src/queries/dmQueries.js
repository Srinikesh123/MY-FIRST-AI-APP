export async function loadDmChats(supabase, userId) {
  const { data, error } = await supabase
    .from('direct_chats')
    .select('*')
    .or(`user1_id.eq.${userId},user2_id.eq.${userId}`)
    .order('last_message_at', { ascending: false, nullsFirst: false });

  if (error) throw error;
  return data || [];
}

export async function startDmChat(supabase, userId, otherUserId) {
  // Normalize: smaller ID = user1
  const user1 = userId < otherUserId ? userId : otherUserId;
  const user2 = userId < otherUserId ? otherUserId : userId;

  // Check if chat exists
  const { data: existing } = await supabase
    .from('direct_chats')
    .select('*')
    .eq('user1_id', user1)
    .eq('user2_id', user2)
    .single();

  if (existing) return existing;

  const { data, error } = await supabase
    .from('direct_chats')
    .insert({ user1_id: user1, user2_id: user2 })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function loadDmMessages(supabase, chatId, limit = 100) {
  const { data, error } = await supabase
    .from('direct_messages')
    .select('*')
    .eq('chat_id', chatId)
    .order('created_at', { ascending: true })
    .limit(limit);

  if (error) throw error;
  return data || [];
}

export async function sendDmMessage(supabase, chatId, senderId, content, messageType = 'text') {
  const { data, error } = await supabase
    .from('direct_messages')
    .insert({
      chat_id: chatId,
      sender_id: senderId,
      content,
      message_type: messageType,
    })
    .select()
    .single();

  if (error) throw error;

  // Update last_message on chat
  await supabase
    .from('direct_chats')
    .update({ last_message: content, last_message_at: new Date().toISOString() })
    .eq('id', chatId);

  return data;
}
