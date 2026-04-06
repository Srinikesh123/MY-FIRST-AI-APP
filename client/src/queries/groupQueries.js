export async function loadGroups(supabase, userId) {
  const { data, error } = await supabase
    .from('group_members')
    .select('group_id, role, group_chats(*)')
    .eq('user_id', userId);

  if (error) throw error;
  return (data || []).map(d => ({ ...d.group_chats, role: d.role }));
}

export async function createGroup(supabase, userId, name, memberIds) {
  const { data: group, error } = await supabase
    .from('group_chats')
    .insert({ name, creator_id: userId })
    .select()
    .single();

  if (error) throw error;

  // Add creator as admin
  const members = [{ group_id: group.id, user_id: userId, role: 'admin' }];
  for (const mId of memberIds) {
    members.push({ group_id: group.id, user_id: mId, role: 'member' });
  }

  await supabase.from('group_members').insert(members);
  return group;
}

export async function loadGroupMessages(supabase, groupId, limit = 100) {
  const { data, error } = await supabase
    .from('group_messages')
    .select('*')
    .eq('group_id', groupId)
    .order('created_at', { ascending: true })
    .limit(limit);

  if (error) throw error;
  return data || [];
}

export async function sendGroupMessage(supabase, groupId, senderId, content) {
  const { data, error } = await supabase
    .from('group_messages')
    .insert({ group_id: groupId, sender_id: senderId, content })
    .select()
    .single();

  if (error) throw error;

  await supabase
    .from('group_chats')
    .update({ last_message: content, last_message_at: new Date().toISOString() })
    .eq('id', groupId);

  return data;
}
