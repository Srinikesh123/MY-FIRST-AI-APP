import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuth } from './AuthContext';
import * as userQ from '../queries/userQueries';

const UserContext = createContext(null);

export function UserProvider({ children }) {
  const { user, supabase } = useAuth();
  const [userInfo, setUserInfo] = useState(null);
  const [loading, setLoading] = useState(true);

  const refreshUser = useCallback(async () => {
    if (!user?.id) { setLoading(false); return; }
    try {
      const info = await userQ.loadUserInfo(supabase, user.id);
      setUserInfo(info);
    } catch (err) {
      console.error('Failed to load user info:', err);
    } finally {
      setLoading(false);
    }
  }, [user, supabase]);

  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  const value = {
    userInfo,
    loading,
    refreshUser,
    plan: userInfo?.plan || 'free',
    coins: userInfo?.coins || 0,
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
