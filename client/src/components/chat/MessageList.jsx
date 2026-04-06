import { useRef, useEffect } from 'react';
import MessageBubble from './MessageBubble';
import './MessageList.css';

export default function MessageList({ messages, isTyping }) {
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  if (messages.length === 0) {
    return (
      <div className="message-list-empty">
        <div className="welcome-icon">💬</div>
        <h3>Welcome to voidzenzi</h3>
        <p>Send a message to start chatting with AI</p>
      </div>
    );
  }

  return (
    <div className="message-list">
      {messages.map((msg) => (
        <MessageBubble key={msg.id} message={msg} />
      ))}
      {isTyping && (
        <div className="typing-indicator">
          <span className="dot" />
          <span className="dot" />
          <span className="dot" />
        </div>
      )}
      <div ref={bottomRef} />
    </div>
  );
}
