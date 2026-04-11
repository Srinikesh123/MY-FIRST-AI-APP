import { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../components/ui/Toast';
import { api } from '../../services/api';
import PageHeader from '../../components/ui/PageHeader';
import './AdminPage.css';

export default function AdminPage() {
  const { user } = useAuth();
  const [authenticated, setAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { error: showError } = useToast();

  const handleAuth = () => {
    if (password === 'srinikesh') {
      setAuthenticated(true);
      setError('');
      loadUsers();
    } else {
      setError('Incorrect password');
    }
  };

  const loadUsers = async () => {
    setLoading(true);
    try {
      const data = await api.get(`/admin/users?userId=${user.id}`);
      setUsers(data.users || data || []);
    } catch (err) {
      console.error('Failed to load users:', err);
    } finally {
      setLoading(false);
    }
  };

  const updateUser = async (targetUserId, field, value) => {
    try {
      await api.post('/admin/update-user', { adminUserId: user.id, userId: targetUserId, [field]: value });
      await loadUsers();
    } catch (err) {
      showError('Failed to update: ' + err.message);
    }
  };

  if (!authenticated) {
    return (
      <div className="admin-page">
        <PageHeader title="Admin Panel" />
        <div className="admin-auth">
          <p>Enter the admin password to continue.</p>
          {error && <div className="admin-error">{error}</div>}
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAuth()}
            placeholder="Password"
            className="admin-password-input"
          />
          <button onClick={handleAuth} className="admin-auth-btn">Enter</button>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-page">
      <PageHeader title="Admin Panel" subtitle={`${users.length} users`} />

      {loading ? (
        <div className="admin-loading">Loading users...</div>
      ) : (
        <div className="admin-users">
          {users.map(u => (
            <div key={u.id} className="admin-user-card">
              <div className="user-card-header">
                <div className="user-card-avatar">{u.username?.[0]?.toUpperCase() || '?'}</div>
                <div className="user-card-info">
                  <span className="user-card-name">{u.username || 'Unknown'}</span>
                  <span className="user-card-email">{u.email}</span>
                </div>
              </div>
              <div className="user-card-meta">
                <span>Plan: <strong>{u.plan || 'free'}</strong></span>
                <span>Coins: <strong>{u.coins || 0}</strong></span>
                <span>Admin: <strong>{u.is_admin ? 'Yes' : 'No'}</strong></span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
