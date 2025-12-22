// AI Assistant Application - Frontend
class AIAssistant {
    constructor() {
        this.sessionId = this.generateSessionId();
        this.simpleLanguage = false;
        this.apiUrl = 'http://localhost:3000/api';
        this.settings = this.getDefaultSettings();
        this.supabase = window.__supabaseClient || null;
        this.user = window.__currentUser || null;
        this.userId = this.user ? this.user.id : null;
        this.ttsSupported = false;
        this.ttsVoices = [];
        this.currentUtterance = null;
        this.recognition = null;
        this.isDictating = false;
        
        // Debug Supabase connection
        if (this.supabase && this.userId) {
            console.log('Supabase connected. User ID:', this.userId);
        } else {
            console.warn('Supabase not connected or user not logged in');
        }
        
        this.initializeElements();
        this.setupEventListeners();
        this.loadSettings();
        this.applySettings();
        this.initTextToSpeech();
        this.initSpeechRecognition();
        this.checkServerHealth();
    }


    getDefaultSettings() {
        return {
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
            simpleLanguage: false,
            chatMode: 'fast', // fast, detailed, coding
            typingEffect: true,
            mood: 'friendly', // friendly, serious, funny, calm
            errorFreeMode: true,
            ttsEnabled: false,
            ttsVoice: 'female',
            imageMode: false
        };
    }

    generateSessionId() {
        return 'session-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
    }

    initializeElements() {
        // Views
        this.chatView = document.getElementById('chatView');
        this.settingsView = document.getElementById('settingsView');
        
        if (!this.chatView || !this.settingsView) {
            console.error('Critical elements not found!');
            return;
        }
        
        // Chat elements
        this.chatContainer = document.getElementById('chatContainer');
        this.userInput = document.getElementById('userInput');
        this.sendButton = document.getElementById('sendButton');
        this.voiceInputBtn = document.getElementById('voiceInputBtn');
        this.simpleLanguageToggle = document.getElementById('simpleLanguage');
        
        // Navigation
        this.newChatBtn = document.getElementById('newChatBtn');
        this.settingsBtn = document.getElementById('settingsBtn');
        this.backToChatBtn = document.getElementById('backToChatBtn');
        this.clearChatBtn = document.getElementById('clearChatBtn');
        
        // Settings elements
        this.settingsSimpleLanguage = document.getElementById('settingsSimpleLanguage');
        this.saveSettingsBtn = document.getElementById('saveSettingsBtn');
        this.settingsMessage = document.getElementById('settingsMessage');
        this.settingsTTSEnabled = document.getElementById('ttsEnabled');
        this.settingsTTSVoiceRadios = document.querySelectorAll('input[name="ttsVoice"]');
        this.settingsImageMode = document.getElementById('imageMode');
        this.settingsChatModeRadios = document.querySelectorAll('input[name="chatMode"]');
        this.settingsTypingEffect = document.getElementById('typingEffect');
        this.settingsErrorFreeMode = document.getElementById('errorFreeMode');
        this.settingsMoodRadios = document.querySelectorAll('input[name="mood"]');
        
        // Check critical elements
        if (!this.chatContainer || !this.userInput || !this.sendButton) {
            console.error('Critical chat elements not found!');
        }
    }

