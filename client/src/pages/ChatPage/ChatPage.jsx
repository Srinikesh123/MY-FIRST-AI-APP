import { useState, useEffect } from 'react';
import { useChat } from '../../contexts/ChatContext';
import { useSettings } from '../../contexts/SettingsContext';
import ChatSidebar from '../../components/chat/ChatSidebar';
import MessageList from '../../components/chat/MessageList';
import ChatInput from '../../components/chat/ChatInput';
import './ChatPage.css';

export default function ChatPage() {
  const {
    chats, currentChatId, currentChatName, messages,
    isSending, refreshChats, selectChat, sendMessage,
  } = useChat();
  const { settings } = useSettings();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    refreshChats();
  }, [refreshChats]);

  const handleSend = (text, imageData) => {
    sendMessage(text, settings, imageData);
  };

  return (
    <div className="chat-page">
      <ChatSidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="chat-header-bar">
        <button className="menu-btn" onClick={() => setSidebarOpen(true)} title="Chat history">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="3" y1="12" x2="21" y2="12"/>
            <line x1="3" y1="6" x2="21" y2="6"/>
            <line x1="3" y1="18" x2="21" y2="18"/>
          </svg>
        </button>
        <span className="chat-title">{currentChatName || 'New Chat'}</span>
        <span className="chat-badge">{chats.length} chats</span>
      </div>

      <MessageList messages={messages} isTyping={isSending} />
      <ChatInput onSend={handleSend} disabled={isSending} />
    </div>
  );
}
