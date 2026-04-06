export async function loadChats(supabase, userId) {
  const { data, error } = await supabase
    .from('chats')
    .select('*')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function createChat(supabase, userId, name) {
  const { data, error } = await supabase
    .from('chats')
    .insert({ user_id: userId, name })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteChat(supabase, userId, chatId) {
  // Delete messages first
  await supabase.from('messages').delete().eq('chat_id', chatId).eq('user_id', userId);
  const { error } = await supabase.from('chats').delete().eq('id', chatId).eq('user_id', userId);
  if (error) throw error;
}

export async function loadMessages(supabase, userId, chatId) {
  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .eq('chat_id', chatId)
    .eq('user_id', userId)
    .order('created_at', { ascending: true });

  if (error) throw error;
  return data || [];
}

export async function saveMessage(supabase, userId, chatId, content, role, imageData = null) {
  const row = {
    chat_id: chatId,
    user_id: userId,
    content,
    role,
  };
  if (imageData) row.image_data = imageData;

  const { data, error } = await supabase
    .from('messages')
    .insert(row)
    .select()
    .single();

  if (error) {
    // Fallback without image_data if column doesn't exist
    if (imageData) {
      delete row.image_data;
      const { data: d2, error: e2 } = await supabase.from('messages').insert(row).select().single();
      if (e2) throw e2;
      return d2;
    }
    throw error;
  }
  return data;
}

export async function getConversationHistory(supabase, userId, chatId, limit = 20) {
  const { data, error } = await supabase
    .from('messages')
    .select('role, content')
    .eq('chat_id', chatId)
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return (data || []).reverse();
}