    setupEventListeners() {
        // Chat
        if (this.sendButton) {
            this.sendButton.addEventListener('click', () => this.handleSend());
        }
        if (this.userInput) {
            this.userInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    this.handleSend();
                }
            });
        }
        if (this.simpleLanguageToggle) {
            this.simpleLanguageToggle.addEventListener('change', (e) => {
                this.simpleLanguage = e.target.checked;
                this.settings.simpleLanguage = this.simpleLanguage;
                this.saveSettings();
            });
        }

        // Voice input (speech-to-text)
        if (this.voiceInputBtn) {
            this.voiceInputBtn.addEventListener('click', () => this.toggleDictation());
        }

        // Navigation
        if (this.newChatBtn) {
            this.newChatBtn.addEventListener('click', () => this.newChat());
        }
        if (this.settingsBtn) {
            this.settingsBtn.addEventListener('click', () => this.showSettings());
        }
        if (this.backToChatBtn) {
            this.backToChatBtn.addEventListener('click', () => this.showChat());
        }
        if (this.clearChatBtn) {
            this.clearChatBtn.addEventListener('click', () => this.clearChat());
        }
        
        // Settings save button
        if (this.saveSettingsBtn) {
            this.saveSettingsBtn.addEventListener('click', () => this.saveSettings());
        }
        
        // Settings save button
        if (this.saveSettingsBtn) {
            this.saveSettingsBtn.addEventListener('click', () => this.saveSettings());
        }

        // Settings - Theme
        document.querySelectorAll('input[name="theme"]').forEach(radio => {
            radio.addEventListener('change', () => this.handleSettingChange('theme', radio.value));
        });

        // Settings - Accent Color
        document.querySelectorAll('input[name="accentColor"]').forEach(radio => {
            radio.addEventListener('change', () => this.handleSettingChange('accentColor', radio.value));
        });

        // Settings - Font Size
        document.querySelectorAll('input[name="fontSize"]').forEach(radio => {
            radio.addEventListener('change', () => this.handleSettingChange('fontSize', radio.value));
        });

        // Settings - Font Style
        const fontStyleEl = document.getElementById('fontStyle');
        if (fontStyleEl) {
            fontStyleEl.addEventListener('change', (e) => {
                this.handleSettingChange('fontStyle', e.target.value);
            });
        }

        // Settings - Bubble Style
        document.querySelectorAll('input[name="bubbleStyle"]').forEach(radio => {
            radio.addEventListener('change', () => this.handleSettingChange('bubbleStyle', radio.value));
        });

        // Settings - Message Alignment
        document.querySelectorAll('input[name="messageAlignment"]').forEach(radio => {
            radio.addEventListener('change', () => this.handleSettingChange('messageAlignment', radio.value));
        });

        // Settings - Send Button Style
        document.querySelectorAll('input[name="sendButtonStyle"]').forEach(radio => {
            radio.addEventListener('change', () => this.handleSettingChange('sendButtonStyle', radio.value));
        });

        // Settings - Toggles
        const typingIndicatorEl = document.getElementById('typingIndicator');
        if (typingIndicatorEl) {
            typingIndicatorEl.addEventListener('change', (e) => {
                this.handleSettingChange('typingIndicator', e.target.checked);
            });
        }
        const showTimestampsEl = document.getElementById('showTimestamps');
        if (showTimestampsEl) {
            showTimestampsEl.addEventListener('change', (e) => {
                this.handleSettingChange('showTimestamps', e.target.checked);
            });
        }
        const autoScrollEl = document.getElementById('autoScroll');
        if (autoScrollEl) {
            autoScrollEl.addEventListener('change', (e) => {
                this.handleSettingChange('autoScroll', e.target.checked);
            });
        }
        const soundEffectsEl = document.getElementById('soundEffects');
        if (soundEffectsEl) {
            soundEffectsEl.addEventListener('change', (e) => {
                this.handleSettingChange('soundEffects', e.target.checked);
            });
        }
        const animationsEl = document.getElementById('animations');
        if (animationsEl) {
            animationsEl.addEventListener('change', (e) => {
                this.handleSettingChange('animations', e.target.checked);
            });
        }
        const compactModeEl = document.getElementById('compactMode');
        if (compactModeEl) {
            compactModeEl.addEventListener('change', (e) => {
                this.handleSettingChange('compactMode', e.target.checked);
            });
        }
        const settingsSimpleLanguageEl = document.getElementById('settingsSimpleLanguage');
        if (settingsSimpleLanguageEl) {
            settingsSimpleLanguageEl.addEventListener('change', (e) => {
                this.simpleLanguage = e.target.checked;
                this.settings.simpleLanguage = e.target.checked;
                if (this.simpleLanguageToggle) {
                    this.simpleLanguageToggle.checked = e.target.checked;
                }
            });
        }

        // Settings - Text to Speech
        const ttsEnabledEl = document.getElementById('ttsEnabled');
        if (ttsEnabledEl) {
            ttsEnabledEl.addEventListener('change', (e) => {
                this.handleSettingChange('ttsEnabled', e.target.checked);
            });
        }
        document.querySelectorAll('input[name="ttsVoice"]').forEach(radio => {
            radio.addEventListener('change', () => this.handleSettingChange('ttsVoice', radio.value));
        });

        const imageModeEl = document.getElementById('imageMode');
        if (imageModeEl) {
            imageModeEl.addEventListener('change', (e) => {
                this.handleSettingChange('imageMode', e.target.checked);
            });
        }

        // Settings - Chat Mode
        if (this.settingsChatModeRadios && this.settingsChatModeRadios.length) {
            this.settingsChatModeRadios.forEach(radio => {
                radio.addEventListener('change', () => this.handleSettingChange('chatMode', radio.value));
            });
        }

        if (this.settingsTypingEffect) {
            this.settingsTypingEffect.addEventListener('change', (e) => {
                this.handleSettingChange('typingEffect', e.target.checked);
            });
        }

        if (this.settingsErrorFreeMode) {
            this.settingsErrorFreeMode.addEventListener('change', (e) => {
                this.handleSettingChange('errorFreeMode', e.target.checked);
            });
        }

        if (this.settingsMoodRadios && this.settingsMoodRadios.length) {
            this.settingsMoodRadios.forEach(radio => {
                radio.addEventListener('change', () => this.handleSettingChange('mood', radio.value));
            });
        }

    }

    initSpeechRecognition() {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) {
            console.warn('Speech recognition is not supported in this browser.');
            return;
        }

        this.recognition = new SpeechRecognition();
        this.recognition.lang = 'en-US';
        this.recognition.continuous = false;
        this.recognition.interimResults = false;

        this.recognition.onstart = () => {
            this.isDictating = true;
            if (this.voiceInputBtn) {
                this.voiceInputBtn.classList.add('recording');
            }
        };

        this.recognition.onend = () => {
            this.isDictating = false;
            if (this.voiceInputBtn) {
                this.voiceInputBtn.classList.remove('recording');
            }
        };

        this.recognition.onerror = () => {
            this.isDictating = false;
            if (this.voiceInputBtn) {
                this.voiceInputBtn.classList.remove('recording');
            }
        };

        this.recognition.onresult = (event) => {
            const transcript = Array.from(event.results)
                .map(result => result[0].transcript)
                .join(' ')
                .trim();

            if (this.userInput && transcript) {
                this.userInput.value = transcript;
                this.handleSend();
            }
        };
    }

    toggleDictation() {
        if (!this.recognition) {
            alert('Voice input is not supported in this browser.');
            return;
        }

        try {
            if (this.isDictating) {
                this.recognition.stop();
            } else {
                this.recognition.start();
            }
        } catch (e) {
            console.error('Speech recognition error:', e);
        }
    }

    initTextToSpeech() {
        this.ttsSupported = 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window;
        this.currentUtterance = null;
        this.ttsVoices = [];

        if (!this.ttsSupported) {
            console.warn('Text-to-speech is not supported in this browser.');
            return;
        }

        const loadVoices = () => {
            this.ttsVoices = window.speechSynthesis.getVoices();
        };

        loadVoices();

        if (typeof window.speechSynthesis.onvoiceschanged !== 'undefined') {
            window.speechSynthesis.onvoiceschanged = loadVoices;
        }
    }

    getPreferredVoice() {
        if (!this.ttsSupported) return null;
        const voices = this.ttsVoices && this.ttsVoices.length ? this.ttsVoices : window.speechSynthesis.getVoices();
        if (!voices || !voices.length) return null;

        const preferredGender = this.settings.ttsVoice || 'female';
        const lowerGender = preferredGender.toLowerCase();

        // Try to choose a professional-sounding English voice by common name patterns
        const englishVoices = voices.filter(v => (v.lang || '').toLowerCase().startsWith('en'));

        const femalePreferredNames = ['female', 'samantha', 'google uk english female', 'zira', 'aria', 'jenny'];
        const malePreferredNames = ['male', 'google uk english male', 'david', 'guy', 'ryan'];

        const preferredList = lowerGender === 'female' ? femalePreferredNames : malePreferredNames;

        const matchByName = (list) => {
            const lowerList = list.map(n => n.toLowerCase());
            return englishVoices.find(v => lowerList.some(name => v.name.toLowerCase().includes(name)));
        };

        let selected = matchByName(preferredList);
        if (!selected && englishVoices.length) {
            // Fallback: pick first English voice as "professional"
            selected = englishVoices[0];
        }

        return selected || voices[0];
    }

    stripHtml(html) {
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = html;
        return tempDiv.textContent || tempDiv.innerText || '';
    }

    speakText(text) {
        if (!this.ttsSupported || !this.settings.ttsEnabled) return;
        if (!text) return;

        // Stop any current speech
        window.speechSynthesis.cancel();
        this.currentUtterance = null;

        const utterance = new SpeechSynthesisUtterance(this.stripHtml(text));
        const voice = this.getPreferredVoice();
        if (voice) {
            utterance.voice = voice;
        }

        // Professional-style voice settings
        utterance.rate = 1.0;
        utterance.pitch = 1.0;
        utterance.volume = 1.0;

        this.currentUtterance = utterance;
        window.speechSynthesis.speak(utterance);
    }

    stopSpeaking() {
        if (!this.ttsSupported) return;
        window.speechSynthesis.cancel();
        this.currentUtterance = null;
    }

    attachTTSControls(contentDiv, plainText) {
        // No controls needed anymore – speech is automatic when enabled
        if (this.settings.ttsEnabled && plainText) {
            this.speakText(plainText);
        }
    }

    handleSettingChange(key, value) {
        this.settings[key] = value;
        this.applySettings();
    }

    showChat() {
        this.chatView.classList.add('active');
        this.settingsView.classList.remove('active');
        this.userInput.focus();
    }

    showSettings() {
        this.chatView.classList.remove('active');
        this.settingsView.classList.add('active');
        this.loadSettingsToForm();
    }

    newChat() {
        this.sessionId = this.generateSessionId();
        if (this.chatContainer) {
            this.chatContainer.innerHTML = `
                <div class="welcome-message">
                    <p>Hello! I'm your AI assistant. I'm here to help with clear, honest answers.</p>
                    <p>Ask me anything, and I'll do my best to help you.</p>
                </div>
            `;
        }
        if (this.userInput) {
            this.userInput.value = '';
            this.userInput.focus();
        }
    }

    clearChat() {
        if (confirm('Are you sure you want to clear all chat history? This cannot be undone.')) {
            this.newChat();
        }
    }

    loadSettings() {
        const saved = localStorage.getItem('aiAssistantSettings');
        if (saved) {
            this.settings = { ...this.getDefaultSettings(), ...JSON.parse(saved) };
        }
        this.simpleLanguage = this.settings.simpleLanguage;
        this.simpleLanguageToggle.checked = this.simpleLanguage;
    }

    loadSettingsToForm() {
        // Theme
        document.getElementById(`theme${this.settings.theme.charAt(0).toUpperCase() + this.settings.theme.slice(1)}`).checked = true;
        
        // Accent Color
        document.getElementById(`accent${this.settings.accentColor.charAt(0).toUpperCase() + this.settings.accentColor.slice(1)}`).checked = true;
        
        // Font Size
        document.getElementById(`font${this.settings.fontSize.charAt(0).toUpperCase() + this.settings.fontSize.slice(1)}`).checked = true;
        
        // Font Style
        document.getElementById('fontStyle').value = this.settings.fontStyle;
        
        // Bubble Style
        document.getElementById(`bubble${this.settings.bubbleStyle.charAt(0).toUpperCase() + this.settings.bubbleStyle.slice(1)}`).checked = true;
        
        // Message Alignment
        document.getElementById(`align${this.settings.messageAlignment.charAt(0).toUpperCase() + this.settings.messageAlignment.slice(1)}`).checked = true;
        
        // Send Button Style
        document.getElementById(`send${this.settings.sendButtonStyle.charAt(0).toUpperCase() + this.settings.sendButtonStyle.slice(1)}`).checked = true;
        
        // Toggles
        document.getElementById('typingIndicator').checked = this.settings.typingIndicator;
        document.getElementById('showTimestamps').checked = this.settings.showTimestamps;
        document.getElementById('autoScroll').checked = this.settings.autoScroll;
        document.getElementById('soundEffects').checked = this.settings.soundEffects;
        document.getElementById('animations').checked = this.settings.animations;
        document.getElementById('compactMode').checked = this.settings.compactMode;
        document.getElementById('settingsSimpleLanguage').checked = this.settings.simpleLanguage;
        // Text to Speech
        const ttsEnabledEl = document.getElementById('ttsEnabled');
        if (ttsEnabledEl) {
            ttsEnabledEl.checked = this.settings.ttsEnabled;
        }
        const ttsVoiceKey = (this.settings.ttsVoice || 'female');
        const ttsVoiceId = `ttsVoice${ttsVoiceKey.charAt(0).toUpperCase() + ttsVoiceKey.slice(1)}`;
        const ttsVoiceRadio = document.getElementById(ttsVoiceId);
        if (ttsVoiceRadio) {
            ttsVoiceRadio.checked = true;
        }

        const imageModeEl = document.getElementById('imageMode');
        if (imageModeEl) {
            imageModeEl.checked = this.settings.imageMode;
        }

        // Chat mode (fast / detailed / coding)
        if (this.settingsChatModeRadios && this.settingsChatModeRadios.length) {
            this.settingsChatModeRadios.forEach(radio => {
                radio.checked = (radio.value === this.settings.chatMode);
            });
        }

        if (this.settingsTypingEffect) {
            this.settingsTypingEffect.checked = this.settings.typingEffect;
        }

        if (this.settingsErrorFreeMode) {
            this.settingsErrorFreeMode.checked = this.settings.errorFreeMode;
        }

        if (this.settingsMoodRadios && this.settingsMoodRadios.length) {
            this.settingsMoodRadios.forEach(radio => {
                radio.checked = (radio.value === this.settings.mood);
            });
        }
    }

    applySettings() {
        const root = document.documentElement;
        const body = document.body;
        const container = document.querySelector('.container');

        // Theme
        body.className = body.className.replace(/theme-\w+/g, '');
        body.classList.add(`theme-${this.settings.theme}`);

        // Accent Color
        root.className = root.className.replace(/accent-\w+/g, '');
        root.classList.add(`accent-${this.settings.accentColor}`);

        // Font Size
        body.className = body.className.replace(/font-size-\w+/g, '');
        body.classList.add(`font-size-${this.settings.fontSize}`);

        // Font Style
        body.className = body.className.replace(/font-style-\w+/g, '');
        body.classList.add(`font-style-${this.settings.fontStyle}`);

        // Bubble Style
        container.className = container.className.replace(/bubble-\w+/g, '');
        container.classList.add(`bubble-${this.settings.bubbleStyle}`);

        // Message Alignment
        this.chatContainer.className = this.chatContainer.className.replace(/align-\w+/g, '');
        this.chatContainer.classList.add(`align-${this.settings.messageAlignment}`);

        // Animations
        if (!this.settings.animations) {
            body.classList.add('no-animations');
        } else {
            body.classList.remove('no-animations');
        }

        // Compact Mode
        if (this.settings.compactMode) {
            container.classList.add('compact-mode');
        } else {
            container.classList.remove('compact-mode');
        }

        // Send Button Style
        this.updateSendButtonStyle();
    }

    updateSendButtonStyle() {
        const style = this.settings.sendButtonStyle;
        
        if (style === 'text') {
            this.sendButton.innerHTML = '<span class="send-text">Send</span>';
            this.sendButton.style.width = 'auto';
            this.sendButton.style.padding = '0 20px';
        } else if (style === 'both') {
            this.sendButton.innerHTML = `
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <line x1="22" y1="2" x2="11" y2="13"></line>
                    <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
                </svg>
                <span class="send-text">Send</span>
            `;
            this.sendButton.style.width = 'auto';
            this.sendButton.style.padding = '0 16px';
        } else {
            this.sendButton.innerHTML = `
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <line x1="22" y1="2" x2="11" y2="13"></line>
                    <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
                </svg>
            `;
            this.sendButton.style.width = '50px';
            this.sendButton.style.padding = '0';
        }
    }

    saveSettings() {
        // Get all settings from form
        const themeRadio = document.querySelector('input[name="theme"]:checked');
        if (themeRadio) this.settings.theme = themeRadio.value;
        
        const accentRadio = document.querySelector('input[name="accentColor"]:checked');
        if (accentRadio) this.settings.accentColor = accentRadio.value;
        
        const fontSizeRadio = document.querySelector('input[name="fontSize"]:checked');
        if (fontSizeRadio) this.settings.fontSize = fontSizeRadio.value;
        
        const fontStyleSelect = document.getElementById('fontStyle');
        if (fontStyleSelect) this.settings.fontStyle = fontStyleSelect.value;
        
        const bubbleRadio = document.querySelector('input[name="bubbleStyle"]:checked');
        if (bubbleRadio) this.settings.bubbleStyle = bubbleRadio.value;
        
        const alignRadio = document.querySelector('input[name="messageAlignment"]:checked');
        if (alignRadio) this.settings.messageAlignment = alignRadio.value;
        
        const sendBtnRadio = document.querySelector('input[name="sendButtonStyle"]:checked');
        if (sendBtnRadio) this.settings.sendButtonStyle = sendBtnRadio.value;
        
        const typingIndicator = document.getElementById('typingIndicator');
        if (typingIndicator) this.settings.typingIndicator = typingIndicator.checked;
        
        const showTimestamps = document.getElementById('showTimestamps');
        if (showTimestamps) this.settings.showTimestamps = showTimestamps.checked;
        
        const autoScroll = document.getElementById('autoScroll');
        if (autoScroll) this.settings.autoScroll = autoScroll.checked;
        
        const soundEffects = document.getElementById('soundEffects');
        if (soundEffects) this.settings.soundEffects = soundEffects.checked;
        
        const animations = document.getElementById('animations');
        if (animations) this.settings.animations = animations.checked;
        
        const compactMode = document.getElementById('compactMode');
        if (compactMode) this.settings.compactMode = compactMode.checked;
        
        const ttsEnabled = document.getElementById('ttsEnabled');
        if (ttsEnabled) this.settings.ttsEnabled = ttsEnabled.checked;

        const ttsVoiceRadio = document.querySelector('input[name="ttsVoice"]:checked');
        if (ttsVoiceRadio) this.settings.ttsVoice = ttsVoiceRadio.value;

        const imageModeEl = document.getElementById('imageMode');
        if (imageModeEl) this.settings.imageMode = imageModeEl.checked;

        const chatModeRadio = document.querySelector('input[name="chatMode"]:checked');
        if (chatModeRadio) this.settings.chatMode = chatModeRadio.value;

        const typingEffectEl = document.getElementById('typingEffect');
        if (typingEffectEl) this.settings.typingEffect = typingEffectEl.checked;

        const errorFreeModeEl = document.getElementById('errorFreeMode');
        if (errorFreeModeEl) this.settings.errorFreeMode = errorFreeModeEl.checked;

        const moodRadio = document.querySelector('input[name="mood"]:checked');
        if (moodRadio) this.settings.mood = moodRadio.value;
        
        if (this.settingsSimpleLanguage) {
            this.settings.simpleLanguage = this.settingsSimpleLanguage.checked;
            this.simpleLanguage = this.settings.simpleLanguage;
            if (this.simpleLanguageToggle) {
                this.simpleLanguageToggle.checked = this.simpleLanguage;
            }
        }
        
        // Apply settings immediately
        this.applySettings();
        
        // Save to localStorage
        localStorage.setItem('aiAssistantSettings', JSON.stringify(this.settings));
        
        if (this.settingsMessage) {
            this.settingsMessage.textContent = 'Settings saved!';
            this.settingsMessage.className = 'settings-message success';
            setTimeout(() => {
                this.settingsMessage.textContent = '';
                this.settingsMessage.className = 'settings-message';
            }, 3000);
        }
    }

    async checkServerHealth() {
        try {
            const response = await fetch(`${this.apiUrl}/health`);
            if (!response.ok) {
                this.showErrorMessage('Server is not responding. Make sure the server is running on port 3000.');
            }
        } catch (error) {
            this.showErrorMessage('Cannot connect to server. Please make sure the backend server is running.');
        }
    }

    playSound(type) {
        if (!this.settings.soundEffects) return;
        
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        if (type === 'send') {
            oscillator.frequency.value = 800;
            gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);
        } else if (type === 'receive') {
            oscillator.frequency.value = 600;
            gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.15);
        }
        
        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.2);
    }

    async handleSend() {
        if (!this.userInput) return;
        const raw = this.userInput.value.trim();
        if (!raw) return;

        const { command, cleanMessage } = this.parseCommand(raw);
        const message = cleanMessage || raw;

        // If picture mode is on, route to image generation instead of text chat
        if (this.settings.imageMode) {
            await this.handleSendImage(message);
            return;
        }

        this.addMessage(message, 'user');
        this.playSound('send');
        this.userInput.value = '';
        if (this.sendButton) this.sendButton.disabled = true;

        if (this.chatContainer) {
            const welcomeMsg = this.chatContainer.querySelector('.welcome-message');
            if (welcomeMsg) {
                welcomeMsg.remove();
            }
        }

        let typingId = null;
        if (this.settings.typingIndicator) {
            typingId = this.showTypingIndicator();
        }

        try {
            const response = await fetch(`${this.apiUrl}/chat`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    message: message,
                    sessionId: this.sessionId,
                    simpleLanguage: this.simpleLanguage,
                    mode: this.settings.chatMode || 'fast',
                    command: command,
                    mood: this.settings.mood || 'friendly',
                    errorFreeMode: this.settings.errorFreeMode
                })
            });

            if (typingId) {
                this.hideTypingIndicator(typingId);
            }

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to get response from server');
            }

            const data = await response.json();
            this.addMessage(data.response, 'ai');
            this.playSound('receive');
            
        } catch (error) {
            if (typingId) {
                this.hideTypingIndicator(typingId);
            }
            this.showErrorMessage(error.message || 'Failed to communicate with the AI. Please check your connection and try again.');
        } finally {
            this.sendButton.disabled = false;
            this.userInput.focus();
        }
    }

    parseCommand(text) {
        const trimmed = text.trim();
        if (!trimmed.startsWith('/')) {
            return { command: null, cleanMessage: trimmed };
        }

        const parts = trimmed.split(/\s+/);
        const rawCommand = parts[0].slice(1).toLowerCase();
        const rest = parts.slice(1).join(' ').trim();

        // Supported commands: short, simple, notes, solve, translate, define, eli5, mental
        const allowed = ['short', 'simple', 'notes', 'solve', 'translate', 'define', 'eli5', 'mental'];
        const command = allowed.includes(rawCommand) ? rawCommand : null;

        return {
            command,
            cleanMessage: command ? (rest || '') : trimmed
        };
    }

    async handleSendImage(message) {
        if (!this.chatContainer) return;

        this.addMessage(message, 'user');
        this.playSound('send');
        if (this.userInput) {
            this.userInput.value = '';
        }

        let typingId = null;
        if (this.settings.typingIndicator) {
            typingId = this.showTypingIndicator();
        }

        try {
            const response = await fetch(`${this.apiUrl}/image`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    prompt: message,
                    sessionId: this.sessionId
                })
            });

            if (typingId) {
                this.hideTypingIndicator(typingId);
            }

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to generate image');
            }

            const data = await response.json();
            const imageUrl = data.imageUrl;

            const html = `<div><div>Here is your generated picture:</div><img src="${imageUrl}" alt="Generated image" class="generated-image"></div>`;
            this.addMessage(html, 'ai');
            this.playSound('receive');
        } catch (error) {
            if (typingId) {
                this.hideTypingIndicator(typingId);
            }
            this.showErrorMessage(error.message || 'Failed to generate image. Please try again.');
        } finally {
            if (this.sendButton) {
                this.sendButton.disabled = false;
            }
            if (this.userInput) {
                this.userInput.focus();
            }
        }
    }

    showTypingIndicator() {
        if (!this.chatContainer) return null;
        const typingId = 'typing-' + Date.now();
        const typingDiv = document.createElement('div');
        typingDiv.id = typingId;
        typingDiv.className = 'message ai';
        typingDiv.innerHTML = `
            <div class="message-avatar">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2L2 7l10 5 10-5-10-5z"></path><path d="M2 17l10 5 10-5"></path><path d="M2 12l10 5 10-5"></path></svg>
            </div>
            <div class="message-content">
                <div class="typing-indicator">
                    <span></span>
                    <span></span>
                    <span></span>
                </div>
            </div>
        `;
        this.chatContainer.appendChild(typingDiv);
        if (this.settings.autoScroll) {
            this.chatContainer.scrollTop = this.chatContainer.scrollHeight;
        }
        return typingId;
    }

    hideTypingIndicator(typingId) {
        const typingElement = document.getElementById(typingId);
        if (typingElement) {
            typingElement.remove();
        }
    }

    formatTime() {
        const now = new Date();
        return now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }

    addMessage(text, sender) {
        if (!this.chatContainer) {
            console.error('Chat container not found!');
            return;
        }
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${sender}`;
        
        const avatarDiv = document.createElement('div');
        avatarDiv.className = 'message-avatar';
        if (sender === 'user') {
            avatarDiv.textContent = 'You';
        } else {
            avatarDiv.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2L2 7l10 5 10-5-10-5z"></path><path d="M2 17l10 5 10-5"></path><path d="M2 12l10 5 10-5"></path></svg>';
        }
        
        const contentDiv = document.createElement('div');
        contentDiv.className = 'message-content';
        
        const formattedText = text.replace(/\n/g, '<br>');

        const shouldTypeEffect = sender === 'ai' &&
            this.settings.typingEffect &&
            this.settings.animations &&
            !this.settings.imageMode &&
            !text.includes('<');

        if (shouldTypeEffect) {
            contentDiv.innerHTML = '';
            this.typeText(contentDiv, text);
        } else {
            contentDiv.innerHTML = formattedText;
        }

        if (sender === 'ai' && this.settings.ttsEnabled) {
            this.speakText(text);
        }
        
        if (this.settings.showTimestamps) {
            const timestamp = document.createElement('div');
            timestamp.className = 'message-timestamp';
            timestamp.textContent = this.formatTime();
            contentDiv.appendChild(timestamp);
        }
        
        messageDiv.appendChild(avatarDiv);
        messageDiv.appendChild(contentDiv);
        this.chatContainer.appendChild(messageDiv);
        
        if (this.settings.autoScroll) {
            this.chatContainer.scrollTop = this.chatContainer.scrollHeight;
        }

        // Store in Supabase per user/session
        this.saveMessageToSupabase(text, sender).catch(() => {});
    }

    async saveMessageToSupabase(text, sender) {
        if (!this.supabase || !this.userId) {
            console.warn('Cannot save to Supabase: missing client or userId');
            return;
        }
        
        try {
            const { data, error } = await this.supabase
                .from('chat_messages')
                .insert({
                    user_id: this.userId,
                    session_id: this.sessionId,
                    role: sender,
                    content: text
                })
                .select();

            if (error) {
                console.error('Supabase insert error:', error);
                // If table doesn't exist, show helpful message
                if (error.code === '42P01' || error.message.includes('does not exist')) {
                    console.error('ERROR: chat_messages table does not exist in Supabase. Please run this SQL in Supabase SQL Editor:\n\n' +
                        'CREATE TABLE IF NOT EXISTS public.chat_messages (\n' +
                        '  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),\n' +
                        '  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,\n' +
                        '  session_id text NOT NULL,\n' +
                        '  role text NOT NULL,\n' +
                        '  content text NOT NULL,\n' +
                        '  created_at timestamptz NOT NULL DEFAULT now()\n' +
                        ');\n\n' +
                        'ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;\n\n' +
                        'CREATE POLICY "Users can insert their own messages"\n' +
                        '  ON public.chat_messages FOR INSERT\n' +
                        '  WITH CHECK (auth.uid() = user_id);\n\n' +
                        'CREATE POLICY "Users can select their own messages"\n' +
                        '  ON public.chat_messages FOR SELECT\n' +
                        '  USING (auth.uid() = user_id);'
                    );
                }
            } else {
                console.log('Message saved to Supabase:', data);
            }
        } catch (e) {
            console.error('Failed to save message to Supabase:', e.message || e);
        }
    }

    typeText(container, text) {
        let i = 0;
        const plain = text;
        const step = () => {
            if (i > plain.length) return;
            const current = plain.slice(0, i);
            container.innerHTML = current.replace(/\n/g, '<br>');
            i++;
            if (i <= plain.length) {
                requestAnimationFrame(step);
            }
        };
        requestAnimationFrame(step);
    }


    showErrorMessage(message) {
        const messageDiv = document.createElement('div');
        messageDiv.className = 'message ai';
        
        const avatarDiv = document.createElement('div');
        avatarDiv.className = 'message-avatar';
        avatarDiv.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2L2 7l10 5 10-5-10-5z"></path><path d="M2 17l10 5 10-5"></path><path d="M2 12l10 5 10-5"></path></svg>';
        
        const contentDiv = document.createElement('div');
        contentDiv.className = 'message-content error';
        contentDiv.textContent = message;
        
        messageDiv.appendChild(avatarDiv);
        messageDiv.appendChild(contentDiv);
        this.chatContainer.appendChild(messageDiv);
        
        if (this.settings.autoScroll) {
            this.chatContainer.scrollTop = this.chatContainer.scrollHeight;
        }
    }
}

// Initialize the AI Assistant when the page loads
document.addEventListener('DOMContentLoaded', async () => {
    // If Supabase is configured, require login
    if (window.supabase && window.SUPABASE_URL && window.SUPABASE_ANON_KEY) {
        try {
            const supabaseClient = window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);
            const { data, error } = await supabaseClient.auth.getSession();
            
            if (error) {
                console.error('Session check error:', error);
                window.location.href = 'login.html';
                return;
            }
            
            if (!data || !data.session) {
                console.log('No active session, redirecting to login');
                window.location.href = 'login.html';
                return;
            }
            
            console.log('User authenticated:', data.session.user.email);
            window.__supabaseClient = supabaseClient;
            window.__currentUser = data.session.user;
        } catch (err) {
            console.error('Supabase initialization error:', err);
            window.location.href = 'login.html';
            return;
        }
    }

    new AIAssistant();
});
