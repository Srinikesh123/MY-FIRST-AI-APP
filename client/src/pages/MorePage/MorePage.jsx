import { useNavigate } from 'react-router-dom';
import './MorePage.css';

const features = [
  { label: 'AI Chat', icon: '💬', path: '/', color: '#667eea' },
  { label: 'Chats', icon: '👥', path: '/chats', color: '#22c55e' },
  { label: 'Games', icon: '🎮', path: '/games', color: '#f59e0b' },
  { label: 'Shop', icon: '🛒', path: '/shop', color: '#ef4444' },
  { label: 'My Book', icon: '📖', path: '/book', color: '#764ba2' },
  { label: 'Admin', icon: '🔧', path: '/admin', color: '#6b7280' },
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
            <span className="feature-icon">{f.icon}</span>
            <span className="feature-label">{f.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
