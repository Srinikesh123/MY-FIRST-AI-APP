import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import * as friendQ from '../../queries/friendQueries';
import * as dmQ from '../../queries/dmQueries';
import * as groupQ from '../../queries/groupQueries';
import CallOverlay from '../../components/chat/CallOverlay';
import './ChatsPage.css';

export default function ChatsPage() {
  const { user, supabase } = useAuth();
  const navigate = useNavigate();
  const userId = user?.id;

  const [activeTab, setActiveTab] = useState('dms');
  const [friends, setFriends] = useState([]);
  const [pendingRequests, setPendingRequests] = useState([]);
  const [dmChats, setDmChats] = useState([]);
  const [groups, setGroups] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [activeChat, setActiveChat] = useState(null); // { type: 'dm'|'group', id, name }
  const [chatMessages, setChatMessages] = useState([]);
  const [messageInput, setMessageInput] = useState('');
  const [userNames, setUserNames] = useState({});
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [selectedMembers, setSelectedMembers] = useState([]);
  const [activeCall, setActiveCall] = useState(null); // { type: 'audio'|'video' }

  // Load data
  const loadAll = useCallback(async () => {
    if (!userId) return;
    try {
      const [f, p, dms, g] = await Promise.all([
        friendQ.loadFriends(supabase, userId),
        friendQ.loadPendingRequests(supabase, userId),
        dmQ.loadDmChats(supabase, userId),
        groupQ.loadGroups(supabase, userId),
      ]);
      setFriends(f);
      setPendingRequests(p);
      setDmChats(dms);
      setGroups(g);

      // Resolve user names for DM chats
      const ids = new Set();
      f.forEach(fr => { ids.add(fr.user_id); ids.add(fr.friend_id); });
      dms.forEach(dm => { ids.add(dm.user1_id); ids.add(dm.user2_id); });
      ids.delete(userId);

      if (ids.size > 0) {
        const { data: users } = await supabase
          .from('users')
          .select('id, username, email, avatar_url')
          .in('id', [...ids]);
        const map = {};
        (users || []).forEach(u => { map[u.id] = u; });
        setUserNames(map);
      }
    } catch (err) {
      console.error('Failed to load chats data:', err);
    }
  }, [supabase, userId]);

  useEffect(() => { loadAll(); }, [loadAll]);

  // Realtime subscription for new DMs
  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel('dm-updates')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'direct_messages' }, (payload) => {
        if (activeChat?.type === 'dm' && payload.new.chat_id === activeChat.id) {
          setChatMessages(prev => [...prev, payload.new]);
        }
      })
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [supabase, userId, activeChat]);

  const getOtherUser = (dm) => {
    const otherId = dm.user1_id === userId ? dm.user2_id : dm.user1_id;
    return userNames[otherId] || { username: 'Unknown', email: '' };
  };

  const getFriendUser = (fr) => {
    const otherId = fr.user_id === userId ? fr.friend_id : fr.user_id;
    return userNames[otherId] || { username: 'Unknown', email: '' };
  };

  const openChat = async (type, id, name) => {
    setActiveChat({ type, id, name });
    try {
      const msgs = type === 'dm'
        ? await dmQ.loadDmMessages(supabase, id)
        : await groupQ.loadGroupMessages(supabase, id);
      setChatMessages(msgs);
    } catch (err) {
      console.error('Failed to load messages:', err);
    }
  };

  const handleSendMessage = async () => {
    if (!messageInput.trim() || !activeChat) return;
    const text = messageInput.trim();
    setMessageInput('');
    try {
      if (activeChat.type === 'dm') {
        const msg = await dmQ.sendDmMessage(supabase, activeChat.id, userId, text);
        setChatMessages(prev => [...prev, msg]);
      } else {
        const msg = await groupQ.sendGroupMessage(supabase, activeChat.id, userId, text);
        setChatMessages(prev => [...prev, msg]);
      }
    } catch (err) {
      console.error('Failed to send:', err);
    }
  };

  // Auto-load all users when Add tab is opened
  useEffect(() => {
    if (activeTab !== 'add' || !userId) return;
    loadAllUsers();
  }, [activeTab, userId]);

  const loadAllUsers = async () => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('id, email, username, avatar_url')
        .neq('id', userId)
        .order('username', { ascending: true });
      if (error) throw error;
      setSearchResults(data || []);
    } catch (err) {
      console.error('Failed to load users:', err);
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) { loadAllUsers(); return; }
    try {
      const results = await friendQ.searchUsers(supabase, searchQuery);
      setSearchResults(results.filter(u => u.id !== userId));
    } catch (err) {
      console.error('Search failed:', err);
    }
  };

  const handleAddFriend = async (friendId) => {
    try {
      await friendQ.sendFriendRequest(supabase, userId, friendId);
      setSearchResults(prev => prev.filter(u => u.id !== friendId));
      await loadAll();
    } catch (err) {
      alert('Could not send request: ' + err.message);
    }
  };

  const handleAccept = async (id) => {
    await friendQ.acceptRequest(supabase, id);
    await loadAll();
  };

  const handleDecline = async (id) => {
    await friendQ.declineRequest(supabase, id);
    await loadAll();
  };

  const startDm = async (friendUserId, friendName) => {
    try {
      const chat = await dmQ.startDmChat(supabase, userId, friendUserId);
      openChat('dm', chat.id, friendName);
      setActiveTab('dms');
    } catch (err) {
      console.error('Failed to start DM:', err);
    }
  };

  const toggleMember = (id) => {
    setSelectedMembers(prev =>
      prev.includes(id) ? prev.filter(m => m !== id) : [...prev, id]
    );
  };

  const handleCreateGroup = async () => {
    if (!newGroupName.trim()) return alert('Enter a group name');
    if (selectedMembers.length === 0) return alert('Select at least one member');
    try {
      const group = await groupQ.createGroup(supabase, userId, newGroupName.trim(), selectedMembers);
      setShowCreateGroup(false);
      setNewGroupName('');
      setSelectedMembers([]);
      await loadAll();
      openChat('group', group.id, group.name);
    } catch (err) {
      alert('Failed to create group: ' + err.message);
    }
  };

  // Create group view
  if (showCreateGroup) {
    return (
      <div className="chats-page">
        <div className="chat-room-header">
          <button className="back-btn" onClick={() => setShowCreateGroup(false)}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg>
          </button>
          <h3>New Group</h3>
        </div>
        <div className="create-group-form">
          <input
            type="text"
            value={newGroupName}
            onChange={(e) => setNewGroupName(e.target.value)}
            placeholder="Group name..."
            className="group-name-input"
          />
          <h4 className="section-label">Select Members ({selectedMembers.length})</h4>
          <div className="friends-list">
            {friends.length === 0 ? (
              <div className="empty-state">Add friends first to create a group</div>
            ) : (
              friends.map(fr => {
                const other = getFriendUser(fr);
                const otherId = fr.user_id === userId ? fr.friend_id : fr.user_id;
                const isSelected = selectedMembers.includes(otherId);
                return (
                  <div key={fr.id} className={`friend-item selectable ${isSelected ? 'selected' : ''}`} onClick={() => toggleMember(otherId)}>
                    <div className="conv-avatar">{other.username?.[0]?.toUpperCase() || '?'}</div>
                    <div className="conv-info">
                      <span className="conv-name">{other.username}</span>
                    </div>
                    <div className={`select-check ${isSelected ? 'checked' : ''}`}>
                      {isSelected ? '✓' : ''}
                    </div>
                  </div>
                );
              })
            )}
          </div>
          <button className="create-group-btn" onClick={handleCreateGroup} disabled={!newGroupName.trim() || selectedMembers.length === 0}>
            Create Group
          </button>
        </div>
      </div>
    );
  }

  // Active chat view
  if (activeChat) {
    return (
      <div className="chats-page chat-room-view">
        {activeCall && (
          <CallOverlay
            supabase={supabase}
            userId={userId}
            chatId={activeChat.id}
            chatName={activeChat.name}
            callType={activeCall.type}
            onEnd={() => setActiveCall(null)}
          />
        )}
        <div className="chat-room-header">
          <button className="back-btn" onClick={() => setActiveChat(null)}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg>
          </button>
          <h3>{activeChat.name}</h3>
          <div className="chat-room-actions">
            <button className="call-action-btn" onClick={() => setActiveCall({ type: 'audio' })} title="Voice Call">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M22 16.92v3a2 2 0 01-2.18 2A19.79 19.79 0 013.18 2.18 2 2 0 015.18.18h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L8.91 8.09a16 16 0 006.93 6.93l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 16.92z"/>
              </svg>
            </button>
          </div>
        </div>
        <div className="chat-room-messages">
          {chatMessages.length === 0 ? (
            <div className="chat-room-empty">No messages yet. Say hi!</div>
          ) : (
            chatMessages.map((msg) => (
              <div key={msg.id} className={`dm-message ${msg.sender_id === userId ? 'sent' : 'received'}`}>
                <div className="dm-bubble">
                  <p>{msg.content}</p>
                  <span className="dm-time">
                    {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
        <div className="chat-room-input">
          <input
            type="text"
            value={messageInput}
            onChange={(e) => setMessageInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
            placeholder="Type a message..."
          />
          <button className="send-dm-btn" onClick={handleSendMessage}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="chats-page">
      <div className="chats-header">
        <h2>Chats</h2>
        <button className="meeting-header-btn" onClick={() => navigate('/meeting')}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polygon points="23 7 16 12 23 17 23 7"/>
            <rect x="1" y="5" width="15" height="14" rx="2" ry="2"/>
          </svg>
          Meeting
        </button>
      </div>

      <div className="chats-tabs">
        {['dms', 'groups', 'friends', 'add'].map(tab => (
          <button
            key={tab}
            className={`chats-tab ${activeTab === tab ? 'active' : ''}`}
            onClick={() => setActiveTab(tab)}
          >
            {tab === 'dms' ? 'DMs' : tab === 'groups' ? 'Groups' : tab === 'friends' ? 'Friends' : 'Add'}
          </button>
        ))}
      </div>

      <div className="chats-content">
        {activeTab === 'dms' && (
          <div className="conversation-list">
            {dmChats.length === 0 ? (
              <div className="empty-state">No conversations yet. Add friends to start chatting!</div>
            ) : (
              dmChats.map(dm => {
                const other = getOtherUser(dm);
                return (
                  <div key={dm.id} className="conversation-item" onClick={() => openChat('dm', dm.id, other.username)}>
                    <div className="conv-avatar">{other.username?.[0]?.toUpperCase() || '?'}</div>
                    <div className="conv-info">
                      <span className="conv-name">{other.username}</span>
                      <span className="conv-last">{dm.last_message || 'No messages yet'}</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {activeTab === 'groups' && (
          <div className="conversation-list">
            <button className="create-group-trigger" onClick={() => setShowCreateGroup(true)}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              Create New Group
            </button>
            {groups.length === 0 ? (
              <div className="empty-state">No groups yet. Create one above!</div>
            ) : (
              groups.map(g => (
                <div key={g.id} className="conversation-item" onClick={() => openChat('group', g.id, g.name)}>
                  <div className="conv-avatar group-avatar">{g.name?.[0]?.toUpperCase() || 'G'}</div>
                  <div className="conv-info">
                    <span className="conv-name">{g.name}</span>
                    <span className="conv-last">{g.last_message || 'No messages yet'}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === 'friends' && (
          <div className="friends-list">
            {friends.length === 0 ? (
              <div className="empty-state">No friends yet. Search and add people!</div>
            ) : (
              friends.map(fr => {
                const other = getFriendUser(fr);
                const otherId = fr.user_id === userId ? fr.friend_id : fr.user_id;
                return (
                  <div key={fr.id} className="friend-item">
                    <div className="conv-avatar">{other.username?.[0]?.toUpperCase() || '?'}</div>
                    <div className="conv-info">
                      <span className="conv-name">{other.username}</span>
                      <span className="conv-last">{other.email}</span>
                    </div>
                    <button className="msg-btn" onClick={() => startDm(otherId, other.username)}>Message</button>
                  </div>
                );
              })
            )}
            {pendingRequests.length > 0 && (
              <>
                <h4 className="section-label">Pending Requests</h4>
                {pendingRequests.map(pr => {
                  const isIncoming = pr.friend_id === userId;
                  const other = getFriendUser(pr);
                  return (
                    <div key={pr.id} className="friend-item">
                      <div className="conv-avatar">{other.username?.[0]?.toUpperCase() || '?'}</div>
                      <div className="conv-info">
                        <span className="conv-name">{other.username}</span>
                        <span className="conv-last">{isIncoming ? 'Wants to be friends' : 'Request sent'}</span>
                      </div>
                      {isIncoming && (
                        <div className="pending-actions">
                          <button className="accept-btn" onClick={() => handleAccept(pr.id)}>Accept</button>
                          <button className="decline-btn" onClick={() => handleDecline(pr.id)}>Decline</button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </>
            )}
          </div>
        )}

        {activeTab === 'add' && (
          <div className="add-friends">
            <div className="search-bar">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                placeholder="Search by username or email..."
              />
              <button onClick={handleSearch}>Search</button>
            </div>
            <div className="search-results">
              {searchResults.map(u => {
                const isFriend = friends.some(fr =>
                  (fr.user_id === userId && fr.friend_id === u.id) ||
                  (fr.friend_id === userId && fr.user_id === u.id)
                );
                const isPending = pendingRequests.some(pr =>
                  (pr.user_id === userId && pr.friend_id === u.id) ||
                  (pr.friend_id === userId && pr.user_id === u.id)
                );
                return (
                  <div key={u.id} className="friend-item">
                    <div className="conv-avatar">{u.username?.[0]?.toUpperCase() || '?'}</div>
                    <div className="conv-info">
                      <span className="conv-name">{u.username}</span>
                      <span className="conv-last">{u.email}</span>
                    </div>
                    {isFriend ? (
                      <span className="status-badge friend-badge">Friends</span>
                    ) : isPending ? (
                      <span className="status-badge pending-badge">Pending</span>
                    ) : (
                      <button className="add-btn" onClick={() => handleAddFriend(u.id)}>Add</button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
