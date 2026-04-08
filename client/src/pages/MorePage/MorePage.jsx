import { useNavigate } from 'react-router-dom';
import './MorePage.css';

const features = [
  { label: 'AI Chat', desc: 'Talk to your AI assistant', icon: '💬', path: '/', color: '#667eea' },
  { label: 'Chats', desc: 'Messages & friends', icon: '👥', path: '/chats', color: '#22c55e' },
  { label: 'Meeting', desc: 'Host or join meetings', icon: '📹', path: '/meeting', color: '#3b82f6' },
  { label: 'Games', desc: 'Play & earn coins', icon: '🎮', path: '/games', color: '#f59e0b' },
  { label: 'Shop', desc: 'Upgrade your plan', icon: '🛒', path: '/shop', color: '#ef4444' },
  { label: 'My Book', desc: 'Saved pages & memories', icon: '📖', path: '/book', color: '#764ba2' },
];

export default function MorePage() {
  const navigate = useNavigate();

  return (
    <div className="more-page">
      <div className="more-header">
        <h2>All Features</h2>
        <p>Explore everything voidzenzi has to offer</p>
      </div>
      <div className="more-grid">
        {features.map((f) => (
          <button
            key={f.path}
            className="feature-card"
            onClick={() => navigate(f.path)}
            style={{ '--feature-color': f.color }}
          >
            <div className="feature-icon-wrap">
              <span className="feature-icon">{f.icon}</span>
            </div>
            <span className="feature-label">{f.label}</span>
            <span className="feature-desc">{f.desc}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
