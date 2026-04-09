import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuth } from './AuthContext';

const SettingsContext = createContext(null);

const DEFAULT_SETTINGS = {
  theme: 'normal',
  accentColor: 'blue',
  fontSize: 'medium',
  fontStyle: 'system',
  bubbleStyle: 'rounded',
  messageAlignment: 'centered',
  typingIndicator: true,
  sendButtonStyle: 'icon',
  showTimestamps: false,
  autoScroll: true,
  soundEffects: false,
  animations: true,
  compactMode: false,
  sidebarOpen: true,
  model: 'default',
  temperature: 0.7,
  systemPrompt: '',
  enabledTools: [],
  responseStyle: 'balanced',
  simpleLanguage: false,
  chatMode: 'fast',
  typingEffect: true,
  mood: 'friendly',
  errorFreeMode: true,
  ttsEnabled: false,
  ttsVoice: 'female',
  imageMode: false,
  imageModeType: 'normal',
};

export function SettingsProvider({ children }) {
  const { user, supabase } = useAuth();
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!user) return;
    loadSettings();
  }, [user]);

  useEffect(() => {
    applySettings(settings);
  }, [settings]);

  async function loadSettings() {
    try {
      const res = await fetch(`/api/settings?userId=${user.id}`);
      if (res.ok) {
        const data = await res.json();
        if (data?.settings) setSettings({ ...DEFAULT_SETTINGS, ...data.settings });
      }
    } catch (err) {
      console.error('Failed to load settings:', err);
    } finally {
      setLoaded(true);
    }
  }

  const updateSetting = useCallback(async (key, value) => {
    setSettings(prev => {
      const updated = { ...prev, [key]: value };
      if (user) {
        fetch('/api/settings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: user.id, settings: updated }),
        }).catch(err => console.error('Failed to save setting:', err));
      }
      return updated;
    });
  }, [user]);

  function applySettings(s) {
    const body = document.body;
    body.classList.remove('theme-light', 'theme-dark', 'theme-normal');
    if (s.theme === 'dark') body.classList.add('theme-dark');
    else if (s.theme === 'light') body.classList.add('theme-light');

    body.classList.remove('font-small', 'font-medium', 'font-large');
    body.classList.add(`font-${s.fontSize}`);

    if (!s.animations) body.classList.add('no-animations');
    else body.classList.remove('no-animations');
  }

  const value = { settings, updateSetting, loaded, DEFAULT_SETTINGS };

  return (
    <SettingsContext.Provider value={value}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
}
