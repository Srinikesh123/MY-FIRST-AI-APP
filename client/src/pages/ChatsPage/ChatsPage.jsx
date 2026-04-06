import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import * as friendQ from '../../queries/friendQueries';
import * as dmQ from '../../queries/dmQueries';
import * as groupQ from '../../queries/groupQueries';
import './ChatsPage.css';

export default function ChatsPage() {
  const { user, supabase } = useAuth();
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

  const handleSearch = async () => {
    if (!searchQuery.trim()) { setSearchResults([]); return; }
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

  // Active chat view
  if (activeChat) {
    return (
      <div className="chats-page chat-room-view">
        <div className="chat-room-header">
          <button className="back-btn" onClick={() => setActiveChat(null)}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg>
          </button>
          <h3>{activeChat.name}</h3>
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
            {groups.length === 0 ? (
              <div className="empty-state">No groups yet.</div>
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
              {searchResults.map(u => (
                <div key={u.id} className="friend-item">
                  <div className="conv-avatar">{u.username?.[0]?.toUpperCase() || '?'}</div>
                  <div className="conv-info">
                    <span className="conv-name">{u.username}</span>
                    <span className="conv-last">{u.email}</span>
                  </div>
                  <button className="add-btn" onClick={() => handleAddFriend(u.id)}>Add</button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
