import './MessageBubble.css';

export default function MessageBubble({ message }) {
  const isUser = message.role === 'user';
  const time = message.created_at
    ? new Date(message.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : '';

  return (
    <div className={`message-row ${isUser ? 'user' : 'assistant'}`}>
      <div className={`message-bubble ${isUser ? 'user-bubble' : 'ai-bubble'}`}>
        <div className="message-content">
          {message.image_data && (
            <img src={message.image_data} alt="Uploaded" className="message-image" />
          )}
          <p>{message.content}</p>
        </div>
        {time && <span className="message-time">{time}</span>}
      </div>
    </div>
  );
}
