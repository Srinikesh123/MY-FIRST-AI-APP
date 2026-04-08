import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuth } from './AuthContext';

const UserContext = createContext(null);

export function UserProvider({ children }) {
  const { user } = useAuth();
  const [userInfo, setUserInfo] = useState(null);
  const [loading, setLoading] = useState(true);

  const refreshUser = useCallback(async () => {
    if (!user?.id) {
      setLoading(false);
      setUserInfo(null);
      return;
    }
    try {
      // Use server endpoint — bypasses Supabase RLS with service role key
      const res = await fetch(`/api/users/me?userId=${user.id}`);
      if (!res.ok) throw new Error('Failed to load user');
      const data = await res.json();
      setUserInfo(data);
    } catch (err) {
      console.error('Failed to load user info:', err);
      // Fallback: at least show email-derived username
      setUserInfo({ plan: 'free', coins: 0, is_admin: false });
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    setLoading(true);
    refreshUser();
  }, [refreshUser]);

  const value = {
    userInfo,
    loading,
    refreshUser,
    plan: userInfo?.plan || 'free',
    coins: userInfo?.coins ?? 0,
    username: userInfo?.username || user?.email?.split('@')[0] || 'User',
    avatarUrl: userInfo?.avatar_url || null,
    isAdmin: userInfo?.is_admin || false,
  };

  return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
}

export function useUser() {
  const context = useContext(UserContext);
  if (!context) throw new Error('useUser must be used within a UserProvider');
  return context;
}
