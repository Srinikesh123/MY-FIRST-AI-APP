export async function loadGroups(supabase, userId) {
  try {
    const res = await fetch(`/api/groups?userId=${userId}`);
    if (!res.ok) throw new Error(await res.text());
    const { groups } = await res.json();
    return groups || [];
  } catch (err) {
    console.warn('loadGroups error:', err.message);
    return [];
  }
}

export async function createGroup(supabase, userId, name, memberIds) {
  const res = await fetch('/api/groups', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, name, memberIds }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || 'Failed to create group');
  }
  const { group } = await res.json();
  return group;
}

export async function loadGroupMessages(supabase, groupId, limit = 100) {
  const res = await fetch(`/api/groups/messages?groupId=${groupId}&limit=${limit}`);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || 'Failed to load messages');
  }
  const { messages } = await res.json();
  return messages || [];
}

export async function sendGroupMessage(supabase, groupId, senderId, content) {
  const res = await fetch('/api/groups/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ groupId, senderId, content }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || 'Failed to send message');
  }
  const { message } = await res.json();
  return message;
}
