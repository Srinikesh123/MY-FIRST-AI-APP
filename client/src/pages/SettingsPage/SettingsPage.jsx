import { useNavigate } from 'react-router-dom';
import { useSettings } from '../../contexts/SettingsContext';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../components/ui/Toast';
import ToggleSwitch from '../../components/ui/ToggleSwitch';
import RadioGroup from '../../components/ui/RadioGroup';
import './SettingsPage.css';

export default function SettingsPage() {
  const { settings, updateSetting } = useSettings();
  const { user, signOut, supabase } = useAuth();
  const navigate = useNavigate();
  const { success, error: showError, confirm: showConfirm } = useToast();

  const handleDeleteAllChats = async () => {
    const ok = await showConfirm('Delete ALL chats and messages? This cannot be undone.', 'Delete Chats');
    if (!ok) return;
    try {
      await supabase.from('messages').delete().eq('user_id', user.id);
      await supabase.from('chats').delete().eq('user_id', user.id);
      success('All chats deleted');
    } catch (err) {
      showError('Failed to delete chats: ' + err.message);
    }
  };

  const handleDeleteAccount = async () => {
    const ok = await showConfirm('PERMANENTLY delete your account and all data? This cannot be undone!', 'Delete Account');
    if (!ok) return;
    try {
      await fetch(`/api/users/delete`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id }),
      });
      await signOut();
      navigate('/login');
    } catch (err) {
      showError('Failed to delete account: ' + err.message);
    }
  };

  return (
    <div className="settings-page">
      <div className="settings-header">
        <h2>Settings</h2>
      </div>

      {/* Appearance */}
      <section className="settings-section">
        <h3>Appearance</h3>
        <RadioGroup
          label="Theme"
          name="theme"
          value={settings.theme}
          onChange={(v) => updateSetting('theme', v)}
          options={[
            { value: 'light', label: 'Light' },
            { value: 'dark', label: 'Dark' },
            { value: 'normal', label: 'Normal' },
          ]}
        />
        <RadioGroup
          label="Accent Color"
          name="accentColor"
          value={settings.accentColor}
          onChange={(v) => updateSetting('accentColor', v)}
          options={[
            { value: 'blue', label: 'Blue' },
            { value: 'green', label: 'Green' },
            { value: 'purple', label: 'Purple' },
            { value: 'orange', label: 'Orange' },
          ]}
        />
        <RadioGroup
          label="Font Size"
          name="fontSize"
          value={settings.fontSize}
          onChange={(v) => updateSetting('fontSize', v)}
          options={[
            { value: 'small', label: 'Small' },
            { value: 'medium', label: 'Medium' },
            { value: 'large', label: 'Large' },
          ]}
        />
        <div className="setting-select-group">
          <label>Font Style</label>
          <select
            value={settings.fontStyle}
            onChange={(e) => updateSetting('fontStyle', e.target.value)}
            className="setting-select"
          >
            <option value="system">System (default)</option>
            <option value="rounded">Rounded</option>
            <option value="mono">Mono</option>
          </select>
        </div>
      </section>

      {/* Chat UI */}
      <section className="settings-section">
        <h3>Chat UI</h3>
        <RadioGroup
          label="Bubble Style"
          name="bubbleStyle"
          value={settings.bubbleStyle}
          onChange={(v) => updateSetting('bubbleStyle', v)}
          options={[
            { value: 'rounded', label: 'Rounded' },
            { value: 'sharp', label: 'Sharp' },
            { value: 'flat', label: 'Flat' },
          ]}
        />
        <RadioGroup
          label="Message Alignment"
          name="messageAlignment"
          value={settings.messageAlignment}
          onChange={(v) => updateSetting('messageAlignment', v)}
          options={[
            { value: 'centered', label: 'Centered' },
            { value: 'left', label: 'Left-aligned' },
          ]}
        />
        <ToggleSwitch
          label="Typing Indicator"
          description='Show "AI is thinking..." animation'
          checked={settings.typingIndicator}
          onChange={(v) => updateSetting('typingIndicator', v)}
        />
        <RadioGroup
          label="Send Button Style"
          name="sendButtonStyle"
          value={settings.sendButtonStyle}
          onChange={(v) => updateSetting('sendButtonStyle', v)}
          options={[
            { value: 'icon', label: 'Icon only' },
            { value: 'text', label: 'Text' },
            { value: 'both', label: 'Both' },
          ]}
        />
        <ToggleSwitch
          label="Show Timestamps"
          description="Display time on messages"
          checked={settings.showTimestamps}
          onChange={(v) => updateSetting('showTimestamps', v)}
        />
        <ToggleSwitch
          label="Auto-Scroll"
          description="Automatically scroll to new messages"
          checked={settings.autoScroll}
          onChange={(v) => updateSetting('autoScroll', v)}
        />
      </section>

      {/* Feedback & Feel */}
      <section className="settings-section">
        <h3>Feedback & Feel</h3>
        <ToggleSwitch
          label="Sound Effects"
          description="Play sounds for sent messages and AI replies"
          checked={settings.soundEffects}
          onChange={(v) => updateSetting('soundEffects', v)}
        />
        <ToggleSwitch
          label="Animations"
          description="Smooth message pop-in animations"
          checked={settings.animations}
          onChange={(v) => updateSetting('animations', v)}
        />
        <ToggleSwitch
          label="Compact Mode"
          description="Smaller padding, more text visible"
          checked={settings.compactMode}
          onChange={(v) => updateSetting('compactMode', v)}
        />
      </section>

      {/* Preferences */}
      <section className="settings-section">
        <h3>Preferences</h3>
        <ToggleSwitch
          label="Simple Language Mode"
          description="Get responses in simpler, easier-to-understand language"
          checked={settings.simpleLanguage}
          onChange={(v) => updateSetting('simpleLanguage', v)}
        />
        <ToggleSwitch
          label="Read Responses Aloud"
          description="Use a professional AI-style voice to speak answers"
          checked={settings.ttsEnabled}
          onChange={(v) => updateSetting('ttsEnabled', v)}
        />
        <RadioGroup
          label="Voice"
          name="ttsVoice"
          value={settings.ttsVoice}
          onChange={(v) => updateSetting('ttsVoice', v)}
          options={[
            { value: 'female', label: 'Female' },
            { value: 'male', label: 'Male' },
          ]}
          description="Choose between a male or female professional voice"
        />
        <ToggleSwitch
          label="Picture Mode"
          description="Prompts will create AI-generated pictures instead of text"
          checked={settings.imageMode}
          onChange={(v) => updateSetting('imageMode', v)}
        />
        <RadioGroup
          label="Picture Mode Type"
          name="imageModeType"
          value={settings.imageModeType}
          onChange={(v) => updateSetting('imageModeType', v)}
          options={[
            { value: 'normal', label: 'Normal Pictures' },
            { value: 'emoji', label: 'Emoji Pictures' },
          ]}
          description="Choose the style of picture generation"
        />
        <RadioGroup
          label="Response Mode"
          name="chatMode"
          value={settings.chatMode}
          onChange={(v) => updateSetting('chatMode', v)}
          options={[
            { value: 'fast', label: 'Fast' },
            { value: 'detailed', label: 'Detailed' },
            { value: 'coding', label: 'Coding' },
          ]}
          description="Choose how the AI should answer: quick, detailed, or focused on code"
        />
        <RadioGroup
          label="Reply Mood"
          name="mood"
          value={settings.mood}
          onChange={(v) => updateSetting('mood', v)}
          options={[
            { value: 'friendly', label: 'Friendly' },
            { value: 'serious', label: 'Serious' },
            { value: 'funny', label: 'Funny' },
            { value: 'calm', label: 'Calm' },
          ]}
          description="Pick the personality the AI should use when replying"
        />
        <ToggleSwitch
          label="Typing Effect"
          description="AI text appears like it is being typed out"
          checked={settings.typingEffect}
          onChange={(v) => updateSetting('typingEffect', v)}
        />
        <ToggleSwitch
          label="Error-Free Mode"
          description="If unsure, AI will say it doesn't know yet but will explain what it can."
          checked={settings.errorFreeMode}
          onChange={(v) => updateSetting('errorFreeMode', v)}
        />
      </section>

      {/* Actions */}
      <section className="settings-section settings-actions-section">
        <h3>Actions</h3>
        <button className="btn-danger" onClick={handleDeleteAllChats}>
          Delete All Chats
        </button>
        <button className="btn-danger" onClick={handleDeleteAccount}>
          Delete Account
        </button>
        <small className="danger-warning">
          Warning: These actions are permanent and cannot be undone.
        </small>
      </section>

      <div className="settings-footer">
        <button className="btn-back" onClick={() => navigate('/')}>
          Back to Chat
        </button>
      </div>
    </div>
  );
}
