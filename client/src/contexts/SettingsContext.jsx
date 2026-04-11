import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
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
  const settingsRef = useRef(DEFAULT_SETTINGS);

  // Keep ref in sync so updateSetting always has the latest values
  useEffect(() => { settingsRef.current = settings; }, [settings]);

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

  const updateSetting = useCallback((key, value) => {
    const updated = { ...settingsRef.current, [key]: value };
    setSettings(updated);
    if (user) {
      fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, settings: updated }),
      }).catch(err => console.error('Failed to save setting:', err));
    }
  }, [user]);

  function applySettings(s) {
    const body = document.body;

    // Theme
    body.classList.remove('theme-light', 'theme-dark', 'theme-normal');
    if (s.theme === 'dark') body.classList.add('theme-dark');
    else if (s.theme === 'light') body.classList.add('theme-light');

    // Font size
    body.classList.remove('font-small', 'font-medium', 'font-large');
    body.classList.add(`font-${s.fontSize}`);

    // Font style
    body.classList.remove('font-system', 'font-rounded', 'font-mono');
    body.classList.add(`font-${s.fontStyle || 'system'}`);

    // Accent color — set CSS custom property
    const accentMap = {
      blue: '#667eea',
      green: '#22c55e',
      purple: '#764ba2',
      orange: '#f59e0b',
    };
    document.documentElement.style.setProperty('--accent-active', accentMap[s.accentColor] || accentMap.blue);

    // Bubble style
    body.classList.remove('bubble-rounded', 'bubble-sharp', 'bubble-flat');
    body.classList.add(`bubble-${s.bubbleStyle || 'rounded'}`);

    // Message alignment
    body.classList.remove('msg-centered', 'msg-left');
    body.classList.add(`msg-${s.messageAlignment || 'centered'}`);

    // Compact mode
    if (s.compactMode) body.classList.add('compact-mode');
    else body.classList.remove('compact-mode');

    // Animations
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
