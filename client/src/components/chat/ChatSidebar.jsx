import { useChat } from '../../contexts/ChatContext';
import './ChatSidebar.css';

export default function ChatSidebar({ isOpen, onClose }) {
  const { chats, currentChatId, selectChat, removeChat } = useChat();

  const handleDelete = (e, chatId) => {
    e.stopPropagation();
    if (confirm('Delete this chat?')) {
      removeChat(chatId);
    }
  };

  return (
    <>
      <div className={`chat-sidebar ${isOpen ? 'open' : ''}`}>
        <div className="sidebar-head">
          <h3>Chats</h3>
          <button className="sidebar-close" onClick={onClose}>&times;</button>
        </div>
        <div className="sidebar-list">
          {chats.length === 0 ? (
            <div className="sidebar-empty">No chats yet. Send a message to start!</div>
          ) : (
            chats.map((chat) => (
              <div
                key={chat.id}
                className={`sidebar-item ${chat.id === currentChatId ? 'active' : ''}`}
                onClick={() => { selectChat(chat.id); onClose(); }}
              >
                <span className="sidebar-item-name">{chat.name}</span>
                <button
                  className="sidebar-item-delete"
                  onClick={(e) => handleDelete(e, chat.id)}
                  title="Delete chat"
                >
                  &times;
                </button>
              </div>
            ))
          )}
        </div>
      </div>
      {isOpen && <div className="sidebar-overlay" onClick={onClose} />}
    </>
  );
}
