// voidzenzi AI Assistant Application - Frontend
// STRICT SUPABASE PERSISTENCE - NO localStorage FOR REAL DATA
class AIAssistant {
    constructor() {
       // Use dynamic API URL for production deployment
this.apiUrl = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' ? 'http://localhost:3000/api' : `${window.location.origin}/api`;
        this.supabase = window.__supabaseClient || null;
        this.user = window.__currentUser || null;
        this.userId = this.user ? this.user.id : null;
        
        // Current chat state
        this.currentChatId = null;
        this.currentChatName = null;
        this.chats = [];
        
        // Settings (loaded from Supabase)
        this.settings = this.getDefaultSettings();
        
        // Memory
        this.memoryEnabled = false;
        this.userPlan = 'free';
        this.userCoins = 0;
        this.gamesCache = []; // Cache games for instant display
        this.userMemory = null;
        this.userName = null;
        this.userContext = null; // User context and identity information
        this.userMemory = null; // Comprehensive user memory (profile, custom terms, relationships, facts)
        
        // UI state (ONLY temporary UI state in localStorage)
        this.uiState = this.loadUIState(); // Only for modal open/close, loading flags
        
        // TTS
        this.ttsSupported = false;
        this.ttsVoices = [];
        this.currentUtterance = null;
        
        // Speech recognition
        this.recognition = null;
        this.isDictating = false;
        
        // Realtime subscriptions
        this.chatsSubscription = null;
        this.messagesSubscription = null;
        
        if (!this.supabase || !this.userId) {
            console.error('Supabase not connected or user not logged in');
            window.location.href = 'login.html';
            return;
        }
        
        this.initializeElements();
        this.setupEventListeners();
        this.initializeApp();
    }

    getDefaultSettings() {
        return {
            // UI
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
            
            // AI
            model: 'default',
            temperature: 0.7,
            systemPrompt: '',
            enabledTools: [],
            responseStyle: 'balanced', // short, balanced, detailed
            
            // Preferences
            simpleLanguage: false,
            chatMode: 'fast', // fast, detailed, coding
            typingEffect: true,
            mood: 'friendly', // friendly, serious, funny, calm
            errorFreeMode: true,
            ttsEnabled: false,
            ttsVoice: 'female',
            imageMode: false,
            imageModeType: 'normal', // normal, emoji
            
            // Memory (removed)
            // memoryEnabled: false
        };
    }

    // ONLY for temporary UI state (modal open/close, loading flags)
    loadUIState() {
        try {
            const saved = localStorage.getItem('voidzenzi_ui_state');
            return saved ? JSON.parse(saved) : { sidebarOpen: false };
        } catch {
            return { sidebarOpen: false };
        }
    }

    saveUIState() {
        try {
            localStorage.setItem('voidzenzi_ui_state', JSON.stringify(this.uiState));
        } catch (e) {
            console.warn('Failed to save UI state:', e);
        }
    }

    initializeElements() {
        // Views
        this.chatView = document.getElementById('chatView');
        this.settingsView = document.getElementById('settingsView');
        
        // Sidebar
        this.sidebar = document.getElementById('sidebar');
        this.sidebarOverlay = document.getElementById('sidebarOverlay');
        this.chatsList = document.getElementById('chatsList');
        this.toggleSidebarBtn = document.getElementById('toggleSidebarBtn');
        this.closeSidebarBtn = document.getElementById('closeSidebarBtn');
        
        // Chat name modal
        this.chatNameModal = document.getElementById('chatNameModal');
        this.chatNameInput = document.getElementById('chatNameInput');
        this.createChatBtn = document.getElementById('createChatBtn');
        this.cancelChatBtn = document.getElementById('cancelChatBtn');
        
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
        this.logoutBtn = document.getElementById('logoutBtn');
        
        // Settings elements
        this.saveSettingsBtn = document.getElementById('saveSettingsBtn');
        this.settingsMessage = document.getElementById('settingsMessage');
        this.clearMemoryBtn = document.getElementById('clearMemoryBtn');
        
        // Chat header
        this.chatHeader = document.getElementById('chatHeader');
        this.currentChatTitle = document.getElementById('currentChatTitle');
        this.deleteChatBtn = document.getElementById('deleteChatBtn');
        
        // Coin counter
        this.coinCounter = document.getElementById('coinCounter');
        this.coinAmount = document.getElementById('coinAmount');
        
        // Games
        this.gamesBtn = document.getElementById('gamesBtn');
        this.gamesModal = document.getElementById('gamesModal');
        this.gamesGrid = document.getElementById('gamesGrid');
        this.closeGamesBtn = document.getElementById('closeGamesBtn');
        
        // Shop
        this.shopBtn = document.getElementById('shopBtn');
        this.shopModal = document.getElementById('shopModal');
        this.closeShopBtn = document.getElementById('closeShopBtn');
        
        // Usage circle
        this.usageCircle = document.getElementById('usageCircle');
        this.usageProgress = document.getElementById('usageProgress');
        this.usageText = document.getElementById('usageText');
        
        // User profile widget
        this.userProfileWidget = document.getElementById('userProfileWidget');
        this.userProfileName = document.getElementById('userProfileName');
        this.userProfileTier = document.getElementById('userProfileTier');
        this.userProfileCoins = document.getElementById('userProfileCoins');
        
        // Referral
        this.referralCodeDisplay = document.getElementById('referralCodeDisplay');
        this.copyReferralBtn = document.getElementById('copyReferralBtn');
        this.inviteCount = document.getElementById('inviteCount');
        this.inviteProgressBar = document.getElementById('inviteProgressBar');
        this.inviteStatus = document.getElementById('inviteStatus');
        this.currentPlanDisplay = document.getElementById('currentPlanDisplay');
        
        // Image upload
        this.imageUploadBtn = document.getElementById('imageUploadBtn');
        this.imageInput = document.getElementById('imageInput');
        this.uploadedImageData = null;

        // Direct Chat elements
        this.directChatBtn = document.getElementById('directChatBtn');
        this.directChatPanel = document.getElementById('directChatPanel');
        this.dcCloseBtn = document.getElementById('dcCloseBtn');
        this.dcBackBtn = document.getElementById('dcBackBtn');
        this.dcTitle = document.getElementById('dcTitle');
        this.dcSearchInput = document.getElementById('dcSearchInput');
        this.dcSearchBtn = document.getElementById('dcSearchBtn');
        this.dcSearchResults = document.getElementById('dcSearchResults');
        this.dcChatsList = document.getElementById('dcChatsList');
        this.dcSearchView = document.getElementById('dcSearchView');
        this.dcChatView = document.getElementById('dcChatView');
        this.dcMessages = document.getElementById('dcMessages');
        this.dcMessageInput = document.getElementById('dcMessageInput');
        this.dcSendBtn = document.getElementById('dcSendBtn');
        this.dcMediaBtn = document.getElementById('dcMediaBtn');
        this.dcFileInput = document.getElementById('dcFileInput');

        // Tabs
        this.dcTabDms = document.getElementById('dcTabDms');
        this.dcTabGroups = document.getElementById('dcTabGroups');
        this.dcGroupsView = document.getElementById('dcGroupsView');
        this.dcGroupsList = document.getElementById('dcGroupsList');
        this.dcCreateGroupBtn = document.getElementById('dcCreateGroupBtn');
        this.dcCreateGroupView = document.getElementById('dcCreateGroupView');
        this.dcGroupNameInput = document.getElementById('dcGroupNameInput');
        this.dcGroupFriendsList = document.getElementById('dcGroupFriendsList');
        this.dcCreateGroupSubmit = document.getElementById('dcCreateGroupSubmit');

        // Friends panel elements
        this.friendsBtn = document.getElementById('friendsBtn');
        this.friendsPanel = document.getElementById('friendsPanel');
        this.friendsCloseBtn = document.getElementById('friendsCloseBtn');
        this.friendsTabAll = document.getElementById('friendsTabAll');
        this.friendsTabPending = document.getElementById('friendsTabPending');
        this.friendsTabAdd = document.getElementById('friendsTabAdd');
        this.friendsAllView = document.getElementById('friendsAllView');
        this.friendsPendingView = document.getElementById('friendsPendingView');
        this.friendsAddView = document.getElementById('friendsAddView');
        this.friendsList = document.getElementById('friendsList');
        this.friendsPendingList = document.getElementById('friendsPendingList');
        this.friendsSearchInput = document.getElementById('friendsSearchInput');
        this.friendsSearchBtn = document.getElementById('friendsSearchBtn');
        this.friendsSearchResults = document.getElementById('friendsSearchResults');

        // Direct chat state
        this.dcActiveChatId = null;
        this.dcActiveChatUser = null;
        this.dcActiveGroupId = null;
        this.dcChats = [];
        this.dcSubscription = null;
        this.friendsData = [];

        // Debouncing flag
        this.isSending = false;
    }

    async initializeApp() {
        console.log('🚀 INITIALIZING APP...');
        console.log('🔐 USER ID:', this.userId);
        console.log('🔐 SUPABASE CLIENT:', this.supabase ? 'EXISTS' : 'MISSING');
        
        if (!this.userId || !this.supabase) {
            console.error('❌ CRITICAL: Missing userId or supabase client');
            this.showNotification('Authentication Error', 'Please log in again.');
            window.location.href = 'login.html';
            return;
        }
        
        // Load user info (plan, coins, referral)
        await this.loadUserInfo();
        await this.loadReferralInfo();
        
        // Load user context and identity
        await this.loadUserContext();
        
        // Load comprehensive user memory
        await this.loadUserMemory();
        
        // Update coin counter
        this.updateCoinCounter();
        
        // Load settings from Supabase
        await this.loadSettingsFromSupabase();
        this.applySettings();
        
        // Load chats from Supabase - CRITICAL: Must load after auth verified
        await this.loadChats();
        
        // If there are existing chats, don't auto-select one - let user choose
        // This ensures proper message isolation
        
        // Setup realtime subscriptions
        this.setupRealtimeSubscriptions();

        // Setup DC connection recovery (handles offline/online/tab switch)
        this.dcSetupConnectionRecovery();

        // Initialize other features
        this.initTextToSpeech();
        this.initSpeechRecognition();
        this.initCallUI();
        this.initNotifications();
        this.initPushNotifications().catch(() => {});
        this.initBook();
        this.checkServerHealth();
        
        // Pre-load games list in background (for instant display)
        this.loadGames().catch(err => console.warn('Games pre-load failed:', err));
        
        // Apply branding based on plan
        this.applyBranding();
        
        // Show debug panel (temporary)
        const debugPanel = document.getElementById('debugPanel');
        if (debugPanel) {
            debugPanel.style.display = 'block';
        }
        this.updateDebugPanel();
        
        // Restore sidebar state (UI only)
        if (this.uiState.sidebarOpen) {
            this.openSidebar();
        }
        
        console.log('✅ APP INITIALIZED');
    }

    async loadUserInfo() {
        console.log('👤 LOADING USER INFO - userId:', this.userId);
        
        if (!this.supabase || !this.userId) {
            console.warn('❌ Cannot load user info: missing supabase or userId');
            return;
        }

        try {
            const { data, error } = await this.supabase
                .from('users')
                .select('plan, coins, invites_count, is_admin, username, email, avatar_url')
                .eq('id', this.userId)
                .single();

            console.log('👤 USER DATA:', data);
            console.log('👤 USER ERROR:', error);

            // If user doesn't exist, create it via server API
            if (error && (error.code === 'PGRST116' || error.message?.includes('0 rows'))) {
                console.log('⚠️ User not found in database, creating user record...');
                try {
                    const { data: authUser } = await this.supabase.auth.getUser();
                    if (authUser?.user) {
                        const meta = authUser.user.user_metadata || {};
                        const response = await fetch(`${this.apiUrl}/users/create`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                userId: this.userId,
                                email: authUser.user.email,
                                username: meta.name || meta.username || authUser.user.email.split('@')[0]
                            })
                        });
                        if (response.ok) {
                            console.log('✅ User record created, reloading...');
                            // Retry loading user info
                            return this.loadUserInfo();
                        }
                    }
                } catch (createError) {
                    console.error('❌ Failed to create user record:', createError);
                }
                return;
            }

            if (error) {
                console.error('❌ USER QUERY ERROR:', error);
                return;
            }

            if (data) {
                this.userPlan = data.plan || 'free';
                this.userCoins = data.coins || 0;
                this.userInvites = data.invites_count || 0;
                this.userName = data.username || data.email?.split('@')[0] || 'User';
                this.userAvatarUrl = data.avatar_url || null;
                console.log('✅ USER INFO LOADED - Plan:', this.userPlan, 'Coins:', this.userCoins, 'Name:', this.userName);
                
                // Update user profile widget and usage
                this.updateUserProfile();
                this.updateUsageCircle();
                this.updateCoinCounter();
            } else {
                console.warn('⚠️ User data not found in database');
            }
        } catch (error) {
            console.error('❌ Failed to load user info:', error);
        }
    }

    async loadReferralInfo() {
        if (!this.supabase || !this.userId) return;

        try {
            // Get referral code
            const { data: refData, error: refError } = await this.supabase
                .from('referral_codes')
                .select('code')
                .eq('user_id', this.userId)
                .single();

            if (!refError && refData && this.referralCodeDisplay) {
                this.referralCodeDisplay.value = refData.code || 'N/A';
            }

            // Update invite progress
            this.updateInviteProgress();
        } catch (error) {
            console.error('Failed to load referral info:', error);
        }
    }

    // ============================================
    // USER CONTEXT AND IDENTITY MANAGEMENT
    // ============================================

    async loadUserContext() {
        console.log('🧠 LOADING USER CONTEXT - userId:', this.userId);
        
        if (!this.supabase || !this.userId) {
            console.warn('❌ Cannot load user context: missing supabase or userId');
            return null;
        }

        try {
            // Use the get_or_create_user_context function
            const { data, error } = await this.supabase
                .rpc('get_or_create_user_context', {
                    p_user_id: this.userId
                });

            console.log('🧠 USER CONTEXT DATA:', data);
            console.log('🧠 USER CONTEXT ERROR:', error);

            if (error) {
                console.error('❌ USER CONTEXT QUERY ERROR:', error);
                return null;
            }

            if (data && data.length > 0) {
                const context = data[0];
                this.userContext = {
                    id: context.id,
                    displayName: context.display_name,
                    bio: context.bio,
                    responseStyle: context.response_style,
                    personalityTraits: context.personality_traits || [],
                    interests: context.interests || [],
                    profession: context.profession,
                    expertiseLevel: context.expertise_level,
                    preferredTopics: context.preferred_topics || [],
                    aiPersonalityPreference: context.ai_personality_preference,
                    communicationStyle: context.communication_style
                };
                
                console.log('✅ USER CONTEXT LOADED:', this.userContext);
                return this.userContext;
            } else {
                console.warn('⚠️ User context not found');
                return null;
            }
        } catch (error) {
            console.error('❌ Failed to load user context:', error);
            return null;
        }
    }

    async updateUserContext(updates) {
        console.log('🧠 UPDATING USER CONTEXT:', updates);
        
        if (!this.supabase || !this.userId) {
            console.warn('❌ Cannot update user context: missing supabase or userId');
            return false;
        }

        try {
            // First ensure context exists
            await this.loadUserContext();

            // Prepare update object
            const updateData = {};
            
            if (updates.displayName !== undefined) updateData.display_name = updates.displayName;
            if (updates.bio !== undefined) updateData.bio = updates.bio;
            if (updates.responseStyle !== undefined) updateData.response_style = updates.responseStyle;
            if (updates.personalityTraits !== undefined) updateData.personality_traits = updates.personalityTraits;
            if (updates.interests !== undefined) updateData.interests = updates.interests;
            if (updates.profession !== undefined) updateData.profession = updates.profession;
            if (updates.expertiseLevel !== undefined) updateData.expertise_level = updates.expertiseLevel;
            if (updates.preferredTopics !== undefined) updateData.preferred_topics = updates.preferredTopics;
            if (updates.aiPersonalityPreference !== undefined) updateData.ai_personality_preference = updates.aiPersonalityPreference;
            if (updates.communicationStyle !== undefined) updateData.communication_style = updates.communicationStyle;

            const { data, error } = await this.supabase
                .from('user_context')
                .upsert({
                    user_id: this.userId,
                    ...updateData
                })
                .select()
                .single();

            console.log('🧠 CONTEXT UPDATE RESULT:', data);
            console.log('🧠 CONTEXT UPDATE ERROR:', error);

            if (error) {
                console.error('❌ USER CONTEXT UPDATE ERROR:', error);
                return false;
            }

            if (data) {
                // Update local context
                this.userContext = {
                    id: data.id,
                    displayName: data.display_name,
                    bio: data.bio,
                    responseStyle: data.response_style,
                    personalityTraits: data.personality_traits || [],
                    interests: data.interests || [],
                    profession: data.profession,
                    expertiseLevel: data.expertise_level,
                    preferredTopics: data.preferred_topics || [],
                    aiPersonalityPreference: data.ai_personality_preference,
                    communicationStyle: data.communication_style
                };
                
                console.log('✅ USER CONTEXT UPDATED:', this.userContext);
                return true;
            }
            
            return false;
        } catch (error) {
            console.error('❌ Failed to update user context:', error);
            return false;
        }
    }

    extractIdentityFromMessage(message) {
        // Extract identity information from user messages
        const text = message.toLowerCase().trim();
        
        const identityPatterns = {
            // Name patterns
            name: [
                /i am (\w+)/i,
                /my name is (\w+)/i,
                /call me (\w+)/i,
                /i'm (\w+)/i
            ],
            
            // Bio/identity patterns
            bio: [
                /i'm a (.+?)(?:\.|$)/i,
                /i am a (.+?)(?:\.|$)/i,
                /i'm an? (.+?)(?:\.|$)/i,
                /i work as a (.+?)(?:\.|$)/i
            ],
            
            // Interest patterns
            interests: [
                /i like (.+?)(?:\.|$)/i,
                /i love (.+?)(?:\.|$)/i,
                /i enjoy (.+?)(?:\.|$)/i,
                /i'm into (.+?)(?:\.|$)/i
            ]
        };

        const extracted = {};

        // Check for name
        for (const pattern of identityPatterns.name) {
            const match = text.match(pattern);
            if (match) {
                extracted.displayName = match[1].charAt(0).toUpperCase() + match[1].slice(1);
                break;
            }
        }

        // Check for bio/identity
        for (const pattern of identityPatterns.bio) {
            const match = text.match(pattern);
            if (match) {
                extracted.bio = match[1].trim();
                break;
            }
        }

        // Check for interests
        for (const pattern of identityPatterns.interests) {
            const match = text.match(pattern);
            if (match) {
                const interests = match[1].split(',').map(i => i.trim().toLowerCase());
                extracted.interests = interests;
                break;
            }
        }

        // Special handling for "gamer" identity
        if (text.includes('gamer')) {
            extracted.personalityTraits = ['gamer'];
            extracted.responseStyle = 'gamer';
        }

        return extracted;
    }

    async processIdentityMessage(message) {
        const extracted = this.extractIdentityFromMessage(message);
        
        if (Object.keys(extracted).length > 0) {
            console.log('🧠 IDENTITY EXTRACTED:', extracted);
            
            // Update user context with extracted information
            const success = await this.updateUserContext(extracted);
            
            if (success) {
                console.log('✅ IDENTITY SAVED TO CONTEXT');
                return true;
            }
        }
        
        return false;
    }

    async loadUserMemory() {
        if (!this.supabase || !this.userId) return null;
        
        try {
            // Fetch comprehensive memory from backend
            const response = await fetch(`${this.apiUrl}/memory?userId=${this.userId}`);
            if (!response.ok) throw new Error('Failed to load memory');
            
            const data = await response.json();
            if (data.success && data.memory) {
                this.userMemory = data.memory;
                console.log('🧠 USER MEMORY LOADED:', this.userMemory);
                return this.userMemory;
            }
        } catch (error) {
            console.error('❌ Failed to load user memory:', error);
        }
        return null;
    }

    async extractAndSaveMemory(message) {
        if (!this.userId || !message) return false;
        
        try {
            // Call backend to extract and save memory
            const response = await fetch(`${this.apiUrl}/memory/extract`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: this.userId, message: message })
            });
            
            if (!response.ok) throw new Error('Failed to extract memory');
            
            const data = await response.json();
            if (data.success && data.saved) {
                console.log('✅ Memory extracted and saved');
                // Reload memory
                await this.loadUserMemory();
                return true;
            }
        } catch (error) {
            console.error('❌ Memory extraction error:', error);
        }
        return false;
    }

    getPersonalizedSystemPrompt() {
        // First check for comprehensive memory
        const memory = this.userMemory;
        
        if (memory && (memory.profile || memory.customTerms?.length > 0 || 
            memory.relationships?.length > 0 || memory.privateFacts?.length > 0)) {
            
            let prompt = "You are voidzen AI, created by Srinikesh. You are a helpful AI assistant.";
            prompt += " You have access to the user's personal memory to personalize your responses.";
            
            const profile = memory.profile;
            
            // Add profile info
            if (profile) {
                if (profile.name) {
                    prompt += ` The user's name is ${profile.name}.`;
                }
                if (profile.job_title || profile.profession) {
                    prompt += ` They work as ${profile.job_title || profile.profession}.`;
                }
                if (profile.interests?.length > 0) {
                    prompt += ` Their interests include: ${profile.interests.join(', ')}.`;
                }
                if (profile.hobbies?.length > 0) {
                    prompt += ` Their hobbies are: ${profile.hobbies.join(', ')}.`;
                }
                if (profile.skills?.length > 0) {
                    prompt += ` Their skills: ${profile.skills.join(', ')}.`;
                }
                if (profile.favorite_apps?.length > 0) {
                    prompt += ` Apps they use: ${profile.favorite_apps.join(', ')}.`;
                }
                if (profile.favorite_technologies?.length > 0) {
                    prompt += ` Technologies they like: ${profile.favorite_technologies.join(', ')}.`;
                }
                if (profile.vehicles?.length > 0) {
                    prompt += ` Their vehicles: ${profile.vehicles.join(', ')}.`;
                }
                if (profile.favorite_sports?.length > 0) {
                    prompt += ` Sports they follow: ${profile.favorite_sports.join(', ')}.`;
                }
                if (profile.favorite_games?.length > 0) {
                    prompt += ` Games they play: ${profile.favorite_games.join(', ')}.`;
                }
                if (profile.personality_style) {
                    prompt += ` Their personality: ${profile.personality_style}.`;
                }
            }
            
            // Add custom terms
            if (memory.customTerms?.length > 0) {
                prompt += " Important: The user uses these custom terms:";
                memory.customTerms.forEach(term => {
                    prompt += ` "${term.term}" means "${term.meaning}";`;
                });
            }
            
            // Add relationships
            if (memory.relationships?.length > 0) {
                prompt += " They have these relationships:";
                memory.relationships.forEach(rel => {
                    prompt += ` ${rel.person_name} (${rel.relationship_type})${rel.notes ? ` - ${rel.notes}` : ''};`;
                });
            }
            
            // Add private facts
            if (memory.privateFacts?.length > 0) {
                prompt += " Important facts about them:";
                memory.privateFacts.forEach(fact => {
                    prompt += ` ${fact.fact};`;
                });
            }
            
            prompt += " Use this context to personalize your responses naturally. Don't explicitly mention you know these things unless relevant.";
            
            return prompt;
        }
        
        // Fallback to old userContext
        if (this.userContext) {
            let prompt = "You are voidzen AI, created by Srinikesh. You are a helpful AI assistant.";
            if (this.userContext.displayName) {
                prompt += ` The user's name is ${this.userContext.displayName}.`;
            }
            if (this.userContext.bio) {
                prompt += ` They identify as: ${this.userContext.bio}.`;
            }
            if (this.userContext.interests?.length > 0) {
                prompt += ` Their interests: ${this.userContext.interests.join(', ')}.`;
            }
            return prompt;
        }
        
        return "You are voidzen AI, created by Srinikesh. You are a helpful AI assistant.";
    }

    updateDebugPanel() {
        // Update debug panel
        const debugPanel = document.getElementById('debugPanel');
        if (debugPanel) {
            const userIdEl = document.getElementById('debugUserId');
            const chatIdEl = document.getElementById('debugChatId');
            const chatsCountEl = document.getElementById('debugChatsCount');
            const messagesCountEl = document.getElementById('debugMessagesCount');
            const coinsEl = document.getElementById('debugCoins');
            const planEl = document.getElementById('debugPlan');
            const memoryEl = document.getElementById('debugMemory');
            const adminEl = document.getElementById('debugAdmin');
            
            if (userIdEl) userIdEl.textContent = this.userId ? this.userId.substring(0, 8) + '...' : 'NULL';
            if (chatIdEl) chatIdEl.textContent = this.currentChatId ? this.currentChatId.substring(0, 8) + '...' : 'NONE';
            if (chatsCountEl) chatsCountEl.textContent = this.chats ? this.chats.length : 0;
            
            // Count messages in current chat
            const messageCount = this.chatContainer ? this.chatContainer.querySelectorAll('.message').length : 0;
            if (messagesCountEl) messagesCountEl.textContent = messageCount;
            
            if (coinsEl) coinsEl.textContent = this.userCoins || 0;
            if (planEl) planEl.textContent = this.userPlan || 'free';
            
            // Check admin status
            if (adminEl && this.userId && this.supabase) {
                this.supabase.from('users').select('is_admin').eq('id', this.userId).single()
                    .then(({ data }) => {
                        if (adminEl) adminEl.textContent = data?.is_admin ? 'YES' : 'NO';
                    })
                    .catch(() => {
                        if (adminEl) adminEl.textContent = '?';
                    });
            }
        }
    }

    updateInviteProgress() {
        if (!this.inviteCount || !this.inviteProgressBar || !this.inviteStatus) return;

        const invites = this.userInvites || 0;
        this.inviteCount.textContent = invites;

        // Progress to Ultra (10 invites)
        const progress = Math.min((invites / 10) * 100, 100);
        this.inviteProgressBar.style.width = `${progress}%`;

        // Status text
        if (invites >= 10) {
            this.inviteStatus.textContent = 'Ultra Unlocked!';
            this.inviteStatus.style.color = '#8b5cf6';
        } else if (invites >= 3) {
            this.inviteStatus.textContent = 'Pro Unlocked!';
            this.inviteStatus.style.color = '#667eea';
        } else {
            const needed = 3 - invites;
            this.inviteStatus.textContent = `${needed} more for Pro`;
            this.inviteStatus.style.color = '#666';
        }

        if (this.currentPlanDisplay) {
            this.currentPlanDisplay.textContent = this.userPlan.charAt(0).toUpperCase() + this.userPlan.slice(1);
        }
    }

    updateUserProfile() {
        if (this.userProfileWidget && this.userProfileName && this.userProfileTier) {
            this.userProfileWidget.style.display = 'flex';
            this.userProfileName.textContent = this.userName || 'User';
            const tierText = this.userPlan.charAt(0).toUpperCase() + this.userPlan.slice(1);
            this.userProfileTier.textContent = tierText;
            this.userProfileTier.className = `user-profile-tier tier-${this.userPlan}`;

            // Update coins display
            if (this.userProfileCoins) {
                this.userProfileCoins.textContent = `🪙 ${this.userCoins || 0} coins`;
            }

            // Show avatar image if available
            const avatarImg   = document.getElementById('userProfileAvatarImg');
            const avatarEmoji = document.getElementById('userProfileAvatarEmoji');
            if (avatarImg && avatarEmoji) {
                if (this.userAvatarUrl) {
                    avatarImg.src = this.userAvatarUrl;
                    avatarImg.style.display = 'block';
                    avatarEmoji.style.display = 'none';
                } else {
                    avatarImg.style.display = 'none';
                    avatarEmoji.style.display = '';
                }
            }

            // Sync settings avatar preview
            const settingsPreview = document.getElementById('settingsAvatarPreview');
            if (settingsPreview) {
                settingsPreview.src = this.userAvatarUrl ||
                    `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80"><circle cx="40" cy="40" r="40" fill="#667eea"/><text x="40" y="52" font-size="32" fill="white" text-anchor="middle">👤</text></svg>')}`;
            }
        }
    }
    
    async updateUsageCircle() {
        if (!this.usageCircle || !this.usageProgress || !this.usageText || !this.supabase) return;
        
        try {
            // Get user plan to determine limits
            const { data: user, error: userError } = await this.supabase
                .from('users')
                .select('plan')
                .eq('id', this.userId)
                .single();
            
            if (userError || !user) {
                console.error('Failed to get user plan:', userError);
                return;
            }
            
            // Define plan limits (updated: Free 50 messages, Pro 10x, Ultra infinite)
            const PLAN_LIMITS = {
                free: { messages: 50, images: 5, codeGenerations: 5 },
                pro: { messages: 500, images: 50, codeGenerations: 50 },
                ultra: { messages: -1, images: -1, codeGenerations: -1 }
            };
            
            const limits = PLAN_LIMITS[user.plan] || PLAN_LIMITS.free;
            
            // Get usage from Supabase
            const { data: usage, error: usageError } = await this.supabase
                .from('usage_limits')
                .select('messages_used, images_used, code_generations_used')
                .eq('user_id', this.userId)
                .single();
            
            // If no usage record exists, create one
            if (usageError && usageError.code === 'PGRST116') {
                // No record exists, usage is 0
                const used = 0;
                const limit = limits.messages;
                
                if (limit === -1) {
                    this.usageText.textContent = '∞';
                    this.usageProgress.style.strokeDashoffset = '0';
                    this.usageProgress.style.stroke = '#10b981';
                } else {
                    this.usageProgress.style.strokeDashoffset = '62.83';
                    this.usageText.textContent = '0%';
                    this.usageProgress.style.stroke = '#667eea';
                }
                return;
            }
            
            if (usageError) {
                console.error('Failed to get usage:', usageError);
                return;
            }
            
            // Calculate usage percentage (messages as primary metric)
            let used = usage.messages_used || 0;
            let limit = limits.messages || 50;
            const imagesUsed = usage.images_used || 0;
            const imagesLimit = limits.images || 5;
            
            if (limit === -1) {
                // Unlimited
                this.usageText.textContent = '∞';
                this.usageProgress.style.strokeDashoffset = '0';
                this.usageProgress.style.stroke = '#10b981';
                // Update title with full info
                this.usageCircle.title = `Plan: ${user.plan.toUpperCase()}\nMessages: Unlimited\nImages: Unlimited`;
            } else {
                const percentage = Math.min((used / limit) * 100, 100);
                const circumference = 2 * Math.PI * 10; // radius 10
                const offset = circumference - (percentage / 100) * circumference;
                
                this.usageProgress.style.strokeDashoffset = offset;
                this.usageText.textContent = `${Math.round(percentage)}%`;
                
                // Color based on usage
                if (percentage >= 90) {
                    this.usageProgress.style.stroke = '#ef4444';
                } else if (percentage >= 70) {
                    this.usageProgress.style.stroke = '#f59e0b';
                } else {
                    this.usageProgress.style.stroke = '#667eea';
                }
                
                // Update title with detailed plan info
                const imagesText = imagesLimit === -1 ? 'Unlimited' : `${imagesUsed}/${imagesLimit}`;
                this.usageCircle.title = `Plan: ${user.plan.toUpperCase()}
Messages: ${used}/${limit}
Images: ${imagesText}

Free: 50 messages, 5 images
Pro: 500 messages, 50 images
Ultra: Unlimited`;
            }
        } catch (error) {
            console.error('Failed to update usage circle:', error);
        }
    }
    
    showShopModal() {
        if (this.shopModal) {
            this.shopModal.classList.add('show');
            
            // Update button text based on user's current plan
            this.updateShopButtons();
        }
    }
    
    updateShopButtons() {
        // Get the buy buttons
        const proButton = document.querySelector('.buy-plan-btn[data-plan="pro"]');
        const ultraButton = document.querySelector('.buy-plan-btn[data-plan="ultra"]');
        
        if (!proButton || !ultraButton) {
            console.warn('Shop buttons not found');
            return;
        }
        
        // Update button text based on current user plan
        if (this.userPlan === 'pro') {
            // If user has Pro plan, they can upgrade to Ultra or equip Pro
            proButton.textContent = 'Equip Pro';
            ultraButton.textContent = 'Buy Ultra';
        } else if (this.userPlan === 'ultra') {
            // If user has Ultra plan, they can equip either Pro or Ultra
            proButton.textContent = 'Equip Pro';
            ultraButton.textContent = 'Equip Ultra';
        } else {
            // Free user - can buy either plan
            proButton.textContent = 'Buy Pro';
            ultraButton.textContent = 'Buy Ultra';
        }
    }
    
    closeShopModal() {
        if (this.shopModal) {
            this.shopModal.classList.remove('show');
        }
    }
    
    async buyPlan(plan, price) {
        // Check if the user is trying to equip an existing plan
        if (this.userPlan === plan) {
            // User is trying to equip the same plan they already have
            this.showNotification('Info', `You already have the ${plan.toUpperCase()} plan equipped!`);
            this.closeShopModal();
            return;
        }
        
        // For "Buy" actions, check if user has enough coins
        if (this.userPlan !== plan && price > 0) {
            if (this.userCoins < price) {
                this.showNotification('Insufficient Funds', `Not enough coins! You need ${price} coins but only have ${this.userCoins}.`);
                return;
            }
        }
        
        // Confirm the action
        let actionText = this.userPlan === 'free' ? 'Upgrade to' : 'Switch to';
        if (this.userPlan === plan) {
            actionText = 'Equip';
        }
        
        const confirmed = await this.showConfirmDialog(`${actionText} ${plan.toUpperCase()} plan?`, `${actionText} ${plan.toUpperCase()} plan?${price > 0 && this.userPlan !== plan ? ` This will cost ${price} coins.` : ''}`);
        if (!confirmed) {
            return;
        }
        
        try {
            let updateData = { plan: plan };
            
            // Only deduct coins if user is upgrading (not equipping)
            if (this.userPlan !== plan && price > 0) {
                updateData.coins = this.userCoins - price;
            } else {
                // When equipping, keep the same coin balance
                updateData.coins = this.userCoins;
            }
            
            // Update user plan via Supabase
            const { error } = await this.supabase
                .from('users')
                .update(updateData)
                .eq('id', this.userId);
            
            if (error) throw error;
            
            // Refresh user info
            await this.loadUserInfo();
            this.updateCoinCounter();
            this.updateUserProfile();
            this.updateUsageCircle();
            this.closeShopModal();
            
            if (this.userPlan === plan) {
                this.showNotification('Success', `Successfully equipped ${plan.toUpperCase()} plan!`);
            } else {
                this.showNotification('Success', `Successfully upgraded to ${plan.toUpperCase()} plan!`);
            }
        } catch (error) {
            console.error('Failed to buy/equip plan:', error);
            this.showNotification('Error', `Failed to ${this.userPlan === plan ? 'equip' : 'upgrade'}: ${error.message}`);
        }
    }

    updateCoinCounter() {
        if (this.coinAmount) {
            this.coinAmount.textContent = this.userCoins || 0;
        }
    }


    copyReferralCode() {
        if (!this.referralCodeDisplay) return;
        this.referralCodeDisplay.select();
        document.execCommand('copy');
        this.showNotification('Success', 'Referral code copied to clipboard!');
    }

    async loadGames() {
        const startTime = Date.now();
        
        if (!this.supabase) {
            console.error('❌ Supabase not initialized in loadGames');
            if (this.gamesGrid) {
                this.gamesGrid.innerHTML = '<div style="padding: 20px; text-align: center; color: #ef4444;"><strong>Error:</strong> Supabase not initialized</div>';
            }
            return;
        }

        if (!this.gamesGrid) {
            console.error('❌ gamesGrid element not found');
            return;
        }

        try {
            console.log('🎮 LOADING GAMES - Supabase URL:', window.SUPABASE_URL);
            console.log('🎮 Querying public.games table...');
            
            // Query games table with explicit column selection
            const { data: games, error } = await this.supabase
                .from('games')
                .select('id, name, reward_coins, reward_tokens, description, created_at')
                .order('name');
            
            // Log exact response
            console.log('🎮 SUPABASE RESPONSE:');
            console.log('  - data:', games);
            console.log('  - error:', error);
            console.log('  - data type:', typeof games);
            console.log('  - data length:', games?.length);
            console.log('  - is array:', Array.isArray(games));
            
            if (error) {
                console.error('❌ SUPABASE ERROR:', error);
                console.error('  - code:', error.code);
                console.error('  - message:', error.message);
                console.error('  - details:', error.details);
                console.error('  - hint:', error.hint);
                
                // Show exact error
                this.gamesGrid.innerHTML = `
                    <div style="padding: 20px; text-align: center; color: #ef4444;">
                        <strong>Database Error:</strong><br>
                        ${error.message || 'Unknown error'}<br>
                        <small>Code: ${error.code || 'N/A'}</small><br>
                        <small>Check console for details</small>
                    </div>
                `;
                return;
            }

            const loadTime = Date.now() - startTime;
            console.log(`✅ Query completed in ${loadTime}ms`);
            console.log(`✅ Games count: ${games?.length || 0}`);

            // Check if games is null, undefined, or empty array
            if (!games) {
                console.error('❌ Games data is null or undefined');
                this.gamesGrid.innerHTML = `
                    <div style="padding: 20px; text-align: center; color: #ef4444;">
                        <strong>Error:</strong> Query returned null<br>
                        <small>Check RLS policies and table permissions</small>
                    </div>
                `;
                return;
            }
            
            if (!Array.isArray(games)) {
                console.error('❌ Games data is not an array:', typeof games);
                this.gamesGrid.innerHTML = `
                    <div style="padding: 20px; text-align: center; color: #ef4444;">
                        <strong>Error:</strong> Invalid data format<br>
                        <small>Expected array, got: ${typeof games}</small>
                    </div>
                `;
                return;
            }

            if (games.length === 0) {
                console.log('⚠️ Games array is empty - showing empty state');
                this.gamesGrid.innerHTML = '<div style="padding: 40px; text-align: center; color: #6b7280;"><div style="font-size: 48px; margin-bottom: 16px;">🎮</div><div style="font-size: 18px; font-weight: 600; margin-bottom: 8px; color: #374151;">No games available yet</div><div style="font-size: 14px; color: #6b7280;">Games will appear here when added to the database</div></div>';
            } else {
                console.log(`✅ Rendering ${games.length} games`);
                this.gamesCache = games;
                this.renderGames(games);
            }
        } catch (error) {
            const loadTime = Date.now() - startTime;
            console.error(`❌ EXCEPTION in loadGames (${loadTime}ms):`, error);
            console.error('  - name:', error.name);
            console.error('  - message:', error.message);
            console.error('  - stack:', error.stack);
            
            this.gamesGrid.innerHTML = `
                <div style="padding: 20px; text-align: center; color: #ef4444;">
                    <strong>Error loading games:</strong><br>
                    ${error.message || 'Unknown error'}<br>
                    <small>Load time: ${loadTime}ms</small><br>
                    <small>Check browser console for details</small>
                </div>
            `;
        }
    }

    renderGames(games) {
        if (!this.gamesGrid) return;

        this.gamesGrid.innerHTML = games.map(game => `
            <div class="game-card">
                <h4>${this.escapeHtml(game.name)}</h4>
                <p class="game-reward">Reward: 🪙 ${game.reward_coins || 0} coins${game.reward_tokens ? ` + ${game.reward_tokens} tokens` : ''}</p>
                <button class="btn-primary" onclick="window.location.href='games.html?game=${game.id}'">Play</button>
            </div>
        `).join('');
    }

    showGamesModal() {
        console.log('🎮 SHOWING GAMES MODAL');
        if (this.gamesModal) {
            this.gamesModal.classList.add('show');
            console.log('✅ Games modal shown');
            // Games are pre-loaded, but refresh if needed
            if (!this.gamesCache || this.gamesCache.length === 0) {
                this.loadGames();
            } else {
                // Use cached games instantly
                this.renderGames(this.gamesCache);
            }
        } else {
            console.error('❌ Games modal element not found');
        }
    }

    closeGamesModal() {
        console.log('🎮 CLOSING GAMES MODAL');
        if (this.gamesModal) {
            this.gamesModal.classList.remove('show');
        }
    }

    applyBranding() {
        // Free users see voidzen.ai branding, Pro/Ultra see no branding
        const footer = document.querySelector('.footer-branding');
        if (footer) {
            if (this.userPlan === 'free') {
                footer.textContent = 'voidzen.ai';
                footer.style.display = 'block';
            } else {
                footer.style.display = 'none';
            }
        }
    }

    setupEventListeners() {
        this.initModalEventListeners();
        
        // Sidebar
        if (this.toggleSidebarBtn) {
            this.toggleSidebarBtn.addEventListener('click', () => this.toggleSidebar());
        }
        if (this.closeSidebarBtn) {
            this.closeSidebarBtn.addEventListener('click', () => this.closeSidebar());
        }
        if (this.sidebarOverlay) {
            this.sidebarOverlay.addEventListener('click', () => this.closeSidebar());
        }
        
        // Chat name modal
        if (this.createChatBtn) {
            this.createChatBtn.addEventListener('click', () => this.createNewChat());
        }
        if (this.cancelChatBtn) {
            this.cancelChatBtn.addEventListener('click', () => this.closeChatNameModal());
        }
        if (this.chatNameInput) {
            this.chatNameInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    this.createNewChat();
                }
            });
        }
        
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
                this.settings.simpleLanguage = e.target.checked;
                this.saveSettingsToSupabase();
            });
        }

        // Voice input
        if (this.voiceInputBtn) {
            this.voiceInputBtn.addEventListener('click', () => this.toggleDictation());
        }

        // Image upload
        if (this.imageUploadBtn) {
            this.imageUploadBtn.addEventListener('click', () => {
                this.imageInput.click();
            });
        }
        if (this.imageInput) {
            this.imageInput.addEventListener('change', (e) => this.handleImageUpload(e));
        }

        // Camera button
        this.cameraBtn = document.getElementById('cameraBtn');
        if (this.cameraBtn) {
            this.cameraBtn.addEventListener('click', () => this.showCameraModal());
        }

        // Camera modal buttons
        const startCameraBtn = document.getElementById('startCameraBtn');
        const captureBtn = document.getElementById('captureBtn');
        const retakeBtn = document.getElementById('retakeBtn');
        const usePhotoBtn = document.getElementById('usePhotoBtn');
        const closeCameraBtn = document.getElementById('closeCameraBtn');

        if (startCameraBtn) startCameraBtn.addEventListener('click', () => this.startCamera());
        if (captureBtn) captureBtn.addEventListener('click', () => this.capturePhoto());
        if (retakeBtn) retakeBtn.addEventListener('click', () => this.retakePhoto());
        if (usePhotoBtn) usePhotoBtn.addEventListener('click', () => this.usePhoto());
        if (closeCameraBtn) closeCameraBtn.addEventListener('click', () => this.closeCameraModal());

        // Navigation
        if (this.newChatBtn) {
            this.newChatBtn.addEventListener('click', () => this.showNewChatModal());
        }
        if (this.settingsBtn) {
            this.settingsBtn.addEventListener('click', () => this.showSettings());
        }
        if (this.backToChatBtn) {
            this.backToChatBtn.addEventListener('click', () => this.showChat());
        }
        if (this.clearChatBtn) {
            this.clearChatBtn.addEventListener('click', () => this.clearCurrentChat());
        }
        
        // Delete all chats button
        const deleteAllChatsBtn = document.getElementById('deleteAllChatsBtn');
        if (deleteAllChatsBtn) {
            deleteAllChatsBtn.addEventListener('click', () => this.deleteAllChats());
        }
        
        // Delete account button
        const deleteAccountBtn = document.getElementById('deleteAccountBtn');
        if (deleteAccountBtn) {
            deleteAccountBtn.addEventListener('click', () => this.deleteAccount());
        }
        if (this.logoutBtn) {
            this.logoutBtn.addEventListener('click', () => this.handleLogout());
        }

        
        // Games button
        if (this.gamesBtn) {
            this.gamesBtn.addEventListener('click', () => {
                console.log('🎮 MINIGAMES BUTTON CLICKED');
                this.showGamesModal();
            });
        } else {
            console.warn('⚠️ Games button not found in DOM');
        }
        if (this.closeGamesBtn) {
            this.closeGamesBtn.addEventListener('click', () => {
                console.log('🎮 CLOSING GAMES MODAL');
                this.closeGamesModal();
            });
        }
        
        // Shop button
        if (this.shopBtn) {
            this.shopBtn.addEventListener('click', () => this.showShopModal());
        }
        if (this.closeShopBtn) {
            this.closeShopBtn.addEventListener('click', () => this.closeShopModal());
        }
        
        // Buy plan buttons (event delegation for dynamically added buttons)
        if (this.shopModal) {
            this.shopModal.addEventListener('click', (e) => {
                if (e.target.classList.contains('buy-plan-btn')) {
                    const plan = e.target.dataset.plan;
                    const price = parseInt(e.target.dataset.price);
                    this.buyPlan(plan, price);
                }
            });
        }
        
        // User profile widget click (show in sidebar)
        if (this.userProfileWidget) {
            this.userProfileWidget.addEventListener('click', () => {
                this.openSidebar();
            });
        }
        
        // Delete chat button (in chat header)
        if (this.deleteChatBtn) {
            this.deleteChatBtn.addEventListener('click', () => {
                console.log('🗑️ DELETE CHAT BUTTON CLICKED');
                this.deleteChat(this.currentChatId);
            });
        }
        
        // Admin button
        const adminBtn = document.getElementById('adminBtn');
        if (adminBtn) {
            adminBtn.addEventListener('click', () => {
                console.log('🔐 ADMIN BUTTON CLICKED');
                this.showAdminPasswordModal();
            });
        } else {
            console.warn('⚠️ Admin button not found in DOM');
        }
        
        // Admin password modal
        const adminPasswordSubmit = document.getElementById('adminPasswordSubmit');
        const adminPasswordCancel = document.getElementById('adminPasswordCancel');
        const adminPasswordInput = document.getElementById('adminPasswordInput');
        
        if (adminPasswordSubmit) {
            adminPasswordSubmit.addEventListener('click', () => this.handleAdminPassword());
        }
        if (adminPasswordCancel) {
            adminPasswordCancel.addEventListener('click', () => this.closeAdminPasswordModal());
        }
        if (adminPasswordInput) {
            adminPasswordInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    this.handleAdminPassword();
                }
            });
        }
        
        // Settings save button
        if (this.saveSettingsBtn) {
            this.saveSettingsBtn.addEventListener('click', () => this.saveSettingsToSupabase());
        }

        // Direct Chat (User-to-User)
        if (this.directChatBtn) {
            this.directChatBtn.addEventListener('click', () => this.openDirectChat());
        }
        if (this.dcCloseBtn) {
            this.dcCloseBtn.addEventListener('click', () => this.closeDirectChat());
        }
        if (this.dcBackBtn) {
            this.dcBackBtn.addEventListener('click', () => this.dcGoBack());
        }
        if (this.dcSearchBtn) {
            this.dcSearchBtn.addEventListener('click', () => this.dcSearchUsers());
        }
        if (this.dcSearchInput) {
            this.dcSearchInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') this.dcSearchUsers();
            });
        }
        if (this.dcSendBtn) {
            this.dcSendBtn.addEventListener('click', () => this.dcSendMessage());
        }
        if (this.dcMessageInput) {
            this.dcMessageInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    this.dcSendMessage();
                }
            });
        }

        // Media attach button
        if (this.dcMediaBtn) {
            this.dcMediaBtn.addEventListener('click', () => this.dcFileInput?.click());
        }
        if (this.dcFileInput) {
            this.dcFileInput.addEventListener('change', (e) => this.dcHandleFileUpload(e));
        }

        // DC Tabs (DMs / Groups)
        if (this.dcTabDms) {
            this.dcTabDms.addEventListener('click', () => this.dcSwitchTab('dms'));
        }
        if (this.dcTabGroups) {
            this.dcTabGroups.addEventListener('click', () => this.dcSwitchTab('groups'));
        }

        // Group chat
        if (this.dcCreateGroupBtn) {
            this.dcCreateGroupBtn.addEventListener('click', () => this.dcShowCreateGroupView());
        }
        if (this.dcCreateGroupSubmit) {
            this.dcCreateGroupSubmit.addEventListener('click', () => this.dcCreateGroup());
        }

        // Friends panel
        if (this.friendsBtn) {
            this.friendsBtn.addEventListener('click', () => this.openFriendsPanel());
        }
        if (this.friendsCloseBtn) {
            this.friendsCloseBtn.addEventListener('click', () => this.closeFriendsPanel());
        }
        if (this.friendsTabAll) {
            this.friendsTabAll.addEventListener('click', () => this.switchFriendsTab('all'));
        }
        if (this.friendsTabPending) {
            this.friendsTabPending.addEventListener('click', () => this.switchFriendsTab('pending'));
        }
        if (this.friendsTabAdd) {
            this.friendsTabAdd.addEventListener('click', () => this.switchFriendsTab('add'));
        }
        if (this.friendsSearchBtn) {
            this.friendsSearchBtn.addEventListener('click', () => this.friendsSearchUsers());
        }
        if (this.friendsSearchInput) {
            this.friendsSearchInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') this.friendsSearchUsers();
            });
        }

        // Settings change handlers (auto-save to Supabase)
        this.setupSettingsEventListeners();
        }

    setupSettingsEventListeners() {
        // Theme
        document.querySelectorAll('input[name="theme"]').forEach(radio => {
            radio.addEventListener('change', () => {
                this.settings.theme = radio.value;
                this.applySettings();
                this.saveSettingsToSupabase();
            });
        });

        // Accent Color
        document.querySelectorAll('input[name="accentColor"]').forEach(radio => {
            radio.addEventListener('change', () => {
                this.settings.accentColor = radio.value;
                this.applySettings();
                this.saveSettingsToSupabase();
            });
        });

        // Font Size
        document.querySelectorAll('input[name="fontSize"]').forEach(radio => {
            radio.addEventListener('change', () => {
                this.settings.fontSize = radio.value;
                this.applySettings();
                this.saveSettingsToSupabase();
            });
        });

        // Font Style
        const fontStyleEl = document.getElementById('fontStyle');
        if (fontStyleEl) {
            fontStyleEl.addEventListener('change', (e) => {
                this.settings.fontStyle = e.target.value;
                this.applySettings();
                this.saveSettingsToSupabase();
            });
        }

        // Bubble Style
        document.querySelectorAll('input[name="bubbleStyle"]').forEach(radio => {
            radio.addEventListener('change', () => {
                this.settings.bubbleStyle = radio.value;
                this.applySettings();
                this.saveSettingsToSupabase();
            });
        });

        // Message Alignment
        document.querySelectorAll('input[name="messageAlignment"]').forEach(radio => {
            radio.addEventListener('change', () => {
                this.settings.messageAlignment = radio.value;
                this.applySettings();
                this.saveSettingsToSupabase();
            });
        });

        // Send Button Style
        document.querySelectorAll('input[name="sendButtonStyle"]').forEach(radio => {
            radio.addEventListener('change', () => {
                this.settings.sendButtonStyle = radio.value;
                this.applySettings();
                this.saveSettingsToSupabase();
            });
        });

        // Toggles
        const toggles = [
            { id: 'typingIndicator', key: 'typingIndicator' },
            { id: 'showTimestamps', key: 'showTimestamps' },
            { id: 'autoScroll', key: 'autoScroll' },
            { id: 'soundEffects', key: 'soundEffects' },
            { id: 'animations', key: 'animations' },
            { id: 'compactMode', key: 'compactMode' },
            { id: 'settingsSimpleLanguage', key: 'simpleLanguage' },
            { id: 'ttsEnabled', key: 'ttsEnabled' },
            { id: 'imageMode', key: 'imageMode' },
            { id: 'typingEffect', key: 'typingEffect' },
            { id: 'errorFreeMode', key: 'errorFreeMode' }
        ];

        toggles.forEach(({ id, key, special }) => {
            const el = document.getElementById(id);
            if (el) {
                el.addEventListener('change', async (e) => {
                    const newValue = e.target.checked;
                    console.log(`🔄 TOGGLE CHANGED - ${id}:`, newValue);
                    this.settings[key] = newValue;
                    this.applySettings();
                    
                    // Save immediately to Supabase
                    await this.saveSettingsToSupabase();
                });
            }
        });

        // Radio groups
        const radioGroups = [
            { name: 'ttsVoice', key: 'ttsVoice' },
            { name: 'chatMode', key: 'chatMode' },
            { name: 'mood', key: 'mood' },
            { name: 'imageModeType', key: 'imageModeType' }
        ];

        radioGroups.forEach(({ name, key }) => {
            document.querySelectorAll(`input[name="${name}"]`).forEach(radio => {
                radio.addEventListener('change', () => {
                    this.settings[key] = radio.value;
                    this.applySettings();
                    this.saveSettingsToSupabase();
                });
            });
        });
    }

    // ============================================
    // SIDEBAR MANAGEMENT
    // ============================================
    toggleSidebar() {
        if (this.sidebar.classList.contains('open')) {
            this.closeSidebar();
        } else {
            this.openSidebar();
        }
    }

    openSidebar() {
        if (this.sidebar) this.sidebar.classList.add('open');
        if (this.sidebarOverlay) this.sidebarOverlay.classList.add('show');
        this.uiState.sidebarOpen = true;
        this.saveUIState();
    }

    closeSidebar() {
        if (this.sidebar) this.sidebar.classList.remove('open');
        if (this.sidebarOverlay) this.sidebarOverlay.classList.remove('show');
        this.uiState.sidebarOpen = false;
        this.saveUIState();
    }

    // ============================================
    // CHAT MANAGEMENT (STRICT SUPABASE)
    // ============================================
    showNewChatModal() {
        this.chatNameModal.classList.add('show');
        this.chatNameInput.value = '';
        this.chatNameInput.focus();
    }

    closeChatNameModal() {
        this.chatNameModal.classList.remove('show');
    }

    async createAutoNamedChat(firstMessage) {
        // Create a chat name based on the first message (truncate if too long)
        let chatName = firstMessage.substring(0, 30);
        if (firstMessage.length > 30) {
            chatName += '...';
        }
        
        // Ensure the chat name is not empty
        if (!chatName.trim()) {
            chatName = 'New Chat';
        }
        
        try {
            const { data, error } = await this.supabase
                .from('chats')
                .insert({
                    user_id: this.userId,
                    name: chatName
                })
                .select()
                .single();

            if (error) throw error;

            this.currentChatId = data.id;
            this.currentChatName = data.name;
            
            // Reload the chats list to show the new chat
            await this.loadChats();
            
            // Update the chat header to show the new chat name
            if (this.chatHeader) {
                this.chatHeader.style.display = 'flex';
            }
            
            // Update the chat container title
            this.updateChatContainerTitle();
            
            console.log('✅ Auto-created chat:', data.name);
        } catch (error) {
            console.error('Failed to auto-create chat:', error);
            // Fallback to manual chat creation if auto-creation fails
            this.showNewChatModal();
            return;
        }
    }

    async createNewChat() {
        const chatName = this.chatNameInput.value.trim();
        if (!chatName) {
            this.showNotification('Invalid Input', 'Please enter a chat name');
            return;
        }

        try {
            const { data, error } = await this.supabase
                .from('chats')
                .insert({
                    user_id: this.userId,
                    name: chatName
                })
                .select()
                .single();

            if (error) throw error;

            this.currentChatId = data.id;
            this.currentChatName = data.name;
            this.closeChatNameModal();
            await this.loadChats();
            await this.loadChatMessages(this.currentChatId);
            this.updateChatContainerTitle();
        } catch (error) {
            console.error('Failed to create chat:', error);
            this.showNotification('Error', 'Failed to create chat. Please try again.');
        }
    }

    async loadChats() {
        console.log('📋 LOADING CHATS - userId:', this.userId);
        
        if (!this.supabase || !this.userId) {
            console.error('❌ Cannot load chats: missing supabase or userId');
            if (this.chatsList) {
                this.chatsList.innerHTML = '<div class="loading-chats">Error: Not authenticated</div>';
            }
            return;
        }

        try {
            // First verify we can access the chats table
            console.log('📋 TESTING DATABASE CONNECTION...');
            const { data: testData, error: testError } = await this.supabase
                .from('chats')
                .select('id')
                .limit(1);

            if (testError) {
                console.error('❌ DATABASE CONNECTION ERROR:', testError);
                if (testError.message && testError.message.includes('relation') && testError.message.includes('does not exist')) {
                    if (this.chatsList) {
                        this.chatsList.innerHTML = `
                            <div class="loading-chats" style="color: red;">
                                <strong>Database Error:</strong><br>
                                Chats table doesn't exist!<br>
                                Please run SUPABASE_SETUP.sql in Supabase SQL Editor.
                            </div>
                        `;
                    }
                    return;
                }
                throw testError;
            }

            const { data, error } = await this.supabase
                .from('chats')
                .select('*')
                .eq('user_id', this.userId)
                .order('updated_at', { ascending: false });

            console.log('📋 CHATS DATA:', data);
            console.log('📋 CHATS ERROR:', error);
            console.log('📋 CHATS COUNT:', data ? data.length : 0);

            if (error) {
                console.error('❌ CHATS QUERY ERROR:', error);
                
                // Provide helpful error messages
                if (error.message && error.message.includes('permission denied') || error.message.includes('policy')) {
                    console.error('❌ RLS POLICY ERROR - Check Row Level Security policies in Supabase');
                    if (this.chatsList) {
                        this.chatsList.innerHTML = `
                            <div class="loading-chats" style="color: red;">
                                <strong>Permission Error:</strong><br>
                                Row Level Security (RLS) is blocking access.<br>
                                Please check RLS policies in Supabase Dashboard.
                            </div>
                        `;
                    }
                    return;
                }
                
                throw error;
            }

            this.chats = data || [];
            console.log('✅ CHATS LOADED:', this.chats.length, 'chats');
            this.renderChatsList();
            
            // Update debug panel
            this.updateDebugPanel();
        } catch (error) {
            console.error('❌ Failed to load chats:', error);
            if (this.chatsList) {
                let errorMsg = error.message || 'Unknown error';
                if (error.message && error.message.includes('relation')) {
                    errorMsg = 'Database table missing. Run SUPABASE_SETUP.sql';
                } else if (error.message && error.message.includes('permission')) {
                    errorMsg = 'Permission denied. Check RLS policies.';
                }
                this.chatsList.innerHTML = `<div class="loading-chats" style="color: red;">Error loading chats: ${errorMsg}</div>`;
            }
        }
    }

    renderChatsList() {
        if (!this.chatsList) return;

        if (this.chats.length === 0) {
            this.chatsList.innerHTML = '<div class="loading-chats">No chats yet. Create a new chat to get started!</div>';
            return;
        }

        this.chatsList.innerHTML = this.chats.map(chat => {
            const isActive = chat.id === this.currentChatId;
            const date = new Date(chat.updated_at);
            const dateStr = date.toLocaleDateString();
            
            return `
                <div class="chat-item ${isActive ? 'active' : ''}" data-chat-id="${chat.id}">
                    <div class="chat-item-content">
                        <div class="chat-item-title">${this.escapeHtml(chat.name)}</div>
                        <div class="chat-item-date">${dateStr}</div>
                    </div>
                    <button class="chat-item-delete" data-chat-id="${chat.id}" title="Delete chat">×</button>
                </div>
            `;
        }).join('');

        // Add click handlers
        this.chatsList.querySelectorAll('.chat-item').forEach(item => {
            const chatId = item.dataset.chatId;
            
            // Click to load chat (but not on delete button)
            item.querySelector('.chat-item-content')?.addEventListener('click', async () => {
                await this.loadChat(chatId);
            });
        });

        // Add delete handlers
        this.chatsList.querySelectorAll('.chat-item-delete').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const chatId = btn.dataset.chatId;
                await this.deleteChat(chatId);
            });
        });
    }

    async loadChat(chatId) {
        console.log('📂 LOADING CHAT - chatId:', chatId);
        
        try {
            const chat = this.chats.find(c => c.id === chatId);
            if (!chat) {
                console.error('❌ Chat not found in local state:', chatId);
                return;
            }

            console.log('✅ ACTIVE CHAT ID:', chatId);

            // CRITICAL: Clear current chat state before loading new one
            // Unsubscribe from previous chat messages
            if (this.messagesSubscription) {
                this.supabase.removeChannel(this.messagesSubscription);
                this.messagesSubscription = null;
            }
            
            this.currentChatId = null;
            this.currentChatName = null;
            if (this.chatContainer) {
                this.chatContainer.innerHTML = '';
            }

            // Set new chat
            this.currentChatId = chatId;
            this.currentChatName = chat.name;
            
            // Show chat header
            if (this.chatHeader) {
                this.chatHeader.style.display = 'flex';
            }
            if (this.currentChatTitle) {
                this.currentChatTitle.textContent = chat.name;
            }
            
            // Load messages for THIS chat only
            await this.loadChatMessages(chatId);
            
            // Update realtime subscription for new chat
            this.subscribeToCurrentChatMessages();
            
            this.renderChatsList();
            this.updateChatContainerTitle();
            this.closeSidebar();
            
            this.updateDebugPanel();
        } catch (error) {
            console.error('❌ Failed to load chat:', error);
            this.showNotification('Error', `Failed to load chat: ${error.message}`);
        }
    }

    async loadChatMessages(chatId) {
        console.log('💬 LOADING MESSAGES - chatId:', chatId, 'userId:', this.userId);
        
        // CRITICAL: Verify chat belongs to user before loading messages
        if (!chatId || !this.userId) {
            console.warn('❌ Cannot load messages: missing chatId or userId');
            return;
        }

        try {
            // CRITICAL: Verify chat ownership first
            const { data: chatData, error: chatError } = await this.supabase
                .from('chats')
                .select('id, name')
                .eq('id', chatId)
                .eq('user_id', this.userId)
                .single();

            console.log('💬 CHAT VERIFICATION:', chatData);
            console.log('💬 CHAT ERROR:', chatError);

            if (chatError || !chatData) {
                console.error('❌ Chat not found or access denied:', chatError);
                if (this.chatContainer) {
                    this.chatContainer.innerHTML = `<div class="welcome-message"><p>Error: Chat not found or access denied</p></div>`;
                }
                return;
            }

            // CRITICAL: Load messages with BOTH user_id AND chat_id filters
            let { data, error } = await this.supabase
                .from('messages')
                .select('*')
                .eq('user_id', this.userId)  // CRITICAL: Filter by user
                .eq('chat_id', chatId)       // CRITICAL: Filter by chat
                .order('created_at', { ascending: true });

            console.log('💬 MESSAGES DATA:', data);
            console.log('💬 MESSAGES ERROR:', error);
            console.log('💬 MESSAGES COUNT:', data ? data.length : 0);

            if (error) {
                console.error('❌ MESSAGES QUERY ERROR:', error);
                
                // Provide helpful error messages
                if (error.message && (error.message.includes('schema cache') || error.message.includes('does not exist') || error.message.includes('relation'))) {
                    // Schema cache error - table exists (messages are saving), so this is a cache issue
                    // Try to refresh by re-querying
                    console.log('⚠️ Schema cache error detected, attempting to refresh...');
                    const retryResult = await this.supabase
                        .from('messages')
                        .select('*')
                        .eq('chat_id', chatId)
                        .eq('user_id', this.userId)
                        .order('created_at', { ascending: true });
                    
                    if (retryResult.error) {
                        // Still failing, show error
                        const errorMsg = `CRITICAL: Messages table schema cache issue!\n\n` +
                            `Error: ${retryResult.error.message}\n\n` +
                            `The table exists (messages are saving), but the client cache is stale.\n\n` +
                            `Try refreshing the page. If the issue persists, check Supabase dashboard.`;
                        console.error('❌ Retry also failed:', retryResult.error);
                        if (this.chatContainer) {
                            this.chatContainer.innerHTML = `<div class="welcome-message" style="color: red;"><p>Error: Schema cache issue. Try refreshing the page.</p><p>${retryResult.error.message}</p></div>`;
                        }
                        return;
                    } else {
                        // Retry succeeded, use the data
                        console.log('✅ Schema cache refresh succeeded');
                        data = retryResult.data;
                        error = null;
                    }
                } else if (error.message && (error.message.includes('permission') || error.message.includes('policy'))) {
                    const errorMsg = `Permission Error: Row Level Security (RLS) is blocking message access.\n\n` +
                        `Error: ${error.message}\n\n` +
                        `Please check RLS policies for the messages table in Supabase Dashboard.`;
                    this.showNotification('Permission Error', errorMsg);
                    if (this.chatContainer) {
                        this.chatContainer.innerHTML = `<div class="welcome-message" style="color: red;"><p>Error: Permission denied. Check RLS policies.</p><p>${error.message}</p></div>`;
                    }
                    return;
                } else {
                    // Other error, throw it
                    throw error;
                }
            }

            // Clear chat container
            if (this.chatContainer) {
                this.chatContainer.innerHTML = '';
            }

            if (data && data.length > 0) {
                console.log('✅ RENDERING', data.length, 'MESSAGES for chat:', chatId);
                // CRITICAL: Clear container first, then render only messages for THIS chat
                if (this.chatContainer) {
                    this.chatContainer.innerHTML = '';
                }
                // Render all messages (already filtered by query)
                data.forEach(msg => {
                    this.addMessageToUI(msg.content, msg.role, false);
                });
            } else {
                console.log('ℹ️ No messages found for this chat');
                if (this.chatContainer) {
                    this.chatContainer.innerHTML = `
                        <div class="welcome-message">
                            <p>Chat: ${this.escapeHtml(chatData.name || 'New Chat')}</p>
                            <p>Start the conversation!</p>
                        </div>
                    `;
                }
            }
            
            // Update debug panel
            this.updateDebugPanel();
        } catch (error) {
            console.error('❌ Failed to load messages:', error);
            if (this.chatContainer) {
                this.chatContainer.innerHTML = `
                    <div class="welcome-message">
                        <p>Error loading messages: ${error.message}</p>
                    </div>
                `;
            }
        }
    }

    updateChatContainerTitle() {
        // Could update header or add title to chat container
        if (this.currentChatName) {
            const welcome = this.chatContainer.querySelector('.welcome-message');
            if (welcome && this.chatContainer.children.length === 1) {
                welcome.innerHTML = `
                    <p>Chat: ${this.escapeHtml(this.currentChatName)}</p>
                    <p>Start the conversation!</p>
                `;
            }
        }
    }

    async deleteChat(chatId) {
        console.log('🗑️ DELETE CHAT CALLED - chatId:', chatId, 'userId:', this.userId);
        
        if (!chatId) {
            if (!this.currentChatId) {
                this.newChat();
                return;
            }
            chatId = this.currentChatId;
        }

        if (!this.userId || !this.supabase) {
            console.error('❌ Cannot delete chat: missing userId or supabase');
            this.showNotification('Error', 'Not authenticated');
            return;
        }

        const confirmed = await this.showConfirmDialog('Delete Chat?', 'Are you sure you want to delete this chat? All messages will be permanently deleted.');
        if (!confirmed) {
            return;
        }

        try {
            console.log('🗑️ DELETING MESSAGES for chat:', chatId);
            // Delete all messages for this chat
            const { error: messagesError, data: messagesData } = await this.supabase
                .from('messages')
                .delete()
                .eq('chat_id', chatId)
                .eq('user_id', this.userId);

            console.log('🗑️ MESSAGES DELETE RESULT:', messagesData);
            console.log('🗑️ MESSAGES DELETE ERROR:', messagesError);

            if (messagesError) {
                console.error('❌ Failed to delete messages:', messagesError);
                // Check if it's a schema cache error
                if (messagesError.message && (messagesError.message.includes('schema cache') || messagesError.message.includes('does not exist') || messagesError.message.includes('relation'))) {
                    // Try to refresh the schema by re-querying
                    console.log('⚠️ Schema cache error detected, attempting to refresh...');
                    // The table exists (messages are saving), so this is a cache issue
                    // Try the delete again without select
                    const { error: retryError } = await this.supabase
                        .from('messages')
                        .delete()
                        .eq('chat_id', chatId)
                        .eq('user_id', this.userId);
                    
                    if (retryError) {
                        throw new Error(`Failed to delete messages: ${retryError.message}`);
                    }
                } else {
                    throw new Error(`Failed to delete messages: ${messagesError.message}`);
                }
            }

            console.log('🗑️ DELETING CHAT:', chatId);
            // Delete the chat itself (cascade will handle messages)
            const { error: chatError, data: chatData } = await this.supabase
                .from('chats')
                .delete()
                .eq('id', chatId)
                .eq('user_id', this.userId);

            console.log('🗑️ CHAT DELETE RESULT:', chatData);
            console.log('🗑️ CHAT DELETE ERROR:', chatError);

            if (chatError) {
                console.error('❌ Failed to delete chat:', chatError);
                throw new Error(`Failed to delete chat: ${chatError.message}`);
            }

            console.log('✅ CHAT DELETED SUCCESSFULLY');

            // If this was the current chat, reset
            if (chatId === this.currentChatId) {
                this.currentChatId = null;
                this.currentChatName = null;
                if (this.chatHeader) {
                    this.chatHeader.style.display = 'none';
                }
                if (this.chatContainer) {
                    this.chatContainer.innerHTML = `
                        <div class="welcome-message">
                            <p>Hello! I'm your voidzenzi AI assistant.</p>
                            <p>Click "New Chat" to start a conversation.</p>
                        </div>
                    `;
                }
            }

            // Reload chats list
            await this.loadChats();
            this.updateDebugPanel();
            
            // Show success message
            if (this.chatContainer && chatId === this.currentChatId) {
                // Already handled above
            }
        } catch (error) {
            console.error('❌ Failed to delete chat:', error);
            this.showNotification('Error', `Failed to delete chat: ${error.message}`);
        }
    }

    async deleteAccount() {
        const confirmed1 = await this.showConfirmDialog('⚠️ Warning: Account Deletion', 'This will permanently delete your account and ALL your data (chats, messages, coins, settings, etc.).\n\nThis action CANNOT be undone!\n\nAre you absolutely sure?');
        if (!confirmed1) {
            return;
        }
        
        const confirmed2 = await this.showConfirmDialog('Final Confirmation', 'This is your LAST chance to cancel. Click OK to permanently delete your account.');
        if (!confirmed2) {
            return;
        }
        
        try {
            const response = await fetch(`${this.apiUrl}/users/delete`, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: this.userId })
            });
            
            if (response.ok) {
                this.showNotification('Account Deleted', 'Account deleted successfully. You will be logged out now.');
                // Sign out and redirect
                await this.supabase.auth.signOut();
                window.location.href = 'login.html';
            } else {
                const error = await response.json();
                throw new Error(error.error || 'Failed to delete account');
            }
        } catch (error) {
            console.error('Delete account error:', error);
            this.showNotification('Error', `Failed to delete account: ${error.message}`);
        }
    }

    async clearCurrentChat() {
        if (!this.currentChatId) {
            this.newChat();
            return;
        }

        const confirmed = await this.showConfirmDialog('Clear Chat?', 'Are you sure you want to clear all messages in this chat? This cannot be undone.');
        if (!confirmed) {
            return;
        }

        try {
            console.log('🗑️ CLEARING CHAT - chatId:', this.currentChatId, 'userId:', this.userId);
            
            // Delete all messages
            const { error: messagesError, data: messagesData } = await this.supabase
                .from('messages')
                .delete()
                .eq('chat_id', this.currentChatId)
                .eq('user_id', this.userId);

            console.log('🗑️ CLEAR MESSAGES RESULT:', messagesData);
            console.log('🗑️ CLEAR MESSAGES ERROR:', messagesError);

            if (messagesError) {
                console.error('❌ Failed to clear messages:', messagesError);
                // Check if it's a schema cache error
                if (messagesError.message && (messagesError.message.includes('schema cache') || messagesError.message.includes('does not exist') || messagesError.message.includes('relation'))) {
                    // Try to refresh the schema by re-querying
                    console.log('⚠️ Schema cache error detected, attempting to refresh...');
                    // The table exists (messages are saving), so this is a cache issue
                    // Try the delete again
                    const { error: retryError } = await this.supabase
                        .from('messages')
                        .delete()
                        .eq('chat_id', this.currentChatId)
                        .eq('user_id', this.userId);
                    
                    if (retryError) {
                        throw new Error(`Failed to clear messages: ${retryError.message}`);
                    }
                } else {
                    throw new Error(`Failed to clear messages: ${messagesError.message}`);
                }
            }

            // Clear UI
            if (this.chatContainer) {
                this.chatContainer.innerHTML = `
                    <div class="welcome-message">
                        <p>Chat: ${this.escapeHtml(this.currentChatName || 'New Chat')}</p>
                        <p>Start the conversation!</p>
                    </div>
                `;
            }

            console.log('✅ CHAT CLEARED SUCCESSFULLY');
            this.updateDebugPanel();
        } catch (error) {
            console.error('❌ Failed to clear chat:', error);
            this.showNotification('Error', `Failed to clear chat: ${error.message}`);
        }
    }

    newChat() {
        this.currentChatId = null;
        this.currentChatName = null;
        
        // Hide chat header
        if (this.chatHeader) {
            this.chatHeader.style.display = 'none';
        }
        
        this.chatContainer.innerHTML = `
            <div class="welcome-message">
                <p>Hello! I'm your voidzenzi AI assistant.</p>
                <p>Click "New Chat" to start a conversation.</p>
            </div>
        `;
        this.renderChatsList();
    }

    // ============================================
    // COMMAND HANDLING
    // ============================================
    async handleCommand(message) {
        const parts = message.trim().split(' ');
        const command = parts[0].toLowerCase();
        const args = parts.slice(1);

        console.log('🎯 COMMAND:', command, 'ARGS:', args);

        switch (command) {
            case '/pic':
                // Toggle picture mode
                this.settings.imageMode = !this.settings.imageMode;
                this.applySettings();
                await this.saveSettingsToSupabase();
                this.showNotification('Picture Mode', this.settings.imageMode ? 'Picture mode ON' : 'Picture mode OFF');
                break;

            case '/clear':
                // Clear current chat
                await this.clearCurrentChat();
                break;

            case '/new':
                // Create new chat
                this.showNewChatModal();
                break;

            case '/settings':
                // Open settings
                this.showSettings();
                break;

            case '/help':
                // Show help
                this.showHelp();
                break;

            default:
                this.addMessageToUI(`Unknown command: ${command}. Type /help for available commands.`, 'assistant', true);
                break;
        }
    }

    showHelp() {
        const helpText = `
Available commands:
/pic - Toggle picture mode (generate images from text)
/clear - Clear current chat
/new - Create new chat
/settings - Open settings
/help - Show this help message
        `.trim();
        this.addMessageToUI(helpText, 'assistant', true);
    }

    // ============================================
    // MESSAGE HANDLING (STRICT SUPABASE)
    // ============================================
    async handleSend() {
        // Prevent multiple rapid calls (debouncing)
        if (this.isSending) {
            console.log('⏳ Send already in progress, ignoring...');
            return;
        }

        if (!this.userInput) return;
        const message = this.userInput.value.trim();
        if (!message && !this.uploadedImageData) return;

        // Handle slash commands
        if (message.startsWith('/')) {
            await this.handleCommand(message);
            this.userInput.value = '';
            return;
        }

        // ENFORCE: Must have a chat before sending
        if (!this.currentChatId) {
            // Automatically create a new chat with the first message as the name
            await this.createAutoNamedChat(message || 'Image Analysis');
        }

        // Set sending flag to prevent duplicates
        this.isSending = true;

        console.log('🚀 handleSend called');
        console.log('📝 Message:', message);
        console.log('📷 uploadedImageData exists:', !!this.uploadedImageData);
        console.log('📷 uploadedImageData length:', this.uploadedImageData?.length || 0);

        // Handle image upload
        let messageContent = message;
        let hasImage = false;
        let imageDataToSave = null;
        
        if (this.uploadedImageData) {
            hasImage = true;
            imageDataToSave = this.uploadedImageData;
            console.log('📷 Image data detected, length:', this.uploadedImageData.length);
            console.log('📷 Image data type:', typeof this.uploadedImageData);
            console.log('📷 Image data prefix:', this.uploadedImageData.substring(0, 50));
            // Add image to UI
            this.addImageToUI(this.uploadedImageData, 'user');
            
            // If no text message, create a default one
            if (!message) {
                messageContent = "Please analyze this image";
            }
        }

        // Add user message to UI
        if (message) {
            this.addMessageToUI(message, 'user', true);
        }
        this.userInput.value = '';
        if (this.sendButton) this.sendButton.disabled = true;

        // Save user message to Supabase (try without image data first to avoid column issues)
        try {
            await this.saveMessageToSupabase(messageContent, 'user', imageDataToSave);
        } catch (dbError) {
            console.warn('⚠️ Could not save image to database, but continuing...', dbError);
            // Try to save without image data as fallback
            await this.saveMessageToSupabase(messageContent, 'user', null);
        }

        // Clear image preview after saving
        if (hasImage) {
            this.removeImagePreview();
        }

        // Process identity information from user message (legacy)
        if (message) {
            await this.processIdentityMessage(message);
        }
        
        // Extract and save comprehensive memory from message (new system)
        if (message) {
            // Don't await - run in background
            this.extractAndSaveMemory(message).then(saved => {
                if (saved) {
                    console.log('✅ New memory extracted and saved from message');
                }
            });
        }

        // Remove welcome message
        const welcomeMsg = this.chatContainer.querySelector('.welcome-message');
        if (welcomeMsg) welcomeMsg.remove();

        // Show typing indicator
        let typingId = null;
        if (this.settings.typingIndicator) {
            typingId = this.showTypingIndicator();
        }

        try {
            // Handle different scenarios:
            // 1. Image uploaded -> analyze the image
            // 2. Picture mode enabled -> generate new image
            // 3. Regular text -> normal chat
            let response;
            
            if (hasImage) {
                // User uploaded an image - analyze it
                response = await fetch(`${this.apiUrl}/image`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ 
                        prompt: messageContent, 
                        userId: this.userId,
                        mode: this.settings.imageModeType || 'normal',
                        imageData: imageDataToSave
                    })
                });
            } else if (this.settings.imageMode) {
                // Picture mode enabled - generate new image
                response = await fetch(`${this.apiUrl}/image`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ 
                        prompt: messageContent, 
                        userId: this.userId,
                        mode: this.settings.imageModeType || 'normal'
                    })
                });
            } else {
                // Regular text chat (also sends userId so backend can use remembered image for follow-ups)
                const history = await this.getConversationHistory();
                response = await fetch(`${this.apiUrl}/chat`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        message: message,
                        history: history,
                        userId: this.userId,
                        simpleLanguage: this.settings.simpleLanguage,
                        mode: this.settings.chatMode || 'fast',
                        mood: this.settings.mood || 'friendly',
                        errorFreeMode: this.settings.errorFreeMode,
                        systemPrompt: this.getPersonalizedSystemPrompt()
                    })
                });
            }

                if (typingId) this.hideTypingIndicator(typingId);

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to get response');
            }

            let data;
            try {
                data = await response.json();
                console.log('📨 Response data received:', data);
            } catch (jsonError) {
                console.error('❌ JSON parse error:', jsonError);
                const responseText = await response.text();
                console.error('❌ Raw response:', responseText);
                throw new Error('Invalid response format from server');
            }
            
            // Handle response — show uploaded image thumbnail + AI text response
            if (hasImage && imageDataToSave) {
                const imageId = 'img-' + Date.now();
                if (!window._voidzenImageCache) window._voidzenImageCache = {};
                window._voidzenImageCache[imageId] = imageDataToSave;
                const imageHtml = `
                    <div class="message-image">
                        <img id="${imageId}" src="${imageDataToSave}" alt="Uploaded image"
                            style="max-width: 250px; border-radius: 8px; cursor: pointer; transition: opacity 0.2s;"
                            onclick="window.aiAssistant.openImageLightbox('${imageId}')"
                            onmouseover="this.style.opacity='0.85'" onmouseout="this.style.opacity='1'"
                            title="Click to view full size & download">
                    </div>`;
                this.addMessageToUI(imageHtml, 'assistant', true);
                this.addMessageToUI(data.response, 'assistant', true);
                await this.saveMessageToSupabase(data.response, 'assistant');
            } else {
                // Regular text response
                this.addMessageToUI(data.response, 'assistant', true);
                await this.saveMessageToSupabase(data.response, 'assistant');
            }
            
            // Refresh user data and play sound
            await this.loadUserInfo();
            this.updateUserProfile();
            this.playSound('receive');
        } catch (error) {
            if (typingId) this.hideTypingIndicator(typingId);
            this.showErrorMessage(error.message || 'Failed to communicate with AI');
        } finally {
            if (this.sendButton) this.sendButton.disabled = false;
            if (this.userInput) this.userInput.focus();
            // Reset sending flag to allow new messages
            this.isSending = false;
        }
    }

    async getConversationHistory() {
        // CRITICAL: Must have both chat_id and user_id
        if (!this.currentChatId || !this.userId) return [];

        try {
            // CRITICAL: Filter by BOTH user_id AND chat_id
            const { data, error } = await this.supabase
                .from('messages')
                .select('role, content, chat_id, user_id')
                .eq('user_id', this.userId)      // CRITICAL: User filter
                .eq('chat_id', this.currentChatId) // CRITICAL: Chat filter
                .order('created_at', { ascending: true })
                .limit(20); // Last 20 messages

            if (error) throw error;
            
            // CRITICAL: Double-check message ownership and return only role/content
            return (data || [])
                .filter(msg => msg.chat_id === this.currentChatId && msg.user_id === this.userId)
                .map(msg => ({ role: msg.role, content: msg.content }));
        } catch (error) {
            console.error('Failed to load conversation history:', error);
            return [];
        }
    }

    async saveMessageToSupabase(content, role, imageData = null) {
        console.log('💬 SAVING MESSAGE - role:', role, 'chatId:', this.currentChatId, 'userId:', this.userId);
        console.log('💬 MESSAGE CONTENT LENGTH:', content ? content.length : 0);
        console.log('💬 HAS IMAGE:', imageData ? 'YES' : 'NO');
        
        // CRITICAL: Must have both chat_id and user_id
        if (!this.currentChatId) {
            console.error('❌ Cannot save message: missing currentChatId');
            this.showErrorMessage('Error: No active chat. Please create a chat first.');
            return;
        }
        
        if (!this.supabase) {
            console.error('❌ Cannot save message: missing Supabase client');
            this.showErrorMessage('Error: Database connection failed');
            return;
        }
        
        if (!this.userId) {
            console.error('❌ Cannot save message: missing userId');
            this.showErrorMessage('Error: Not authenticated');
            return;
        }

        if (!content || content.trim() === '') {
            console.warn('⚠️ Cannot save empty message');
            return;
        }

        try {
            // CRITICAL: Verify chat ownership before saving
            const { data: chatData, error: chatError } = await this.supabase
                .from('chats')
                .select('id')
                .eq('id', this.currentChatId)
                .eq('user_id', this.userId)
                .single();

            console.log('💬 CHAT VERIFICATION FOR SAVE:', chatData);
            console.log('💬 CHAT VERIFICATION ERROR:', chatError);

            if (chatError || !chatData) {
                console.error('❌ Cannot save message: chat not found or access denied', chatError);
                this.showErrorMessage(`Error: Chat not found. ${chatError ? chatError.message : ''}`);
                return;
            }

            // CRITICAL: Save message with BOTH user_id and chat_id
            const messageData = {
                chat_id: this.currentChatId,
                user_id: this.userId,
                role: role,
                content: content
            };
            
            // Add image data if present
            if (imageData) {
                messageData.image_data = imageData;
            }
            
            const { data, error } = await this.supabase
                .from('messages')
                .insert(messageData)
                .select()
                .single();

            console.log('💬 MESSAGE SAVE RESULT:', data);
            console.log('💬 MESSAGE SAVE ERROR:', error);

            if (error) {
                console.error('❌ MESSAGE SAVE FAILED:', error);
                
                // Check if it's a table not found error
                if (error.message && ((error.message.includes('relation') || error.message.includes('table') || error.message.includes('schema cache')) && error.message.includes('does not exist'))) {
                    const errorMsg = `CRITICAL: Messages table doesn't exist in database!\n\n` +
                        `Error: ${error.message}\n\n` +
                        `Please run the SQL from FIX_MESSAGES_TABLE.sql in Supabase SQL Editor.\n\n` +
                        `Go to: Supabase Dashboard → SQL Editor → New Query → Paste SQL → Run`;
                    this.showNotification('Database Error', errorMsg);
                    this.showErrorMessage(`Messages table not found: ${error.message}`);
                } else if (error.message && (error.message.includes('permission denied') || error.message.includes('policy'))) {
                    const errorMsg = `Permission Error: Row Level Security (RLS) is blocking message saves.\n\n` +
                        `Error: ${error.message}\n\n` +
                        `Please check RLS policies for the messages table in Supabase Dashboard.\n\n` +
                        `The policy should allow users to INSERT their own messages.`;
                    this.showNotification('Permission Error', errorMsg);
                    this.showErrorMessage(`Permission denied: ${error.message}`);
                } else {
                    console.error('❌ SAVE MESSAGE ERROR DETAILS:', JSON.stringify(error, null, 2));
                    this.showErrorMessage(`Failed to save message: ${error.message || 'Unknown error'}`);
                }
                throw error;
            }

            if (!messageData) {
                console.error('❌ MESSAGE SAVE FAILED: No data returned');
                this.showErrorMessage('Failed to save message: No confirmation from database');
                return;
            }

            console.log('✅ Message saved successfully - ID:', messageData.id);

            // Update coin counter if coins changed (from games, etc.)
            await this.loadUserInfo();
            this.updateCoinCounter();

            // Update chat's updated_at timestamp
            const { error: updateError } = await this.supabase
                .from('chats')
                .update({ updated_at: new Date().toISOString() })
                .eq('id', this.currentChatId)
                .eq('user_id', this.userId); // CRITICAL: Also filter by user

            if (updateError) {
                console.warn('⚠️ Failed to update chat timestamp:', updateError);
            }
                
            this.updateDebugPanel();
        } catch (error) {
            console.error('❌ Failed to save message to Supabase:', error);
            this.showErrorMessage(`Failed to save message: ${error.message || 'Unknown error'}`);
        }
    }

    addMessageToUI(text, sender, animate = true) {
        if (!this.chatContainer) return;

        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${sender}`;
        if (!animate) messageDiv.style.animation = 'none';
        
        const avatarDiv = document.createElement('div');
        avatarDiv.className = 'message-avatar';
        if (sender === 'user') {
            avatarDiv.textContent = 'You';
        } else {
            avatarDiv.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2L2 7l10 5 10-5-10-5z"></path><path d="M2 17l10 5 10-5"></path><path d="M2 12l10 5 10-5"></path></svg>';
        }
        
        const contentDiv = document.createElement('div');
        contentDiv.className = 'message-content';
        
        // Check if text contains HTML (like image tags)
        const containsHtml = /<[a-z][\s\S]*>/i.test(text);
        
        if (containsHtml) {
            // Text contains HTML - render it directly (for images, etc.)
            contentDiv.innerHTML = text;
        } else {
            // Plain text - format newlines and apply typing effect
            const formattedText = text.replace(/\n/g, '<br>');
            const shouldTypeEffect = sender === 'assistant' &&
                this.settings.typingEffect &&
                this.settings.animations &&
                animate;

            if (shouldTypeEffect) {
                contentDiv.innerHTML = '';
                this.typeText(contentDiv, text);
            } else {
                contentDiv.innerHTML = formattedText;
            }

            if (sender === 'assistant' && this.settings.ttsEnabled) {
                this.speakText(text);
            }
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
    }

    addImageToUI(imageData, sender) {
        if (!this.chatContainer) return;

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
        
        const imageElement = document.createElement('img');
        imageElement.src = imageData;
        imageElement.alt = 'Uploaded image';
        imageElement.style.cssText = `
            max-width: 100%;
            max-height: 300px;
            border-radius: 8px;
            object-fit: contain;
            margin-bottom: 8px;
        `;
        
        contentDiv.appendChild(imageElement);
        
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
    }

    // ============================================
    // SETTINGS MANAGEMENT (STRICT SUPABASE)
    // ============================================
    _settingsKey() { return `voidzenzi_settings_${this.userId}`; }

    async loadSettingsFromSupabase() {
        console.log('⚙️ LOADING SETTINGS - userId:', this.userId);

        // CRITICAL: Must have userId
        if (!this.supabase || !this.userId) {
            console.warn('❌ Cannot load settings: missing Supabase client or userId');
            this.settings = this.getDefaultSettings();
            return;
        }

        // Apply cached settings instantly so UI doesn't flash defaults while Supabase loads
        try {
            const cached = localStorage.getItem(this._settingsKey());
            if (cached) {
                this.settings = { ...this.getDefaultSettings(), ...JSON.parse(cached) };
                this.applySettings();
                console.log('⚙️ Applied cached settings from localStorage');
            }
        } catch(_) {}

        try {
            // CRITICAL: Load settings for THIS user only
            const { data, error } = await this.supabase
                .from('user_settings')
                .select('settings')
                .eq('user_id', this.userId)  // CRITICAL: Filter by user_id
                .single();

            console.log('⚙️ SETTINGS LOAD:', data);
            console.log('⚙️ SETTINGS ERROR:', error);

            if (error) {
                console.error('❌ Failed to load settings:', error);
                console.error('❌ SETTINGS LOAD ERROR DETAILS:', JSON.stringify(error, null, 2));
                
                if (error.code === 'PGRST116') { // PGRST116 = no rows
                    console.log('ℹ️ No settings found, creating defaults');
                    this.settings = this.getDefaultSettings();
                    await this.saveSettingsToSupabase();
                    return;
                }
                
                if (error.message && (error.message.includes('relation') || error.message.includes('does not exist'))) {
                    console.error('❌ Settings table not found');
                    this.settings = this.getDefaultSettings();
                    // Try to create it
                    await this.saveSettingsToSupabase();
                    return;
                }
                
                // Use default settings on other errors
                this.settings = this.getDefaultSettings();
                return;
            }

            // CRITICAL: Merge with defaults to ensure all settings exist
            if (data && data.settings) {
                console.log('✅ SETTINGS LOADED FROM DB');
                this.settings = { ...this.getDefaultSettings(), ...data.settings };
                // Update localStorage cache so next load is instant
                try { localStorage.setItem(this._settingsKey(), JSON.stringify(this.settings)); } catch(_) {}
            } else {
                console.log('ℹ️ No settings found, using defaults');
                // No settings found, use defaults and save them
                this.settings = this.getDefaultSettings();
                await this.saveSettingsToSupabase();
            }

            // Update UI toggles
            if (this.simpleLanguageToggle) {
                this.simpleLanguageToggle.checked = this.settings.simpleLanguage;
            }
            
            // Memory toggle removed
            this.updateDebugPanel();
        } catch (error) {
            console.error('❌ Error loading settings:', error);
            // Use default settings on error
            this.settings = this.getDefaultSettings();
        }
    }

    async saveSettingsToSupabase() {
        console.log('💾 SAVING SETTINGS - userId:', this.userId);

        // Always save to localStorage immediately so next load is instant
        try {
            if (this.userId) localStorage.setItem(this._settingsKey(), JSON.stringify(this.settings));
        } catch(_) {}

        // CRITICAL: Must have userId
        if (!this.supabase) {
            console.error('❌ Cannot save settings: missing Supabase client');
            if (this.settingsMessage) {
                this.settingsMessage.textContent = 'Error: Database connection failed';
                this.settingsMessage.className = 'settings-message error';
            }
            return;
        }
        
        if (!this.userId) {
            console.error('❌ Cannot save settings: missing userId');
            if (this.settingsMessage) {
                this.settingsMessage.textContent = 'Error: Not authenticated';
                this.settingsMessage.className = 'settings-message error';
            }
            return;
        }

        try {
            // Check if settings exist
            const { data: existing, error: checkError } = await this.supabase
                .from('user_settings')
                .select('user_id')
                .eq('user_id', this.userId)
                .single();

            console.log('💾 EXISTING SETTINGS CHECK:', existing);
            console.log('💾 EXISTING SETTINGS CHECK ERROR:', checkError);

            if (checkError && checkError.code !== 'PGRST116') {
                console.error('❌ Error checking existing settings:', checkError);
            }

            let error;
            let result;
            
            if (existing && existing.user_id === this.userId) {
                console.log('💾 UPDATING EXISTING SETTINGS');
                // Update existing
                const { data: updateData, error: updateError } = await this.supabase
                    .from('user_settings')
                    .update({
                        settings: this.settings,
                        updated_at: new Date().toISOString()
                    })
                    .eq('user_id', this.userId)
                    .select()
                    .single();
                error = updateError;
                result = updateData;
            } else {
                console.log('💾 INSERTING NEW SETTINGS');
                // Insert new
                const { data: insertData, error: insertError } = await this.supabase
                    .from('user_settings')
                    .insert({
                        user_id: this.userId,
                        settings: this.settings,
                        updated_at: new Date().toISOString()
                    })
                    .select()
                    .single();
                error = insertError;
                result = insertData;
            }

            console.log('💾 SETTINGS SAVE RESULT:', result);
            console.log('💾 SETTINGS SAVE ERROR:', error);

            if (error) {
                console.error('❌ SETTINGS SAVE FAILED:', error);
                throw new Error(error.message || 'Failed to save settings');
            }

            if (!result) {
                console.error('❌ SETTINGS SAVE FAILED: No data returned');
                throw new Error('No confirmation from database');
            }

            console.log('✅ SETTINGS SAVED SUCCESSFULLY - user_id:', result.user_id);
            this.updateDebugPanel();

            if (this.settingsMessage) {
                this.settingsMessage.textContent = 'Settings saved!';
                this.settingsMessage.className = 'settings-message success';
                setTimeout(() => {
                    this.settingsMessage.textContent = '';
                    this.settingsMessage.className = 'settings-message';
                }, 3000);
            }
        } catch (error) {
            console.error('❌ Failed to save settings:', error);
            if (this.settingsMessage) {
                this.settingsMessage.textContent = `Failed to save settings: ${error.message || 'Unknown error'}`;
                this.settingsMessage.className = 'settings-message error';
            }
        }
    }

    loadSettingsToForm() {
        // Avatar change button
        this._initAvatarChangeUI();

        // Theme
        const themeEl = document.getElementById(`theme${this.settings.theme.charAt(0).toUpperCase() + this.settings.theme.slice(1)}`);
        if (themeEl) themeEl.checked = true;
        
        // Accent Color
        const accentEl = document.getElementById(`accent${this.settings.accentColor.charAt(0).toUpperCase() + this.settings.accentColor.slice(1)}`);
        if (accentEl) accentEl.checked = true;
        
        // Font Size
        const fontSizeEl = document.getElementById(`font${this.settings.fontSize.charAt(0).toUpperCase() + this.settings.fontSize.slice(1)}`);
        if (fontSizeEl) fontSizeEl.checked = true;
        
        // Font Style
        const fontStyleEl = document.getElementById('fontStyle');
        if (fontStyleEl) fontStyleEl.value = this.settings.fontStyle;
        
        // Bubble Style
        const bubbleEl = document.getElementById(`bubble${this.settings.bubbleStyle.charAt(0).toUpperCase() + this.settings.bubbleStyle.slice(1)}`);
        if (bubbleEl) bubbleEl.checked = true;
        
        // Message Alignment
        const alignEl = document.getElementById(`align${this.settings.messageAlignment.charAt(0).toUpperCase() + this.settings.messageAlignment.slice(1)}`);
        if (alignEl) alignEl.checked = true;
        
        // Send Button Style
        const sendBtnEl = document.getElementById(`send${this.settings.sendButtonStyle.charAt(0).toUpperCase() + this.settings.sendButtonStyle.slice(1)}`);
        if (sendBtnEl) sendBtnEl.checked = true;
        
        // Toggles
        const toggles = {
            'typingIndicator': this.settings.typingIndicator,
            'showTimestamps': this.settings.showTimestamps,
            'autoScroll': this.settings.autoScroll,
            'soundEffects': this.settings.soundEffects,
            'animations': this.settings.animations,
            'compactMode': this.settings.compactMode,
            'settingsSimpleLanguage': this.settings.simpleLanguage,
            'ttsEnabled': this.settings.ttsEnabled,
            'imageMode': this.settings.imageMode,
            'typingEffect': this.settings.typingEffect,
            'errorFreeMode': this.settings.errorFreeMode
        };

        Object.entries(toggles).forEach(([id, value]) => {
            const el = document.getElementById(id);
            if (el) el.checked = value;
        });

        // Radio groups
        const ttsVoiceEl = document.getElementById(`ttsVoice${this.settings.ttsVoice.charAt(0).toUpperCase() + this.settings.ttsVoice.slice(1)}`);
        if (ttsVoiceEl) ttsVoiceEl.checked = true;

        document.querySelectorAll('input[name="chatMode"]').forEach(radio => {
                radio.checked = (radio.value === this.settings.chatMode);
            });

        document.querySelectorAll('input[name="mood"]').forEach(radio => {
                radio.checked = (radio.value === this.settings.mood);
            });

        document.querySelectorAll('input[name="imageModeType"]').forEach(radio => {
            radio.checked = (radio.value === this.settings.imageModeType);
        });
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
        if (container) {
        container.className = container.className.replace(/bubble-\w+/g, '');
        container.classList.add(`bubble-${this.settings.bubbleStyle}`);
        }

        // Message Alignment
        if (this.chatContainer) {
        this.chatContainer.className = this.chatContainer.className.replace(/align-\w+/g, '');
        this.chatContainer.classList.add(`align-${this.settings.messageAlignment}`);
        }

        // Animations
        if (!this.settings.animations) {
            body.classList.add('no-animations');
        } else {
            body.classList.remove('no-animations');
        }

        // Compact Mode
        if (container) {
        if (this.settings.compactMode) {
            container.classList.add('compact-mode');
        } else {
            container.classList.remove('compact-mode');
            }
        }

        // Send Button Style
        this.updateSendButtonStyle();
    }

    updateSendButtonStyle() {
        if (!this.sendButton) return;
        
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

    showChat() {
        this.chatView.classList.add('active');
        this.settingsView.classList.remove('active');
        if (this.userInput) this.userInput.focus();
    }

    _initAvatarChangeUI() {
        const input  = document.getElementById('settingsAvatarInput');
        const btn    = document.getElementById('settingsChangeAvatarBtn');
        const msg    = document.getElementById('settingsAvatarMsg');
        if (!input || btn._avatarBound) return;
        btn._avatarBound = true;

        const compressImg = (file) => new Promise(resolve => {
            const reader = new FileReader();
            reader.onload = e => {
                const img = new Image();
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    const scale = Math.min(120 / img.width, 120 / img.height, 1);
                    canvas.width  = Math.round(img.width  * scale);
                    canvas.height = Math.round(img.height * scale);
                    canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
                    resolve(canvas.toDataURL('image/jpeg', 0.8));
                };
                img.src = e.target.result;
            };
            reader.readAsDataURL(file);
        });

        btn.addEventListener('click', () => input.click());

        input.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file || !this.userId) return;

            msg.textContent = 'Uploading...';
            msg.style.display = 'block';
            msg.style.color = '#667eea';

            try {
                const dataUrl = await compressImg(file);

                // Save to server
                const resp = await fetch(`${this.apiUrl}/users/update-avatar`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ userId: this.userId, avatar_url: dataUrl })
                });
                if (!resp.ok) throw new Error('Server error');

                this.userAvatarUrl = dataUrl;
                this.updateUserProfile();

                msg.textContent = '✅ Profile picture updated!';
                msg.style.color = '#16a34a';
                setTimeout(() => { msg.style.display = 'none'; }, 3000);
            } catch (err) {
                msg.textContent = '❌ Failed to update. Try again.';
                msg.style.color = '#ef4444';
            }
            input.value = '';
        });
    }

    showSettings() {
        this.chatView.classList.remove('active');
        this.settingsView.classList.add('active');
        this.loadSettingsToForm();
    }

    // ============================================
    // CHAT MANAGEMENT (STRICT SUPABASE)
    // ============================================
    async deleteAllChats() {
        const confirmed = await this.showConfirmDialog('Delete All Chats?', 'Are you sure you want to delete ALL your chats and messages? This cannot be undone.');
        if (!confirmed) {
            return;
        }

        try {
            // Delete all messages for the user
            const { error: messagesError } = await this.supabase
                .from('messages')
                .delete()
                .eq('user_id', this.userId);

            if (messagesError) {
                console.error('Failed to delete messages:', messagesError);
                throw messagesError;
            }

            // Delete all chats for the user
            const { error: chatsError } = await this.supabase
                .from('chats')
                .delete()
                .eq('user_id', this.userId);

            if (chatsError) {
                console.error('Failed to delete chats:', chatsError);
                throw chatsError;
            }

            // Delete all memories for the user
            const { error: memoriesError } = await this.supabase
                .from('memories')
                .delete()
                .eq('user_id', this.userId);

            if (memoriesError) {
                console.error('Failed to delete memories:', memoriesError);
                throw memoriesError;
            }

            this.showNotification('Success', 'All chats and messages have been deleted successfully.');
            
            // Refresh the chat list
            await this.loadChats();
            
            // Reset current chat
            this.currentChatId = null;
            this.currentChatName = null;
            if (this.chatContainer) {
                this.chatContainer.innerHTML = `
                    <div class="welcome-message">
                        <p>Hello! I'm your voidzenzi AI assistant. I'm here to help with clear, honest answers.</p>
                        <p>Click "New Chat" to start a conversation, or select an existing chat from the sidebar.</p>
                    </div>
                `;
            }
            
        } catch (error) {
            console.error('Failed to delete all chats:', error);
            this.showNotification('Error', `Failed to delete all chats: ${error.message}`);
        }
    }

    // ============================================
    // REALTIME SUBSCRIPTIONS (FIXED: Chat-specific)
    // ============================================
    setupRealtimeSubscriptions() {
        if (!this.supabase || !this.userId) return;

        // Unsubscribe from existing subscriptions
        this.unsubscribeRealtime();

        // Subscribe to chats changes
        this.chatsSubscription = this.supabase
            .channel('chats_changes')
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'chats',
                filter: `user_id=eq.${this.userId}`
            }, () => {
                this.loadChats();
            })
            .subscribe();

        // Subscribe to messages changes for CURRENT chat only
        this.subscribeToCurrentChatMessages();
    }

    subscribeToCurrentChatMessages() {
        // Unsubscribe from previous messages subscription
        if (this.messagesSubscription) {
            this.supabase.removeChannel(this.messagesSubscription);
            this.messagesSubscription = null;
        }

        // Only subscribe if we have a current chat
        if (this.currentChatId && this.supabase && this.userId) {
            this.messagesSubscription = this.supabase
                .channel(`messages_changes_${this.currentChatId}`)
                .on('postgres_changes', {
                    event: '*',
                    schema: 'public',
                    table: 'messages',
                    filter: `chat_id=eq.${this.currentChatId}`
                }, () => {
                    // CRITICAL: Reload messages for THIS chat only
                    if (this.currentChatId) {
                        this.loadChatMessages(this.currentChatId);
                    }
                })
                .subscribe();
        }
    }

    unsubscribeRealtime() {
        if (this.chatsSubscription) {
            this.supabase.removeChannel(this.chatsSubscription);
            this.chatsSubscription = null;
        }
        if (this.messagesSubscription) {
            this.supabase.removeChannel(this.messagesSubscription);
            this.messagesSubscription = null;
        }
    }

    // ============================================
    // TTS & SPEECH RECOGNITION
    // ============================================
    initTextToSpeech() {
        this.ttsSupported = 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window;
        this.currentUtterance = null;
        this.ttsVoices = [];

        if (!this.ttsSupported) {
            console.warn('Text-to-speech is not supported');
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

        window.speechSynthesis.cancel();
        this.currentUtterance = null;

        const utterance = new SpeechSynthesisUtterance(this.stripHtml(text));
        const voice = this.getPreferredVoice();
        if (voice) {
            utterance.voice = voice;
        }

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

    initSpeechRecognition() {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) {
            console.warn('Speech recognition not supported');
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
            this.showNotification('Feature Not Supported', 'Voice input not supported');
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

    // ============================================
    // IMAGE UPLOAD HANDLING
    // ============================================
    async handleImageUpload(event) {
        const file = event.target.files[0];
        if (!file) return;

        console.log('📁 File selected:', file.name, file.type, file.size);

        // Validate file type
        if (!file.type.startsWith('image/')) {
            this.showNotification('Invalid File', 'Please upload an image file');
            return;
        }

        // Validate file size (max 10MB)
        if (file.size > 10 * 1024 * 1024) {
            this.showNotification('File Too Large', 'Please upload an image smaller than 10MB');
            return;
        }

        try {
            // Convert image to base64
            const base64 = await this.fileToBase64(file);
            console.log('📷 Base64 conversion successful, length:', base64.length);
            this.uploadedImageData = base64;
            
            // Show image preview in input area
            this.showImagePreview(base64, file.name);
            
            // Update placeholder text
            if (this.userInput) {
                this.userInput.placeholder = "Type your instructions for the image...";
            }
            
            console.log('📷 Image uploaded successfully');
            console.log('📷 Current uploadedImageData state:', !!this.uploadedImageData);
        } catch (error) {
            console.error('❌ Image upload failed:', error);
            this.showNotification('Upload Failed', 'Failed to upload image. Please try again.');
        }
    }

    fileToBase64(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                const img = new Image();
                img.onload = () => {
                    // Compress image if it's too large
                    const canvas = document.createElement('canvas');
                    const ctx = canvas.getContext('2d');
                    
                    // Calculate new dimensions (max 800px width/height)
                    let width = img.width;
                    let height = img.height;
                    const maxSize = 800;
                    
                    if (width > maxSize || height > maxSize) {
                        if (width > height) {
                            height = (height * maxSize) / width;
                            width = maxSize;
                        } else {
                            width = (width * maxSize) / height;
                            height = maxSize;
                        }
                    }
                    
                    canvas.width = width;
                    canvas.height = height;
                    ctx.drawImage(img, 0, 0, width, height);
                    
                    // Convert to base64 with reduced quality
                    const compressedBase64 = canvas.toDataURL('image/jpeg', 0.7);
                    console.log('📷 Original size:', e.target.result.length);
                    console.log('📷 Compressed size:', compressedBase64.length);
                    resolve(compressedBase64);
                };
                img.onerror = reject;
                img.src = e.target.result;
            };
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }

    showImagePreview(base64, fileName) {
        // Remove existing preview if any
        const existingPreview = document.getElementById('imagePreview');
        if (existingPreview) {
            existingPreview.remove();
        }

        // Create preview element
        const preview = document.createElement('div');
        preview.id = 'imagePreview';
        preview.className = 'image-preview';
        preview.innerHTML = `
            <img src="${base64}" alt="Uploaded image" style="max-width: 100px; max-height: 100px; border-radius: 8px; object-fit: cover;">
            <div class="image-info">
                <span>${fileName}</span>
                <button type="button" id="removeImageBtn" class="btn-small btn-danger">✕</button>
            </div>
            <div class="image-hint">💡 AI will analyze this image when you send a message</div>
        `;

        // Style the preview
        preview.style.cssText = `
            display: flex;
            align-items: center;
            gap: 10px;
            padding: 8px;
            background: #f8f9fa;
            border-radius: 8px;
            margin-bottom: 8px;
            border: 1px solid #dee2e6;
        `;

        const imageInfo = preview.querySelector('.image-info');
        imageInfo.style.cssText = `
            display: flex;
            flex-direction: column;
            gap: 4px;
            flex: 1;
        `;

        const removeBtn = preview.querySelector('#removeImageBtn');
        removeBtn.style.cssText = `
            align-self: flex-start;
            padding: 2px 6px;
            font-size: 12px;
            border-radius: 4px;
            border: none;
            background: #dc3545;
            color: white;
            cursor: pointer;
        `;

        // Add remove functionality
        removeBtn.addEventListener('click', () => this.removeImagePreview());

        // Style the hint
        const hint = preview.querySelector('.image-hint');
        if (hint) {
            hint.style.cssText = `
                font-size: 12px;
                color: #666;
                margin-top: 4px;
                font-style: italic;
            `;
        }

        // Insert preview before input container
        const inputContainer = document.querySelector('.input-container');
        if (inputContainer && inputContainer.parentNode) {
            inputContainer.parentNode.insertBefore(preview, inputContainer);
        }
    }

    removeImagePreview() {
        const preview = document.getElementById('imagePreview');
        if (preview) {
            preview.remove();
        }
        this.uploadedImageData = null;
        if (this.imageInput) {
            this.imageInput.value = '';
        }
        if (this.userInput) {
            this.userInput.placeholder = "Type your message here...";
        }
    }

    // Download image method
    downloadImage(imageUrl, imageId) {
        console.log('📥 Downloading image:', imageUrl);
        
        // Generate proper filename with timestamp
        const timestamp = Date.now();
        const filename = `voidzen-image-${timestamp}.png`;
        
        // For external URLs, fetch and create a proper blob
        if (imageUrl.startsWith('http')) {
            fetch(imageUrl, {
                headers: {
                    'Accept': 'image/png,image/jpeg,image/webp,*/*'
                }
            })
                .then(response => {
                    if (!response.ok) {
                        throw new Error(`HTTP error! status: ${response.status}`);
                    }
                    return response.blob();
                })
                .then(blob => {
                    // Create blob with proper type
                    const imageBlob = new Blob([blob], { type: 'image/png' });
                    const blobUrl = URL.createObjectURL(imageBlob);
                    
                    // Create download link
                    const link = document.createElement('a');
                    link.href = blobUrl;
                    link.download = filename;
                    link.style.display = 'none';
                    
                    document.body.appendChild(link);
                    link.click();
                    
                    // Cleanup
                    setTimeout(() => {
                        document.body.removeChild(link);
                        URL.revokeObjectURL(blobUrl);
                    }, 100);
                    
                    console.log('✅ Image downloaded successfully as', filename);
                    this.showNotification('Download Complete', `Image saved as ${filename}`);
                })
                .catch(error => {
                    console.error('❌ Failed to download image:', error);
                    this.showNotification('Download Failed', 'Opening image in new tab instead');
                    window.open(imageUrl, '_blank');
                });
        } else if (imageUrl.startsWith('data:')) {
            // For data URLs (base64), download directly
            const link = document.createElement('a');
            link.href = imageUrl;
            link.download = filename;
            link.style.display = 'none';
            
            document.body.appendChild(link);
            link.click();
            
            setTimeout(() => {
                document.body.removeChild(link);
            }, 100);
            
            console.log('✅ Image downloaded successfully as', filename);
            this.showNotification('Download Complete', `Image saved as ${filename}`);
        } else {
            // Unknown format, open in new tab
            window.open(imageUrl, '_blank');
        }
    }

    // ============================================
    // IMAGE LIGHTBOX — click image to view fullscreen + download
    // ============================================
    openImageLightbox(imageId) {
        const imageUrl = window._voidzenImageCache && window._voidzenImageCache[imageId];
        if (!imageUrl) {
            console.error('No image found for id:', imageId);
            return;
        }

        // Remove existing lightbox if any
        const existing = document.getElementById('voidzen-lightbox');
        if (existing) existing.remove();

        const lightbox = document.createElement('div');
        lightbox.id = 'voidzen-lightbox';
        lightbox.style.cssText = `
            position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
            background: rgba(0,0,0,0.9); z-index: 99999;
            display: flex; flex-direction: column; align-items: center; justify-content: center;
            cursor: pointer; animation: fadeIn 0.2s ease;
        `;

        lightbox.innerHTML = `
            <img src="${imageUrl}" alt="Full size image" style="
                max-width: 90vw; max-height: 75vh; border-radius: 12px;
                box-shadow: 0 8px 32px rgba(0,0,0,0.5); object-fit: contain;
            ">
            <button id="lightbox-download-btn" style="
                margin-top: 20px; padding: 12px 28px;
                background: #4f8cff; color: white; border: none; border-radius: 8px;
                font-size: 16px; font-weight: 600; cursor: pointer;
                display: flex; align-items: center; gap: 8px;
                transition: background 0.2s;
            " onmouseover="this.style.background='#3a6fdf'" onmouseout="this.style.background='#4f8cff'">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                    <polyline points="7 10 12 15 17 10"></polyline>
                    <line x1="12" y1="15" x2="12" y2="3"></line>
                </svg>
                Download Image
            </button>
            <p style="color: rgba(255,255,255,0.5); margin-top: 12px; font-size: 13px;">Click anywhere to close</p>
        `;

        // Close on background click
        lightbox.addEventListener('click', (e) => {
            if (e.target === lightbox || e.target.tagName === 'P') {
                lightbox.remove();
            }
        });

        // Download button
        lightbox.querySelector('#lightbox-download-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            this.downloadImage(imageUrl, imageId);
        });

        document.body.appendChild(lightbox);
    }

    // ============================================
    // CAMERA FUNCTIONS
    // ============================================
    showCameraModal() {
        console.log('📷 SHOWING CAMERA MODAL');
        const modal = document.getElementById('cameraModal');
        if (modal) {
            modal.classList.add('show');
            this.resetCameraUI();
        }
    }

    closeCameraModal() {
        console.log('📷 CLOSING CAMERA MODAL');
        const modal = document.getElementById('cameraModal');
        if (modal) {
            modal.classList.remove('show');
        }
        this.stopCamera();
        this.resetCameraUI();
    }

    resetCameraUI() {
        const video = document.getElementById('cameraVideo');
        const canvas = document.getElementById('cameraCanvas');
        const preview = document.getElementById('cameraPreview');
        const placeholder = document.getElementById('cameraPlaceholder');
        const startBtn = document.getElementById('startCameraBtn');
        const captureBtn = document.getElementById('captureBtn');
        const retakeBtn = document.getElementById('retakeBtn');
        const usePhotoBtn = document.getElementById('usePhotoBtn');

        if (video) video.style.display = 'none';
        if (canvas) canvas.style.display = 'none';
        if (preview) preview.style.display = 'none';
        if (placeholder) placeholder.style.display = 'flex';
        if (startBtn) startBtn.style.display = 'inline-block';
        if (captureBtn) captureBtn.style.display = 'none';
        if (retakeBtn) retakeBtn.style.display = 'none';
        if (usePhotoBtn) usePhotoBtn.style.display = 'none';

        this.capturedPhotoData = null;
    }

    async startCamera() {
        console.log('📷 STARTING CAMERA');
        const video = document.getElementById('cameraVideo');
        const placeholder = document.getElementById('cameraPlaceholder');
        const startBtn = document.getElementById('startCameraBtn');
        const captureBtn = document.getElementById('captureBtn');

        try {
            this.cameraStream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: 'environment' },
                audio: false
            });

            if (video) {
                video.srcObject = this.cameraStream;
                video.style.display = 'block';
                if (placeholder) placeholder.style.display = 'none';
                if (startBtn) startBtn.style.display = 'none';
                if (captureBtn) captureBtn.style.display = 'inline-block';
            }
        } catch (error) {
            console.error('❌ Failed to start camera:', error);
            this.showNotification('Camera Error', 'Could not access camera. Please make sure you have granted camera permissions.');
        }
    }

    stopCamera() {
        if (this.cameraStream) {
            this.cameraStream.getTracks().forEach(track => track.stop());
            this.cameraStream = null;
        }
    }

    capturePhoto() {
        console.log('📸 CAPTURING PHOTO');
        const video = document.getElementById('cameraVideo');
        const canvas = document.getElementById('cameraCanvas');
        const preview = document.getElementById('cameraPreview');
        const captureBtn = document.getElementById('captureBtn');
        const retakeBtn = document.getElementById('retakeBtn');
        const usePhotoBtn = document.getElementById('usePhotoBtn');

        if (!video || !canvas) return;

        // Set canvas dimensions to match video
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;

        // Draw video frame to canvas
        const ctx = canvas.getContext('2d');
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        // Convert to data URL
        this.capturedPhotoData = canvas.toDataURL('image/jpeg', 0.9);

        // Show preview
        if (preview) {
            preview.src = this.capturedPhotoData;
            preview.style.display = 'block';
            video.style.display = 'none';
        }

        // Update buttons
        if (captureBtn) captureBtn.style.display = 'none';
        if (retakeBtn) retakeBtn.style.display = 'inline-block';
        if (usePhotoBtn) usePhotoBtn.style.display = 'inline-block';

        // Stop the camera stream
        this.stopCamera();
    }

    retakePhoto() {
        console.log('🔄 RETAKING PHOTO');
        this.resetCameraUI();
        this.startCamera();
    }

    usePhoto() {
        console.log('✅ USING CAPTURED PHOTO');
        if (this.capturedPhotoData) {
            this.uploadedImageData = this.capturedPhotoData;
            this.showImagePreview(this.capturedPhotoData);
            this.closeCameraModal();
            this.showNotification('Photo Captured', 'Your photo is ready! Type a message like "analyze this" or "make it better" and click send.');
        }
    }

    // ============================================
    // UTILITY FUNCTIONS
    // ============================================
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

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
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

    async checkServerHealth() {
        try {
            const response = await fetch(`${this.apiUrl}/health`);
            if (!response.ok) {
                console.warn('Server not responding');
            }
        } catch (error) {
            console.warn('Cannot connect to server');
        }
    }

    async handleLogout() {
        const confirmed = await this.showConfirmDialog('Logout?', 'Are you sure you want to logout?');
        if (!confirmed) return;

        try {
            if (this.supabase) {
                await this.supabase.auth.signOut();
            }
            window.location.href = 'login.html';
        } catch (error) {
            console.error('Logout error:', error);
            window.location.href = 'login.html';
        }
    }

    // ============================================
    // ADMIN PANEL FUNCTIONS
    // ============================================
    showAdminPasswordModal() {
        console.log('🔐 SHOWING ADMIN PASSWORD MODAL');
        const modal = document.getElementById('adminPasswordModal');
        const input = document.getElementById('adminPasswordInput');
        const error = document.getElementById('adminPasswordError');
        if (modal) {
            modal.classList.add('show');
            console.log('✅ Admin password modal shown');
            if (input) {
                input.value = '';
                input.focus();
            }
            if (error) {
                error.style.display = 'none';
                error.textContent = '';
            }
        } else {
            console.error('❌ Admin password modal element not found');
        }
    }

    closeAdminPasswordModal() {
        console.log('🔐 CLOSING ADMIN PASSWORD MODAL');
        const modal = document.getElementById('adminPasswordModal');
        const input = document.getElementById('adminPasswordInput');
        const error = document.getElementById('adminPasswordError');
        if (modal) {
            modal.classList.remove('show');
        }
        if (input) {
            input.value = '';
        }
        if (error) {
            error.style.display = 'none';
            error.textContent = '';
        }
    }

    async handleAdminPassword() {
        console.log('🔐 HANDLING ADMIN PASSWORD');
        const input = document.getElementById('adminPasswordInput');
        const error = document.getElementById('adminPasswordError');
        
        if (!input) {
            console.error('❌ Admin password input not found');
            return;
        }

        const password = input.value.trim();
        console.log('🔐 PASSWORD ENTERED:', password ? '***' : 'EMPTY');

        if (password === 'srinikesh') {
            console.log('✅ ADMIN PASSWORD CORRECT - Redirecting to admin panel');
            this.closeAdminPasswordModal();
            window.location.href = 'admin.html';
        } else if (password !== '') {
            console.log('❌ ADMIN PASSWORD INCORRECT');
            if (error) {
                error.textContent = 'Incorrect password. Please try again.';
                error.style.display = 'block';
            }
            if (input) {
                input.value = '';
                input.focus();
            }
        }
    }
}

// Initialize the AI Assistant when the page loads
document.addEventListener('DOMContentLoaded', async () => {
    console.log('🚀 APP INITIALIZING...');
    
    // Listen for coins updates from games
    window.addEventListener('message', (event) => {
        if (event.data && event.data.type === 'coinsUpdated') {
            console.log('🪙 Coins updated from game, refreshing...');
            if (window.aiAssistant) {
                window.aiAssistant.loadUserInfo();
            }
        }
    });
    
    // Also listen for custom events (same window)
    window.addEventListener('coinsUpdated', (event) => {
        console.log('🪙 Coins updated, refreshing...');
        if (window.aiAssistant) {
            window.aiAssistant.loadUserInfo();
        }
    });
    
    if (window.supabase && window.SUPABASE_URL && window.SUPABASE_ANON_KEY) {
        try {
            const supabaseClient = window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);

            // Fast session check from localStorage — prevents redirect loop
            const { data: sessionData } = await supabaseClient.auth.getSession();
            if (!sessionData?.session) {
                window.location.href = 'login.html';
                return;
            }

            // Refresh auth token so DB queries work correctly.
            // If getUser() fails (network down) we still proceed — don't redirect.
            let user = sessionData.session.user;
            try {
                const { data } = await supabaseClient.auth.getUser();
                if (data?.user) user = data.user;
            } catch (_) { /* use session user if network fails */ }

            window.__supabaseClient = supabaseClient;
            window.__currentUser = user;

        } catch (err) {
            console.error('Supabase init error:', err);
            window.location.href = 'login.html';
            return;
        }
    } else {
        window.location.href = 'login.html';
        return;
    }

    window.aiAssistant = new AIAssistant();
});

// Modal Helper Functions
AIAssistant.prototype.initModalEventListeners = function() {
    // Confirm modal event listeners
    const confirmCancelBtn = document.getElementById('confirmCancelBtn');
    const confirmProceedBtn = document.getElementById('confirmProceedBtn');
    if (confirmCancelBtn) confirmCancelBtn.addEventListener('click', () => this.hideModal('confirmModal'));
    if (confirmProceedBtn) confirmProceedBtn.addEventListener('click', () => {
        if (this.confirmCallback) this.confirmCallback(true);
        this.hideModal('confirmModal');
    });

    // Input modal event listeners
    const inputCancelBtn = document.getElementById('inputCancelBtn');
    const inputConfirmBtn = document.getElementById('inputConfirmBtn');
    const inputField = document.getElementById('inputField');
    if (inputCancelBtn) inputCancelBtn.addEventListener('click', () => this.hideModal('inputModal'));
    if (inputConfirmBtn) inputConfirmBtn.addEventListener('click', () => {
        if (this.inputCallback) this.inputCallback(inputField.value);
        this.hideModal('inputModal');
    });
    if (inputField) {
        inputField.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                if (this.inputCallback) this.inputCallback(inputField.value);
                this.hideModal('inputModal');
            }
        });
    }

    // Notification modal event listeners
    const notificationCloseBtn = document.getElementById('notificationCloseBtn');
    if (notificationCloseBtn) notificationCloseBtn.addEventListener('click', () => this.hideModal('notificationModal'));
};

AIAssistant.prototype.showModal = function(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.add('show');
        document.body.style.overflow = 'hidden';
    }
};

AIAssistant.prototype.hideModal = function(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.remove('show');
        document.body.style.overflow = '';
    }
};

AIAssistant.prototype.showConfirmDialog = function(title, message) {
    return new Promise((resolve) => {
        document.getElementById('confirmTitle').textContent = title;
        document.getElementById('confirmMessage').textContent = message;
        this.confirmCallback = resolve;
        this.showModal('confirmModal');
    });
};

AIAssistant.prototype.showInputDialog = function(title, message, defaultValue = '') {
    return new Promise((resolve) => {
        document.getElementById('inputTitle').textContent = title;
        document.getElementById('inputMessage').textContent = message;
        const inputField = document.getElementById('inputField');
        if (inputField) {
            inputField.value = defaultValue;
            inputField.focus();
        }
        this.inputCallback = resolve;
        this.showModal('inputModal');
    });
};

AIAssistant.prototype.showNotification = function(title, message) {
    document.getElementById('notificationTitle').textContent = title;
    document.getElementById('notificationMessage').textContent = message;
    this.showModal('notificationModal');
};

AIAssistant.prototype.checkMemoryUsage = async function() {
    try {
        const response = await fetch(`${this.apiUrl}/usage/limits?userId=${this.userId}`);
        const data = await response.json();
        
        if (!response.ok) {
            console.error('Failed to get usage limits:', data.error);
            return { success: false, error: data.error };
        }
        
        const { limits, usage } = data;
        const memoriesUsed = usage.memories_used || 0;
        const memoriesLimit = limits.memories;
        
        // Check if user has exceeded memory limit
        if (memoriesLimit !== -1 && memoriesUsed >= memoriesLimit) {
            this.showNotification('Memory Limit Exceeded', `You have reached your memory limit (${memoriesUsed}/${memoriesLimit}). Please upgrade your plan to continue using memory features.`);
            return { success: false, limitExceeded: true };
        }
        
        return { success: true, memoriesUsed, memoriesLimit };
        
    } catch (error) {
        console.error('Error checking memory usage:', error);
        return { success: false, error: error.message };
    }
};

AIAssistant.prototype.trackMemoryUsage = async function() {
    try {
        const response = await fetch(`${this.apiUrl}/usage/track`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: this.userId, type: 'memory' })
        });

        const data = await response.json();

        if (!response.ok) {
            if (response.status === 403) {
                this.showNotification('Memory Limit Exceeded', 'You have reached your memory limit. Please upgrade your plan.');
                return false;
            }
            throw new Error(data.error || 'Failed to track memory usage');
        }

        return true;

    } catch (error) {
        console.error('Error tracking memory usage:', error);
        this.showNotification('Error', `Failed to track memory usage: ${error.message}`);
        return false;
    }
};

// ============================================
// DIRECT CHAT (User-to-User Messaging)
// ============================================

AIAssistant.prototype.openDirectChat = async function() {
    if (!this.directChatPanel) return;
    this.directChatPanel.style.display = 'flex';
    this.dcSwitchTab('dms');
    this.dcShowSearchView();
    await this.dcLoadChats();
    // Start global subscription for all DM notifications
    this.dcSubscribeGlobal();
};

AIAssistant.prototype.closeDirectChat = function() {
    if (!this.directChatPanel) return;
    this.directChatPanel.style.display = 'none';
    this.dcActiveChatId = null;
    this.dcActiveChatUser = null;
    this.dcActiveGroupId = null;
    if (this.dcSubscription) { this.supabase.removeChannel(this.dcSubscription); this.dcSubscription = null; }
    if (this._typingCh)      { this.supabase.removeChannel(this._typingCh);      this._typingCh = null; }
    this._showTypingIndicator(false);
    if (this.dcGlobalSubscription) {
        this.supabase.removeChannel(this.dcGlobalSubscription);
        this.dcGlobalSubscription = null;
    }
};

AIAssistant.prototype.dcSwitchTab = function(tab) {
    // Update tab buttons
    if (this.dcTabDms) this.dcTabDms.classList.toggle('active', tab === 'dms');
    if (this.dcTabGroups) this.dcTabGroups.classList.toggle('active', tab === 'groups');

    // Hide all views first
    if (this.dcSearchView) this.dcSearchView.style.display = 'none';
    if (this.dcGroupsView) this.dcGroupsView.style.display = 'none';
    if (this.dcCreateGroupView) this.dcCreateGroupView.style.display = 'none';
    if (this.dcChatView) this.dcChatView.style.display = 'none';

    if (tab === 'dms') {
        this.dcShowSearchView();
        this.dcLoadChats();
    } else if (tab === 'groups') {
        if (this.dcGroupsView) this.dcGroupsView.style.display = 'flex';
        if (this.dcBackBtn) this.dcBackBtn.style.visibility = 'hidden';
        if (this.dcTitle) this.dcTitle.textContent = 'Groups';
        this.dcLoadGroups();
    }
};

AIAssistant.prototype.dcShowSearchView = function() {
    if (this.dcSearchView) this.dcSearchView.style.display = 'flex';
    if (this.dcChatView) this.dcChatView.style.display = 'none';
    if (this.dcGroupsView) this.dcGroupsView.style.display = 'none';
    if (this.dcCreateGroupView) this.dcCreateGroupView.style.display = 'none';
    if (this.dcTitle) this.dcTitle.textContent = 'Messages';
    if (this.dcBackBtn) this.dcBackBtn.style.visibility = 'hidden';
};

AIAssistant.prototype.dcShowChatView = function(userName) {
    // Refresh call bar when entering a chat
    this._updateCallBar();
    if (this.dcSearchView) this.dcSearchView.style.display = 'none';
    if (this.dcGroupsView) this.dcGroupsView.style.display = 'none';
    if (this.dcCreateGroupView) this.dcCreateGroupView.style.display = 'none';
    if (this.dcChatView) this.dcChatView.style.display = 'flex';
    if (this.dcTitle) {
        this.dcTitle.textContent = userName || 'Chat';
        if (this.dcActiveGroupId) {
            this.dcTitle.style.cursor = 'pointer';
            this.dcTitle.title = 'Click for group settings';
            this.dcTitle.onclick = () => this.dcShowGroupSettings();
        } else {
            this.dcTitle.style.cursor = 'default';
            this.dcTitle.title = '';
            this.dcTitle.onclick = null;
        }
    }
    if (this.dcBackBtn) this.dcBackBtn.style.visibility = 'visible';

    // Subscribe typing channel for DMs
    if (!this.dcActiveGroupId && this.dcActiveChatId) {
        this._subscribeTyping(this.dcActiveChatId);
    }

    // Wire up typing event on the input (once)
    if (this.dcMessageInput && !this.dcMessageInput._typingBound) {
        this.dcMessageInput._typingBound = true;
        this.dcMessageInput.addEventListener('input', () => this._sendTypingEvent());
    }

    // Init right-click context menu (once)
    this._initMsgContextMenu();
};

AIAssistant.prototype.dcGoBack = function() {
    this.dcActiveChatId = null;
    this.dcActiveChatUser = null;
    this.dcActiveGroupId = null;
    if (this.dcSubscription) { this.supabase.removeChannel(this.dcSubscription); this.dcSubscription = null; }
    if (this._typingCh)      { this.supabase.removeChannel(this._typingCh);      this._typingCh = null; }
    this._showTypingIndicator(false);
    // Return to the correct tab
    const isGroupTab = this.dcTabGroups?.classList.contains('active');
    if (isGroupTab) {
        this.dcSwitchTab('groups');
    } else {
        this.dcShowSearchView();
        this.dcLoadChats();
    }
};

AIAssistant.prototype.dcSearchUsers = async function() {
    const query = this.dcSearchInput?.value?.trim();

    try {
        // If query provided, filter; otherwise show all users
        let supaQuery = this.supabase
            .from('users')
            .select('id, username, email')
            .neq('id', this.userId)
            .limit(20);

        if (query && query.length >= 2) {
            supaQuery = supaQuery.or(`username.ilike.%${query}%,email.ilike.%${query}%`);
        }

        const { data, error } = await supaQuery;

        if (error) throw error;

        if (!data || data.length === 0) {
            if (this.dcSearchResults) this.dcSearchResults.innerHTML = '<div class="dc-empty" style="padding:12px 16px;font-size:13px;">No users found</div>';
            return;
        }

        // Check friend status for each user
        const userIds = data.map(u => u.id);
        const { data: friendships } = await this.supabase
            .from('friends')
            .select('*')
            .or(`user_id.eq.${this.userId},friend_id.eq.${this.userId}`);

        const friendMap = {};
        (friendships || []).forEach(f => {
            const otherId = f.user_id === this.userId ? f.friend_id : f.user_id;
            friendMap[otherId] = f;
        });

        if (this.dcSearchResults) {
            this.dcSearchResults.innerHTML = data.map(user => {
                const initial = (user.username || user.email || '?')[0].toUpperCase();
                const displayName = user.username || user.email.split('@')[0];
                const friendship = friendMap[user.id];
                let friendBtn = '';
                if (!friendship) {
                    friendBtn = `<button class="dc-friend-btn add" data-action="add-friend" data-user-id="${user.id}">Add Friend</button>`;
                } else if (friendship.status === 'pending' && friendship.user_id === this.userId) {
                    friendBtn = `<span class="dc-friend-btn pending-label">Pending</span>`;
                } else if (friendship.status === 'pending' && friendship.friend_id === this.userId) {
                    friendBtn = `<button class="dc-friend-btn accept" data-action="accept-friend" data-friendship-id="${friendship.id}">Accept</button>`;
                } else if (friendship.status === 'accepted') {
                    friendBtn = `<span class="dc-friend-btn pending-label" style="background:#48bb78;color:white;">Friends</span>`;
                }
                return `
                    <div class="dc-user-item" data-user-id="${user.id}" data-user-name="${this.escapeHtml(displayName)}">
                        <div class="dc-user-avatar">${initial}</div>
                        <div class="dc-user-info">
                            <div class="dc-user-name">${this.escapeHtml(displayName)}</div>
                            <div class="dc-user-email">${this.escapeHtml(user.email)}</div>
                        </div>
                        <div class="dc-friend-actions">
                            ${friendBtn}
                            <button class="dc-friend-btn chat" data-action="chat" data-user-id="${user.id}" data-user-name="${this.escapeHtml(displayName)}">Chat</button>
                        </div>
                    </div>
                `;
            }).join('');

            // Bind actions
            this.dcSearchResults.querySelectorAll('[data-action]').forEach(btn => {
                btn.addEventListener('click', async (e) => {
                    e.stopPropagation();
                    const action = btn.dataset.action;
                    if (action === 'add-friend') {
                        await this.sendFriendRequest(btn.dataset.userId);
                        btn.textContent = 'Pending';
                        btn.className = 'dc-friend-btn pending-label';
                    } else if (action === 'accept-friend') {
                        await this.acceptFriendRequest(btn.dataset.friendshipId);
                        btn.textContent = 'Friends';
                        btn.className = 'dc-friend-btn pending-label';
                        btn.style.background = '#48bb78';
                        btn.style.color = 'white';
                    } else if (action === 'chat') {
                        this.dcStartChat(btn.dataset.userId, btn.dataset.userName);
                    }
                });
            });
        }
    } catch (error) {
        console.error('DC search error:', error);
        if (this.dcSearchResults) this.dcSearchResults.innerHTML = '<div class="dc-empty" style="padding:12px 16px;font-size:13px;color:#e53e3e;">Search failed. Try again.</div>';
    }
};

AIAssistant.prototype.dcStartChat = async function(otherUserId, otherUserName) {
    try {
        const { data: existing } = await this.supabase
            .from('direct_chats')
            .select('*')
            .or(`and(user1_id.eq.${this.userId},user2_id.eq.${otherUserId}),and(user1_id.eq.${otherUserId},user2_id.eq.${this.userId})`);

        let chat;
        if (existing && existing.length > 0) {
            chat = existing[0];
        } else {
            const u1 = this.userId < otherUserId ? this.userId : otherUserId;
            const u2 = this.userId < otherUserId ? otherUserId : this.userId;

            const { data: newChat, error } = await this.supabase
                .from('direct_chats')
                .insert({ user1_id: u1, user2_id: u2 })
                .select()
                .single();

            if (error) throw error;
            chat = newChat;
        }

        this.dcActiveChatId = chat.id;
        this.dcActiveGroupId = null;
        this.dcActiveChatUser = { id: otherUserId, name: otherUserName };
        if (this.dcSearchResults) this.dcSearchResults.innerHTML = '';
        if (this.dcSearchInput) this.dcSearchInput.value = '';
        this.dcShowChatView(otherUserName);
        await this.dcLoadMessages();
        this.dcSubscribeToMessages();
    } catch (error) {
        console.error('DC start chat error:', error);
        this.showNotification('Error', 'Could not start chat. Please try again.');
    }
};

AIAssistant.prototype.dcLoadChats = async function() {
    try {
        const { data, error } = await this.supabase
            .from('direct_chats')
            .select('*')
            .or(`user1_id.eq.${this.userId},user2_id.eq.${this.userId}`)
            .order('last_message_at', { ascending: false });

        if (error) throw error;

        this.dcChats = data || [];

        if (this.dcChats.length === 0) {
            if (this.dcChatsList) this.dcChatsList.innerHTML = '<div class="dc-empty">No conversations yet. Search for a user to start chatting!</div>';
            return;
        }

        const otherUserIds = this.dcChats.map(c => c.user1_id === this.userId ? c.user2_id : c.user1_id);
        const uniqueIds = [...new Set(otherUserIds)];

        const { data: users } = await this.supabase
            .from('users')
            .select('id, username, email')
            .in('id', uniqueIds);

        const userMap = {};
        (users || []).forEach(u => { userMap[u.id] = u; });

        if (this.dcChatsList) {
            this.dcChatsList.innerHTML = this.dcChats.map(chat => {
                const otherUserId = chat.user1_id === this.userId ? chat.user2_id : chat.user1_id;
                const otherUser = userMap[otherUserId] || {};
                const displayName = otherUser.username || (otherUser.email ? otherUser.email.split('@')[0] : 'User');
                const initial = displayName[0].toUpperCase();
                const lastMsg = chat.last_message || 'No messages yet';
                const time = chat.last_message_at ? this.dcFormatTimeShort(chat.last_message_at) : '';

                return `
                    <div class="dc-chat-item" data-chat-id="${chat.id}" data-other-id="${otherUserId}" data-other-name="${this.escapeHtml(displayName)}">
                        <div class="dc-user-avatar">${initial}</div>
                        <div class="dc-chat-preview">
                            <div class="dc-chat-name">${this.escapeHtml(displayName)}</div>
                            <div class="dc-chat-last-msg">${this.escapeHtml(lastMsg.substring(0, 50))}</div>
                        </div>
                        <div class="dc-chat-time">${time}</div>
                    </div>
                `;
            }).join('');

            this.dcChatsList.querySelectorAll('.dc-chat-item').forEach(item => {
                item.addEventListener('click', () => {
                    this.dcActiveChatId = item.dataset.chatId;
                    this.dcActiveGroupId = null;
                    this.dcActiveChatUser = { id: item.dataset.otherId, name: item.dataset.otherName };
                    this.dcShowChatView(item.dataset.otherName);
                    this.dcLoadMessages();
                    this.dcSubscribeToMessages();
                });
            });
        }
    } catch (error) {
        console.error('DC load chats error:', error);
        if (this.dcChatsList) this.dcChatsList.innerHTML = '<div class="dc-empty">No conversations yet. Add friends to start chatting!</div>';
    }
};

AIAssistant.prototype.dcLoadMessages = async function() {
    if (!this.dcMessages) return;

    try {
        let data, error;
        if (this.dcActiveGroupId) {
            ({ data, error } = await this.supabase
                .from('group_messages')
                .select('*')
                .eq('group_id', this.dcActiveGroupId)
                .order('created_at', { ascending: true })
                .limit(100));
        } else if (this.dcActiveChatId) {
            ({ data, error } = await this.supabase
                .from('direct_messages')
                .select('*')
                .eq('chat_id', this.dcActiveChatId)
                .order('created_at', { ascending: true })
                .limit(100));
        } else {
            return;
        }

        if (error) throw error;
        this.dcRenderMessages(data || []);

        // Mark received messages as 'seen' (DMs only)
        if (!this.dcActiveGroupId && this.dcActiveChatId && data?.length) {
            const unread = data.filter(m => m.sender_id !== this.userId && m.status !== 'seen').map(m => m.id);
            if (unread.length) {
                this.supabase.from('direct_messages').update({ status: 'seen' }).in('id', unread).then(() => {}).catch(() => {});
            }
        }
    } catch (error) {
        console.error('DC load messages error:', error);
    }
};

AIAssistant.prototype.dcRenderMessages = function(messages) {
    if (!this.dcMessages) return;

    if (messages.length === 0) {
        this.dcMessages.innerHTML = '<div class="dc-empty">No messages yet. Say hello!</div>';
        return;
    }

    this.dcMessages.innerHTML = messages.map(msg => this.dcBuildMessageHtml(msg)).join('');
    this.dcMessages.scrollTop = this.dcMessages.scrollHeight;
};

// Build HTML for a single message (used by both render and append)
AIAssistant.prototype.dcBuildMessageHtml = function(msg) {
    const isSent = msg.sender_id === this.userId;
    const time = this.dcFormatTime(msg.created_at);
    const statusClass = msg._status === 'sending' ? ' dc-msg-sending' : '';
    let contentHtml = '';

    const msgType = msg.message_type || 'text';
    if (msgType === 'image' && msg.media_url) {
        contentHtml = `<img src="${this.escapeHtml(msg.media_url)}" alt="image" loading="lazy">`;
        if (msg.content) contentHtml += `<div>${this.escapeHtml(msg.content)}</div>`;
    } else if (msgType === 'video' && msg.media_url) {
        contentHtml = `<video src="${this.escapeHtml(msg.media_url)}" controls style="max-width:100%;border-radius:8px;"></video>`;
        if (msg.content) contentHtml += `<div>${this.escapeHtml(msg.content)}</div>`;
    } else if (msgType === 'link') {
        const url = msg.media_url || msg.content;
        contentHtml = `<a href="${this.escapeHtml(url)}" target="_blank" rel="noopener" class="dc-link-preview">${this.escapeHtml(url)}</a>`;
        if (msg.content && msg.content !== url) contentHtml += `<div>${this.escapeHtml(msg.content)}</div>`;
    } else {
        const text = msg.content || '';
        contentHtml = `<div>${this.dcLinkify(this.escapeHtml(text))}</div>`;
    }

    // Show sender name in group chats for received messages
    let senderHtml = '';
    if (!isSent && this.dcActiveGroupId && msg._senderName) {
        senderHtml = `<div class="dc-msg-sender" style="font-size:11px;font-weight:600;color:#667eea;margin-bottom:2px;">${this.escapeHtml(msg._senderName)}</div>`;
    }

    // Status ticks for sent messages
    let statusTick = '';
    if (isSent && !msg.id?.startsWith?.('temp-')) {
        if (msg.status === 'seen')      statusTick = ' <span style="color:#3b82f6;font-size:10px;">✓✓</span>';
        else if (msg.status === 'delivered') statusTick = ' <span style="color:#9ca3af;font-size:10px;">✓✓</span>';
        else                             statusTick = ' <span style="color:#9ca3af;font-size:10px;">✓</span>';
    }

    return `
        <div class="dc-msg ${isSent ? 'sent' : 'received'}${statusClass}" data-msg-id="${msg.id}">
            ${senderHtml}
            ${contentHtml}
            <div class="dc-msg-time">${time}${statusTick}</div>
        </div>
    `;
};

// Append a single message to the chat (used by optimistic send and realtime)
AIAssistant.prototype.dcAppendSingleMessage = function(msg) {
    if (!this.dcMessages) return;
    const emptyEl = this.dcMessages.querySelector('.dc-empty');
    if (emptyEl) emptyEl.remove();

    const msgEl = document.createElement('div');
    msgEl.innerHTML = this.dcBuildMessageHtml(msg);
    const el = msgEl.firstElementChild;
    if (el) this.dcMessages.appendChild(el);
    this.dcMessages.scrollTop = this.dcMessages.scrollHeight;
};

// Auto-detect URLs in text and make them clickable
AIAssistant.prototype.dcLinkify = function(text) {
    const urlRegex = /(https?:\/\/[^\s<]+)/g;
    return text.replace(urlRegex, '<a href="$1" target="_blank" rel="noopener" style="color:#667eea;text-decoration:underline;">$1</a>');
};

AIAssistant.prototype.dcSendMessage = async function() {
    const content = this.dcMessageInput?.value?.trim();
    if (!content && !this.dcPendingMedia) return;
    if (!this.dcActiveChatId && !this.dcActiveGroupId) return;

    // Prevent double-send
    if (this.dcIsSending) return;
    this.dcIsSending = true;

    this.dcMessageInput.value = '';

    // Stop typing broadcast when message is sent
    clearTimeout(this._typingStopTimer);
    if (this._typingCh) this._typingCh.send({ type: 'broadcast', event: 'stop_typing', payload: { userId: this.userId } }).catch(() => {});

    // Detect if text is a URL
    let messageType = 'text';
    let mediaUrl = null;
    const urlPattern = /^https?:\/\/[^\s]+$/;
    if (content && urlPattern.test(content)) {
        messageType = 'link';
        mediaUrl = content;
    }

    // If there's pending media from file upload
    if (this.dcPendingMedia) {
        messageType = this.dcPendingMedia.type;
        mediaUrl = this.dcPendingMedia.url;
        this.dcPendingMedia = null;
    }

    // --- Optimistic UI: show message immediately ---
    const tempId = 'temp-' + Date.now();
    const now = new Date().toISOString();
    const optimisticMsg = {
        id: tempId,
        sender_id: this.userId,
        content: content || null,
        message_type: messageType,
        media_url: mediaUrl,
        created_at: now,
        _status: 'sending'
    };
    this.dcAppendSingleMessage(optimisticMsg);

    const isGroup = !!this.dcActiveGroupId;
    const table = isGroup ? 'group_messages' : 'direct_messages';
    const idCol = isGroup ? 'group_id' : 'chat_id';
    const targetId = isGroup ? this.dcActiveGroupId : this.dcActiveChatId;

    const insertData = {
        [idCol]: targetId,
        sender_id: this.userId,
        content: content || null,
        message_type: messageType,
        media_url: mediaUrl
    };

    const updateTable = isGroup ? 'group_chats' : 'direct_chats';

    // --- Send with retry ---
    let success = false;
    for (let attempt = 0; attempt < 3; attempt++) {
        try {
            const { data: inserted, error } = await this.supabase
                .from(table)
                .insert(insertData)
                .select()
                .single();
            if (error) throw error;

            // Update last_message on the chat/group
            await this.supabase
                .from(updateTable)
                .update({ last_message: content || messageType, last_message_at: inserted.created_at })
                .eq('id', targetId);

            // Replace optimistic element with real ID and mark sent
            const tempEl = this.dcMessages?.querySelector(`[data-msg-id="${tempId}"]`);
            if (tempEl) {
                tempEl.dataset.msgId = inserted.id;
                tempEl.classList.remove('dc-msg-sending');
                // Update time with server timestamp
                const timeEl = tempEl.querySelector('.dc-msg-time');
                if (timeEl) timeEl.textContent = this.dcFormatTime(inserted.created_at);
            }

            success = true;
            break;
        } catch (error) {
            console.error(`DC send attempt ${attempt + 1} failed:`, error);
            if (attempt < 2) {
                await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
            }
        }
    }

    if (!success) {
        // Mark as failed
        const tempEl = this.dcMessages?.querySelector(`[data-msg-id="${tempId}"]`);
        if (tempEl) {
            tempEl.classList.remove('dc-msg-sending');
            tempEl.classList.add('dc-msg-failed');
            const timeEl = tempEl.querySelector('.dc-msg-time');
            if (timeEl) timeEl.innerHTML = '&#x26A0; Failed - tap to retry';
            tempEl.style.cursor = 'pointer';
            tempEl.addEventListener('click', () => {
                tempEl.remove();
                this.dcMessageInput.value = content || '';
                this.dcSendMessage();
            }, { once: true });
        }
        this.showNotification('Error', 'Message failed to send. Tap it to retry.');
    }

    this.dcIsSending = false;
};

// Handle file upload for media sharing
AIAssistant.prototype.dcHandleFileUpload = async function(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
        const isImage = file.type.startsWith('image/');
        const isVideo = file.type.startsWith('video/');
        if (!isImage && !isVideo) {
            this.showNotification('Error', 'Only images and videos are supported.');
            return;
        }

        // Upload to Supabase storage
        const ext = file.name.split('.').pop();
        const fileName = `${this.userId}/${Date.now()}.${ext}`;

        const { data, error } = await this.supabase.storage
            .from('chat-media')
            .upload(fileName, file);

        if (error) throw error;

        const { data: urlData } = this.supabase.storage
            .from('chat-media')
            .getPublicUrl(fileName);

        this.dcPendingMedia = {
            type: isImage ? 'image' : 'video',
            url: urlData.publicUrl,
            name: file.name
        };

        // Auto-send media message
        await this.dcSendMessage();
    } catch (error) {
        console.error('File upload error:', error);
        this.showNotification('Error', 'Failed to upload file.');
    }

    // Reset file input
    if (this.dcFileInput) this.dcFileInput.value = '';
};

AIAssistant.prototype.dcSubscribeToMessages = function() {
    if (this.dcSubscription) {
        this.supabase.removeChannel(this.dcSubscription);
        this.dcSubscription = null;
    }
    // Polling fallback — ensures messages appear even if realtime isn't enabled on the table
    this.dcStartMessagePoll();

    const isGroup = !!this.dcActiveGroupId;
    const targetId = isGroup ? this.dcActiveGroupId : this.dcActiveChatId;
    if (!targetId) return;

    const table = isGroup ? 'group_messages' : 'direct_messages';
    const filterCol = isGroup ? 'group_id' : 'chat_id';

    this.dcSubscription = this.supabase
        .channel(`dc-messages-${targetId}-${Date.now()}`)
        .on('postgres_changes', {
            event: 'INSERT',
            schema: 'public',
            table: table,
            filter: `${filterCol}=eq.${targetId}`
        }, (payload) => {
            const msg = payload.new;
            if (!this.dcMessages) return;

            // Skip if we already have this message (from optimistic send)
            const existingEl = this.dcMessages.querySelector(`[data-msg-id="${msg.id}"]`);
            if (existingEl) return;

            // Skip if this is our own message (already shown optimistically)
            // But only skip if there's a temp message from us that matches content
            if (msg.sender_id === this.userId) {
                const tempEls = this.dcMessages.querySelectorAll('[data-msg-id^="temp-"]');
                for (const el of tempEls) {
                    // Found a temp message from us — the real one will replace it
                    return;
                }
            }

            this.dcAppendSingleMessage(msg);
        })
        .subscribe((status) => {
            console.log(`DC subscription ${targetId}: ${status}`);
        });
};

// Global subscription to detect new messages even when not in a specific chat
AIAssistant.prototype.dcSubscribeGlobal = function() {
    if (this.dcGlobalSubscription) {
        this.supabase.removeChannel(this.dcGlobalSubscription);
    }

    this.dcGlobalSubscription = this.supabase
        .channel(`dc-global-${this.userId}-${Date.now()}`)
        .on('postgres_changes', {
            event: 'INSERT',
            schema: 'public',
            table: 'direct_messages'
        }, (payload) => {
            const msg = payload.new;
            // Refresh chat list when a new message arrives in any chat
            if (this.directChatPanel?.style.display === 'flex' && !this.dcActiveChatId) {
                this.dcLoadChats();
            }
            // Native notification for DMs from other users
            if (msg && msg.sender_id !== this.userId) {
                this._notifyNewMessage(msg.sender_id, msg.content, false);
            }
        })
        .on('postgres_changes', {
            event: 'INSERT',
            schema: 'public',
            table: 'group_messages'
        }, (payload) => {
            const msg = payload.new;
            if (this.directChatPanel?.style.display === 'flex' && !this.dcActiveGroupId) {
                this.dcLoadGroups();
            }
            // Native notification for group messages from other users
            if (msg && msg.sender_id !== this.userId) {
                this._notifyNewMessage(msg.sender_id, msg.content, true);
            }
        })
        .subscribe();
};

AIAssistant.prototype.dcFormatTime = function(dateStr) {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return '';
    const now = new Date();

    const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });

    const isToday = date.toDateString() === now.toDateString();
    if (isToday) return timeStr;

    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    if (date.toDateString() === yesterday.toDateString()) return 'Yesterday ' + timeStr;

    const datePrefix = date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    return datePrefix + ' ' + timeStr;
};

// Format time for chat list previews (shorter format)
AIAssistant.prototype.dcFormatTimeShort = function(dateStr) {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return '';
    const now = new Date();
    const diff = now - date;

    if (diff < 60000) return 'now';
    if (diff < 3600000) return Math.floor(diff / 60000) + 'm';

    const isToday = date.toDateString() === now.toDateString();
    if (isToday) return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });

    if (diff < 604800000) {
        return date.toLocaleDateString([], { weekday: 'short' });
    }

    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
};

// ============================================
// GROUP CHATS
// ============================================

AIAssistant.prototype.dcShowCreateGroupView = async function() {
    if (this.dcGroupsView) this.dcGroupsView.style.display = 'none';
    if (this.dcCreateGroupView) this.dcCreateGroupView.style.display = 'flex';
    if (this.dcBackBtn) this.dcBackBtn.style.visibility = 'visible';
    if (this.dcTitle) this.dcTitle.textContent = 'New Group';
    if (this.dcGroupNameInput) this.dcGroupNameInput.value = '';

    // Load friends to select
    await this.loadFriendsData();
    if (this.dcGroupFriendsList) {
        if (this.friendsData.length === 0) {
            this.dcGroupFriendsList.innerHTML = '<div class="dc-empty" style="padding:12px;font-size:13px;">Add friends first to create a group.</div>';
            return;
        }
        this.dcGroupFriendsList.innerHTML = this.friendsData.map(f => {
            const initial = (f.name || '?')[0].toUpperCase();
            return `
                <div class="dc-group-friend-item" data-user-id="${f.id}">
                    <div class="dc-checkbox"></div>
                    <div class="dc-user-avatar" style="width:30px;height:30px;font-size:12px;">${initial}</div>
                    <div style="font-size:13px;font-weight:500;">${this.escapeHtml(f.name)}</div>
                </div>
            `;
        }).join('');

        this.dcGroupFriendsList.querySelectorAll('.dc-group-friend-item').forEach(item => {
            item.addEventListener('click', () => {
                item.classList.toggle('selected');
                const cb = item.querySelector('.dc-checkbox');
                cb.innerHTML = item.classList.contains('selected') ? '&#10003;' : '';
            });
        });
    }
};

AIAssistant.prototype.dcCreateGroup = async function() {
    const name = this.dcGroupNameInput?.value?.trim();
    if (!name) {
        this.showNotification('Error', 'Please enter a group name.');
        return;
    }

    const selectedFriends = [];
    this.dcGroupFriendsList?.querySelectorAll('.dc-group-friend-item.selected').forEach(item => {
        selectedFriends.push(item.dataset.userId);
    });

    if (selectedFriends.length === 0) {
        this.showNotification('Error', 'Please select at least one friend.');
        return;
    }

    try {
        // Create group
        const { data: group, error } = await this.supabase
            .from('group_chats')
            .insert({ name, creator_id: this.userId })
            .select()
            .single();

        if (error) throw error;

        // Add members (creator + selected friends)
        const members = [
            { group_id: group.id, user_id: this.userId, role: 'admin' },
            ...selectedFriends.map(fid => ({ group_id: group.id, user_id: fid, role: 'member' }))
        ];

        const { error: memberError } = await this.supabase
            .from('group_members')
            .insert(members);

        if (memberError) throw memberError;

        // Open the group chat
        this.dcActiveGroupId = group.id;
        this.dcActiveChatId = null;
        this.dcShowChatView(name);
        await this.dcLoadMessages();
        this.dcSubscribeToMessages();
    } catch (error) {
        console.error('Create group error:', error);
        this.showNotification('Error', 'Failed to create group: ' + (error.message || 'Unknown error'));
    }
};

AIAssistant.prototype.dcLoadGroups = async function() {
    try {
        // Get groups user is a member of
        const { data: memberships, error: memError } = await this.supabase
            .from('group_members')
            .select('group_id')
            .eq('user_id', this.userId);

        if (memError) throw memError;

        if (!memberships || memberships.length === 0) {
            if (this.dcGroupsList) this.dcGroupsList.innerHTML = '<div class="dc-empty">No groups yet. Create one!</div>';
            return;
        }

        const groupIds = memberships.map(m => m.group_id);

        const { data: groups, error } = await this.supabase
            .from('group_chats')
            .select('*')
            .in('id', groupIds)
            .order('last_message_at', { ascending: false });

        if (error) throw error;

        if (this.dcGroupsList) {
            this.dcGroupsList.innerHTML = (groups || []).map(group => {
                const initial = (group.name || 'G')[0].toUpperCase();
                const lastMsg = group.last_message || 'No messages yet';
                const time = group.last_message_at ? this.dcFormatTimeShort(group.last_message_at) : '';

                return `
                    <div class="dc-chat-item" data-group-id="${group.id}" data-group-name="${this.escapeHtml(group.name)}">
                        <div class="dc-user-avatar" style="background:linear-gradient(135deg,#667eea,#764ba2);">${initial}</div>
                        <div class="dc-chat-preview">
                            <div class="dc-chat-name">${this.escapeHtml(group.name)}</div>
                            <div class="dc-chat-last-msg">${this.escapeHtml(lastMsg.substring(0, 50))}</div>
                        </div>
                        <div class="dc-chat-time">${time}</div>
                    </div>
                `;
            }).join('');

            this.dcGroupsList.querySelectorAll('.dc-chat-item').forEach(item => {
                item.addEventListener('click', () => {
                    this.dcActiveGroupId = item.dataset.groupId;
                    this.dcActiveChatId = null;
                    this.dcShowChatView(item.dataset.groupName);
                    this.dcLoadMessages();
                    this.dcSubscribeToMessages();
                });
            });
        }
    } catch (error) {
        console.error('Load groups error:', error);
        if (this.dcGroupsList) this.dcGroupsList.innerHTML = '<div class="dc-empty" style="color:#e53e3e;">Failed to load groups</div>';
    }
};

// ============================================
// GROUP MANAGEMENT & PERMISSIONS
// ============================================

AIAssistant.prototype.dcShowGroupSettings = async function() {
    if (!this.dcActiveGroupId) return;

    try {
        // Get group info
        const { data: group } = await this.supabase
            .from('group_chats')
            .select('*')
            .eq('id', this.dcActiveGroupId)
            .single();

        // Get members with user info
        const { data: members } = await this.supabase
            .from('group_members')
            .select('*')
            .eq('group_id', this.dcActiveGroupId);

        if (!members || !group) return;

        const memberIds = members.map(m => m.user_id);
        const { data: users } = await this.supabase
            .from('users')
            .select('id, username, email')
            .in('id', memberIds);

        const userMap = {};
        (users || []).forEach(u => { userMap[u.id] = u; });

        const myMembership = members.find(m => m.user_id === this.userId);
        const isAdmin = myMembership?.role === 'admin' || group.creator_id === this.userId;

        // Build settings modal
        let modal = document.getElementById('dcGroupSettingsModal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'dcGroupSettingsModal';
            modal.style.cssText = 'position:fixed;inset:0;z-index:10000;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.6);';
            document.body.appendChild(modal);
        }

        modal.innerHTML = `
            <div style="background:var(--bg-primary,#1a1a2e);border-radius:16px;padding:20px;width:90%;max-width:400px;max-height:80vh;overflow-y:auto;color:var(--text-primary,#fff);">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
                    <h3 style="margin:0;font-size:16px;">Group Settings</h3>
                    <button id="dcGroupSettingsClose" style="background:none;border:none;color:var(--text-primary,#fff);font-size:20px;cursor:pointer;">&times;</button>
                </div>
                <div style="font-size:14px;color:var(--text-secondary,#aaa);margin-bottom:12px;">
                    ${this.escapeHtml(group.name)} &middot; ${members.length} member${members.length !== 1 ? 's' : ''}
                </div>
                <div style="font-weight:600;margin-bottom:8px;font-size:13px;">Members</div>
                ${members.map(m => {
                    const u = userMap[m.user_id] || {};
                    const name = u.username || (u.email ? u.email.split('@')[0] : 'User');
                    const initial = name[0].toUpperCase();
                    const isCreator = m.user_id === group.creator_id;
                    const roleLabel = isCreator ? 'Creator' : m.role === 'admin' ? 'Admin' : 'Member';
                    const isMe = m.user_id === this.userId;

                    let actions = '';
                    if (isAdmin && !isMe && !isCreator) {
                        if (m.role === 'member') {
                            actions += `<button class="dc-friend-btn accept" data-action="promote" data-member-id="${m.id}" style="font-size:11px;padding:3px 8px;">Promote</button>`;
                        } else if (m.role === 'admin') {
                            actions += `<button class="dc-friend-btn pending-label" data-action="demote" data-member-id="${m.id}" style="font-size:11px;padding:3px 8px;cursor:pointer;">Demote</button>`;
                        }
                        actions += `<button class="dc-friend-btn decline" data-action="kick" data-member-id="${m.id}" data-user-id="${m.user_id}" style="font-size:11px;padding:3px 8px;">Remove</button>`;
                    }

                    return `
                        <div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid rgba(255,255,255,0.05);">
                            <div class="dc-user-avatar" style="width:32px;height:32px;font-size:13px;">${initial}</div>
                            <div style="flex:1;">
                                <div style="font-size:13px;font-weight:500;">${this.escapeHtml(name)}${isMe ? ' (You)' : ''}</div>
                                <div style="font-size:11px;color:var(--text-secondary,#888);">${roleLabel}</div>
                            </div>
                            <div style="display:flex;gap:4px;">${actions}</div>
                        </div>
                    `;
                }).join('')}
                ${!isAdmin ? '' : `
                    <div style="margin-top:16px;padding-top:12px;border-top:1px solid rgba(255,255,255,0.1);">
                        <button id="dcLeaveGroup" class="dc-friend-btn decline" style="width:100%;padding:8px;font-size:13px;">Leave Group</button>
                    </div>
                `}
                ${isAdmin ? '' : `
                    <div style="margin-top:16px;padding-top:12px;border-top:1px solid rgba(255,255,255,0.1);">
                        <button id="dcLeaveGroup" class="dc-friend-btn decline" style="width:100%;padding:8px;font-size:13px;">Leave Group</button>
                    </div>
                `}
            </div>
        `;

        modal.style.display = 'flex';

        // Bind events
        document.getElementById('dcGroupSettingsClose')?.addEventListener('click', () => modal.style.display = 'none');
        modal.addEventListener('click', (e) => { if (e.target === modal) modal.style.display = 'none'; });

        modal.querySelectorAll('[data-action]').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const action = btn.dataset.action;
                const memberId = btn.dataset.memberId;
                try {
                    if (action === 'promote') {
                        await this.supabase.from('group_members').update({ role: 'admin' }).eq('id', memberId);
                        this.showNotification('Success', 'User promoted to admin.');
                    } else if (action === 'demote') {
                        await this.supabase.from('group_members').update({ role: 'member' }).eq('id', memberId);
                        this.showNotification('Success', 'User demoted to member.');
                    } else if (action === 'kick') {
                        await this.supabase.from('group_members').delete().eq('id', memberId);
                        this.showNotification('Success', 'User removed from group.');
                    }
                    // Refresh
                    this.dcShowGroupSettings();
                } catch (err) {
                    this.showNotification('Error', 'Action failed: ' + (err.message || ''));
                }
            });
        });

        document.getElementById('dcLeaveGroup')?.addEventListener('click', async () => {
            if (!confirm('Leave this group?')) return;
            try {
                await this.supabase.from('group_members').delete()
                    .eq('group_id', this.dcActiveGroupId)
                    .eq('user_id', this.userId);
                modal.style.display = 'none';
                this.dcGoBack();
                this.showNotification('Info', 'You left the group.');
            } catch (err) {
                this.showNotification('Error', 'Failed to leave: ' + (err.message || ''));
            }
        });

    } catch (error) {
        console.error('Group settings error:', error);
        this.showNotification('Error', 'Failed to load group settings.');
    }
};

// Block a user
AIAssistant.prototype.blockUser = async function(userId) {
    try {
        // Check for existing friendship
        const { data: existing } = await this.supabase
            .from('friends')
            .select('id')
            .or(`and(user_id.eq.${this.userId},friend_id.eq.${userId}),and(user_id.eq.${userId},friend_id.eq.${this.userId})`)
            .limit(1);

        if (existing && existing.length > 0) {
            await this.supabase.from('friends').update({ status: 'blocked' }).eq('id', existing[0].id);
        } else {
            await this.supabase.from('friends').insert({ user_id: this.userId, friend_id: userId, status: 'blocked' });
        }
        this.showNotification('Info', 'User blocked.');
    } catch (error) {
        console.error('Block user error:', error);
        this.showNotification('Error', 'Failed to block user.');
    }
};

// Unblock a user
AIAssistant.prototype.unblockUser = async function(userId) {
    try {
        await this.supabase.from('friends').delete()
            .or(`and(user_id.eq.${this.userId},friend_id.eq.${userId}),and(user_id.eq.${userId},friend_id.eq.${this.userId})`)
            .eq('status', 'blocked');
        this.showNotification('Info', 'User unblocked.');
    } catch (error) {
        console.error('Unblock user error:', error);
    }
};

// ============================================
// FRIENDS SYSTEM
// ============================================

AIAssistant.prototype.openFriendsPanel = async function() {
    if (!this.friendsPanel) return;
    this.friendsPanel.style.display = 'flex';
    this.switchFriendsTab('all');
};

AIAssistant.prototype.closeFriendsPanel = function() {
    if (!this.friendsPanel) return;
    this.friendsPanel.style.display = 'none';
};

AIAssistant.prototype.switchFriendsTab = function(tab) {
    // Update tab buttons
    if (this.friendsTabAll) this.friendsTabAll.classList.toggle('active', tab === 'all');
    if (this.friendsTabPending) this.friendsTabPending.classList.toggle('active', tab === 'pending');
    if (this.friendsTabAdd) this.friendsTabAdd.classList.toggle('active', tab === 'add');

    // Show/hide views
    if (this.friendsAllView) this.friendsAllView.style.display = tab === 'all' ? 'flex' : 'none';
    if (this.friendsPendingView) this.friendsPendingView.style.display = tab === 'pending' ? 'flex' : 'none';
    if (this.friendsAddView) this.friendsAddView.style.display = tab === 'add' ? 'flex' : 'none';

    if (tab === 'all') this.loadFriendsList();
    if (tab === 'pending') this.loadPendingRequests();
    if (tab === 'add') this.friendsSearchUsers(); // Auto-load all users
};

AIAssistant.prototype.loadFriendsData = async function() {
    try {
        const { data, error } = await this.supabase
            .from('friends')
            .select('*')
            .eq('status', 'accepted')
            .or(`user_id.eq.${this.userId},friend_id.eq.${this.userId}`);

        if (error) throw error;

        const friendIds = (data || []).map(f => f.user_id === this.userId ? f.friend_id : f.user_id);
        if (friendIds.length === 0) {
            this.friendsData = [];
            return;
        }

        const { data: users } = await this.supabase
            .from('users')
            .select('id, username, email')
            .in('id', friendIds);

        this.friendsData = (users || []).map(u => ({
            id: u.id,
            name: u.username || u.email.split('@')[0],
            email: u.email
        }));
    } catch (error) {
        console.error('Load friends data error:', error);
        this.friendsData = [];
    }
};

AIAssistant.prototype.loadFriendsList = async function() {
    await this.loadFriendsData();

    if (this.friendsData.length === 0) {
        if (this.friendsList) this.friendsList.innerHTML = '<div class="dc-empty">No friends yet. Go to the "Add" tab to find people!</div>';
        return;
    }

    if (this.friendsList) {
        this.friendsList.innerHTML = this.friendsData.map(friend => {
            const initial = (friend.name || '?')[0].toUpperCase();
            return `
                <div class="dc-user-item" style="padding:10px 14px;">
                    <div class="dc-user-avatar">${initial}</div>
                    <div class="dc-user-info">
                        <div class="dc-user-name">${this.escapeHtml(friend.name)}</div>
                        <div class="dc-user-email">${this.escapeHtml(friend.email)}</div>
                    </div>
                    <div class="dc-friend-actions">
                        <button class="dc-friend-btn chat" data-action="open-chat" data-user-id="${friend.id}" data-user-name="${this.escapeHtml(friend.name)}">Chat</button>
                        <button class="dc-friend-btn remove" data-action="remove-friend" data-user-id="${friend.id}" title="Unfriend">Unfriend</button>
                        <button class="dc-friend-btn decline" data-action="block-user" data-user-id="${friend.id}" title="Block" style="font-size:11px;padding:4px 8px;">Block</button>
                    </div>
                </div>
            `;
        }).join('');

        this.friendsList.querySelectorAll('[data-action]').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                if (btn.dataset.action === 'open-chat') {
                    this.closeFriendsPanel();
                    this.openDirectChat();
                    setTimeout(() => this.dcStartChat(btn.dataset.userId, btn.dataset.userName), 300);
                } else if (btn.dataset.action === 'remove-friend') {
                    if (confirm('Unfriend this user?')) {
                        await this.removeFriend(btn.dataset.userId);
                        this.loadFriendsList();
                    }
                } else if (btn.dataset.action === 'block-user') {
                    if (confirm('Block this user? They won\'t be able to message you.')) {
                        await this.blockUser(btn.dataset.userId);
                        this.loadFriendsList();
                    }
                }
            });
        });
    }
};

AIAssistant.prototype.loadPendingRequests = async function() {
    try {
        // Incoming requests
        const { data: incoming } = await this.supabase
            .from('friends')
            .select('*')
            .eq('friend_id', this.userId)
            .eq('status', 'pending');

        // Outgoing requests
        const { data: outgoing } = await this.supabase
            .from('friends')
            .select('*')
            .eq('user_id', this.userId)
            .eq('status', 'pending');

        const allPending = [...(incoming || []), ...(outgoing || [])];

        if (allPending.length === 0) {
            if (this.friendsPendingList) this.friendsPendingList.innerHTML = '<div class="dc-empty">No pending requests</div>';
            return;
        }

        const userIds = allPending.map(f => f.user_id === this.userId ? f.friend_id : f.user_id);
        const { data: users } = await this.supabase
            .from('users')
            .select('id, username, email')
            .in('id', userIds);

        const userMap = {};
        (users || []).forEach(u => { userMap[u.id] = u; });

        if (this.friendsPendingList) {
            this.friendsPendingList.innerHTML = allPending.map(req => {
                const isIncoming = req.friend_id === this.userId;
                const otherId = isIncoming ? req.user_id : req.friend_id;
                const otherUser = userMap[otherId] || {};
                const displayName = otherUser.username || (otherUser.email ? otherUser.email.split('@')[0] : 'User');
                const initial = displayName[0].toUpperCase();

                let actions = '';
                if (isIncoming) {
                    actions = `
                        <button class="dc-friend-btn accept" data-action="accept" data-id="${req.id}">Accept</button>
                        <button class="dc-friend-btn decline" data-action="decline" data-id="${req.id}">Decline</button>
                    `;
                } else {
                    actions = `<span class="dc-friend-btn pending-label">Sent</span>`;
                }

                return `
                    <div class="dc-user-item" style="padding:10px 14px;">
                        <div class="dc-user-avatar">${initial}</div>
                        <div class="dc-user-info">
                            <div class="dc-user-name">${this.escapeHtml(displayName)}</div>
                            <div class="dc-user-email">${isIncoming ? 'Wants to be your friend' : 'Request sent'}</div>
                        </div>
                        <div class="dc-friend-actions">${actions}</div>
                    </div>
                `;
            }).join('');

            this.friendsPendingList.querySelectorAll('[data-action]').forEach(btn => {
                btn.addEventListener('click', async (e) => {
                    e.stopPropagation();
                    if (btn.dataset.action === 'accept') {
                        await this.acceptFriendRequest(btn.dataset.id);
                    } else if (btn.dataset.action === 'decline') {
                        await this.declineFriendRequest(btn.dataset.id);
                    }
                    this.loadPendingRequests();
                });
            });
        }
    } catch (error) {
        console.error('Load pending error:', error);
    }
};

AIAssistant.prototype.friendsSearchUsers = async function() {
    const query = this.friendsSearchInput?.value?.trim();

    try {
        // If query provided, filter; otherwise show all users
        let supaQuery = this.supabase
            .from('users')
            .select('id, username, email')
            .neq('id', this.userId)
            .limit(20);

        if (query && query.length >= 2) {
            supaQuery = supaQuery.or(`username.ilike.%${query}%,email.ilike.%${query}%`);
        }

        const { data, error } = await supaQuery;

        if (error) throw error;

        if (!data || data.length === 0) {
            if (this.friendsSearchResults) this.friendsSearchResults.innerHTML = '<div class="dc-empty" style="padding:12px 16px;font-size:13px;">No users found</div>';
            return;
        }

        // Check existing friendships
        const { data: friendships } = await this.supabase
            .from('friends')
            .select('*')
            .or(`user_id.eq.${this.userId},friend_id.eq.${this.userId}`);

        const friendMap = {};
        (friendships || []).forEach(f => {
            const otherId = f.user_id === this.userId ? f.friend_id : f.user_id;
            friendMap[otherId] = f;
        });

        if (this.friendsSearchResults) {
            this.friendsSearchResults.innerHTML = data.map(user => {
                const initial = (user.username || user.email || '?')[0].toUpperCase();
                const displayName = user.username || user.email.split('@')[0];
                const friendship = friendMap[user.id];
                let actionBtn = '';
                if (!friendship) {
                    actionBtn = `<button class="dc-friend-btn add" data-action="add" data-user-id="${user.id}">Add Friend</button>`;
                } else if (friendship.status === 'pending') {
                    actionBtn = `<span class="dc-friend-btn pending-label">Pending</span>`;
                } else if (friendship.status === 'accepted') {
                    actionBtn = `<span class="dc-friend-btn pending-label" style="background:#48bb78;color:white;">Friends</span>`;
                }

                return `
                    <div class="dc-user-item" style="padding:10px 14px;">
                        <div class="dc-user-avatar">${initial}</div>
                        <div class="dc-user-info">
                            <div class="dc-user-name">${this.escapeHtml(displayName)}</div>
                            <div class="dc-user-email">${this.escapeHtml(user.email)}</div>
                        </div>
                        <div class="dc-friend-actions">${actionBtn}</div>
                    </div>
                `;
            }).join('');

            this.friendsSearchResults.querySelectorAll('[data-action="add"]').forEach(btn => {
                btn.addEventListener('click', async (e) => {
                    e.stopPropagation();
                    await this.sendFriendRequest(btn.dataset.userId);
                    btn.textContent = 'Pending';
                    btn.className = 'dc-friend-btn pending-label';
                });
            });
        }
    } catch (error) {
        console.error('Friends search error:', error);
    }
};

AIAssistant.prototype.sendFriendRequest = async function(friendId) {
    try {
        if (!friendId || friendId === this.userId) {
            this.showNotification('Error', 'Invalid user.');
            return;
        }

        // Check if request already exists (either direction)
        const { data: existing } = await this.supabase
            .from('friends')
            .select('id, status')
            .or(`and(user_id.eq.${this.userId},friend_id.eq.${friendId}),and(user_id.eq.${friendId},friend_id.eq.${this.userId})`)
            .limit(1);

        if (existing && existing.length > 0) {
            if (existing[0].status === 'pending') {
                this.showNotification('Info', 'Friend request already pending.');
            } else if (existing[0].status === 'accepted') {
                this.showNotification('Info', 'You are already friends!');
            }
            return;
        }

        const { error } = await this.supabase
            .from('friends')
            .insert({ user_id: this.userId, friend_id: friendId, status: 'pending' });
        if (error) throw error;
        this.showNotification('Success', 'Friend request sent!');
    } catch (error) {
        console.error('Send friend request error:', error);
        this.showNotification('Error', 'Failed to send friend request: ' + (error.message || 'Unknown error'));
    }
};

AIAssistant.prototype.acceptFriendRequest = async function(friendshipId) {
    try {
        const { error } = await this.supabase
            .from('friends')
            .update({ status: 'accepted' })
            .eq('id', friendshipId);
        if (error) throw error;
    } catch (error) {
        console.error('Accept friend error:', error);
    }
};

AIAssistant.prototype.declineFriendRequest = async function(friendshipId) {
    try {
        const { error } = await this.supabase
            .from('friends')
            .delete()
            .eq('id', friendshipId);
        if (error) throw error;
    } catch (error) {
        console.error('Decline friend error:', error);
    }
};

AIAssistant.prototype.removeFriend = async function(friendId) {
    try {
        await this.supabase
            .from('friends')
            .delete()
            .or(`and(user_id.eq.${this.userId},friend_id.eq.${friendId}),and(user_id.eq.${friendId},friend_id.eq.${this.userId})`);
    } catch (error) {
        console.error('Remove friend error:', error);
    }
};

// ============================================
// CONNECTION RECOVERY & MESSAGE SYNC
// ============================================

// Re-subscribe and reload when connection is restored
AIAssistant.prototype.dcSetupConnectionRecovery = function() {
    // Listen for online/offline events
    window.addEventListener('online', () => {
        console.log('Connection restored — resyncing chat...');
        this.showNotification('Info', 'Connection restored.');
        // Reload current chat messages
        if (this.dcActiveChatId || this.dcActiveGroupId) {
            this.dcLoadMessages();
            this.dcSubscribeToMessages();
        }
        // Also refresh chat list
        if (this.directChatPanel?.style.display === 'flex') {
            this.dcLoadChats();
        }
    });

    window.addEventListener('offline', () => {
        console.log('Connection lost');
        this.showNotification('Warning', 'You are offline. Messages will retry when connected.');
    });

    // Visibility change — resync when tab becomes visible again
    document.addEventListener('visibilitychange', () => {
        if (!document.hidden && this.directChatPanel?.style.display === 'flex') {
            if (this.dcActiveChatId || this.dcActiveGroupId) {
                this.dcLoadMessages();
            } else {
                this.dcLoadChats();
            }
        }
    });
};

// ============================================================
// AUTO-REFRESH POLLING FALLBACK
// Polls for new messages every 3 s when a chat is open.
// Supabase realtime is the primary mechanism; this is the backup.
// ============================================================

AIAssistant.prototype.dcStartMessagePoll = function() {
    if (this._dcPollInterval) {
        clearInterval(this._dcPollInterval);
        this._dcPollInterval = null;
    }
    this._dcLastSeenMsgTime = null;

    this._dcPollInterval = setInterval(async () => {
        if (!this.dcActiveChatId && !this.dcActiveGroupId) return;
        if (!this.dcMessages) return;

        try {
            const isGroup = !!this.dcActiveGroupId;
            const table   = isGroup ? 'group_messages'  : 'direct_messages';
            const col     = isGroup ? 'group_id'        : 'chat_id';
            const id      = isGroup ? this.dcActiveGroupId : this.dcActiveChatId;

            let q = this.supabase
                .from(table)
                .select('*')
                .eq(col, id)
                .order('created_at', { ascending: false })
                .limit(10);

            if (this._dcLastSeenMsgTime) {
                q = q.gt('created_at', this._dcLastSeenMsgTime);
            }

            const { data } = await q;
            if (!data || data.length === 0) return;

            // Update watermark
            this._dcLastSeenMsgTime = data[0].created_at;

            // Append only messages not already in the DOM (newest last)
            const reversed = [...data].reverse();
            for (const msg of reversed) {
                if (!this.dcMessages.querySelector(`[data-msg-id="${msg.id}"]`)) {
                    this.dcAppendSingleMessage(msg);
                }
            }
        } catch (_) { /* silent */ }
    }, 3000);
};

// ============================================================
// PUSH NOTIFICATIONS (messages & calls when app not focused)
// ============================================================

AIAssistant.prototype.initNotifications = async function() {
    // Register service worker
    if ('serviceWorker' in navigator) {
        try {
            this._swReg = await navigator.serviceWorker.register('/sw.js');
            console.log('[NOTIF] Service worker registered');
        } catch (err) {
            console.warn('[NOTIF] SW registration failed:', err);
        }
    }

    // Request permission on first meaningful interaction
    if ('Notification' in window && Notification.permission === 'default') {
        // Don't ask immediately — wait for user to click something
        const askOnce = () => {
            Notification.requestPermission().then(p => console.log('[NOTIF] Permission:', p));
            document.removeEventListener('click', askOnce);
        };
        // Ask after 5 seconds so user has interacted with the page
        setTimeout(() => {
            if (Notification.permission === 'default') {
                document.addEventListener('click', askOnce, { once: true });
            }
        }, 5000);
    }
};

// Show a native notification (only when page is NOT focused)
AIAssistant.prototype._showNativeNotification = function(title, body, tag) {
    if (!('Notification' in window)) return;
    if (Notification.permission !== 'granted') return;
    // Only show if page is hidden/not focused
    if (document.visibilityState === 'visible' && document.hasFocus()) return;

    try {
        const notif = new Notification(title, {
            body: body,
            icon: '/favicon.ico',
            badge: '/favicon.ico',
            tag: tag || 'voidzenzi-' + Date.now(),
            renotify: true,
            silent: false
        });
        // Auto-close after 8 seconds
        setTimeout(() => notif.close(), 8000);
        // Focus app on click
        notif.onclick = () => {
            window.focus();
            notif.close();
        };
    } catch (err) {
        // Fallback: use service worker notification
        if (this._swReg) {
            this._swReg.showNotification(title, {
                body: body,
                icon: '/favicon.ico',
                tag: tag || 'voidzenzi-' + Date.now()
            }).catch(() => {});
        }
    }
};

// Helper: notify for new messages
AIAssistant.prototype._notifyNewMessage = async function(senderId, content, isGroup) {
    let senderName = 'Someone';
    try {
        const { data } = await this.supabase.from('users').select('username,email').eq('id', senderId).single();
        senderName = data?.username || data?.email?.split('@')[0] || 'Someone';
    } catch (_) {}
    const preview = (content || '').substring(0, 80) + ((content || '').length > 80 ? '...' : '');
    const prefix = isGroup ? '👥 Group: ' : '💬 ';
    this._showNativeNotification(`${prefix}${senderName}`, preview, `msg-${senderId}`);
};

// ============================================================
// VOICE & VIDEO CALLS — CLEAN REWRITE
// WebRTC + Supabase Realtime signaling
// ============================================================

// ── ICE CONFIG — robust STUN + TURN for global connectivity ─────────
// Multiple STUN servers for NAT type detection, plus TURN servers for
// symmetric NAT / firewall traversal (India ↔ USA etc.)
const _ICE_BASE = {
    iceCandidatePoolSize: 10,
    bundlePolicy: 'max-bundle',
    rtcpMuxPolicy: 'require',
    iceTransportPolicy: 'all', // try P2P first, fall back to relay
    iceServers: [
        // STUN — Google (most reliable, globally distributed)
        { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] },
        { urls: ['stun:stun2.l.google.com:19302', 'stun:stun3.l.google.com:19302', 'stun:stun4.l.google.com:19302'] },
        // STUN — Cloudflare + Twilio (backup)
        { urls: 'stun:stun.cloudflare.com:3478' },
        { urls: 'stun:global.stun.twilio.com:3478' },
        // TURN — FreeTURN (no registration, free, good global coverage)
        { urls: 'turn:freestun.net:3479',                      username: 'free',             credential: 'free' },
        { urls: 'turns:freestun.net:5350',                     username: 'free',             credential: 'free' },
        { urls: 'turn:freestun.net:3478',                      username: 'free',             credential: 'free' },
        // TURN — OpenRelay fallback (UDP, TCP, TLS)
        { urls: 'turn:openrelay.metered.ca:80',                username: 'openrelayproject', credential: 'openrelayproject' },
        { urls: 'turn:openrelay.metered.ca:443',               username: 'openrelayproject', credential: 'openrelayproject' },
        { urls: 'turn:openrelay.metered.ca:443?transport=tcp', username: 'openrelayproject', credential: 'openrelayproject' },
        { urls: 'turn:openrelay.metered.ca:80?transport=tcp',  username: 'openrelayproject', credential: 'openrelayproject' },
        { urls: 'turns:openrelay.metered.ca:443',              username: 'openrelayproject', credential: 'openrelayproject' },
    ]
};

// Dynamic TURN fetcher — tries to get fresh credentials from Metered.ca API (free tier)
// Falls back to static config if fetch fails
let _ICE = _ICE_BASE;
let _iceLastFetch = 0;
async function _refreshICE() {
    if (Date.now() - _iceLastFetch < 300_000) return; // cache 5min
    try {
        const r = await fetch('https://voidzen_ai.metered.live/api/v1/turn/credentials?apiKey=c6ebad70334072baa1f086fcd5884ccf7921');
        if (r.ok) {
            const servers = await r.json();
            if (Array.isArray(servers) && servers.length > 0) {
                const dynamic = servers.map(s => ({ urls: s.urls || s.url, username: s.username, credential: s.credential }));
                _ICE = { ..._ICE_BASE, iceServers: [..._ICE_BASE.iceServers, ...dynamic] };
                _iceLastFetch = Date.now();
                console.log('[ICE] Fetched', dynamic.length, 'dynamic TURN servers');
                return;
            }
        }
    } catch(_) {}
    // If dynamic fetch fails, use static config
    _ICE = _ICE_BASE;
    _iceLastFetch = Date.now();
    console.log('[ICE] Using static STUN/TURN config');
}

AIAssistant.prototype.initCallUI = function() {
    this._pc = null;           // RTCPeerConnection
    this._ls = null;           // local MediaStream
    this._callId = null;
    this._callSub = null;
    this._candSub = null;
    this._renegoCh = null;
    this._stateCh = null;
    this._isCaller = false;
    this._incomingCall = null;
    this._isMuted = false;
    this._isVideoOff = false;
    this._isScreenSharing = false;
    this._screenStream = null;
    this._savedCamTrack = null;
    this._callTimer = null;
    this._callStartTime = null;
    this._facingMode = 'user';
    this._callType = 'voice';
    this._renegoLock = false;
    this._iceRestarted = false;
    this._bgEndTimer = null;
    this._sigCh = null;      // broadcast channel: fast ICE candidates + hangup sync
    this._incomingCh = null; // broadcast channel: receive incoming call ring
    this._pollTimer = null;  // polling: watch for answer
    this._endPollTimer = null; // polling: watch for call ended (separate from answer poll)
    this._candTimer = null;  // polling: fetch new ICE candidates
    this._incTimer  = null;  // polling: watch for incoming calls
    this._callPeerId = null; // the other person's userId (for end broadcast)
    this._rcDataChannel = null;      // WebRTC DataChannel for remote control
    this._rcDataChannelReady = false;
    this._bitrateTimer = null;       // adaptive bitrate monitor
    this._credRefreshTimer = null;   // TURN credential refresh (before 1hr expiry)

    const $ = id => document.getElementById(id);
    this._el = {
        voiceBtn: $('dcVoiceCallBtn'), videoBtn: $('dcVideoCallBtn'),
        incomingModal: $('incomingCallModal'), callerName: $('incomingCallerName'),
        callTypeLabel: $('incomingCallTypeLabel'), callIcon: $('incomingCallIcon'),
        acceptBtn: $('acceptCallBtn'), rejectBtn: $('rejectCallBtn'),
        overlay: $('callOverlay'), overlayAvatar: $('callOverlayAvatar'),
        overlayName: $('callOverlayName'), statusText: $('callStatusText'),
        callTimer: $('callTimer'), remoteMuteIndicator: $('callRemoteMuteIndicator'),
        videoContainer: $('callVideoContainer'), localVideo: $('localVideo'),
        remoteVideo: $('remoteVideo'), remoteAudio: $('remoteAudio'),
        hangupBtn: $('hangupBtn'), muteBtn: $('toggleMuteBtn'),
        videoToggleBtn: $('toggleVideoBtn'), switchToVideoBtn: $('callSwitchToVideoBtn'),
        screenShareBtn: $('callScreenShareBtn'), flipCamBtn: $('callFlipCamBtn'),
        fullscreenBtn: $('callFullscreenBtn'), remoteControlBtn: $('callRemoteControlBtn'),
        rcModal: $('remoteControlModal'), rcModalTitle: $('rcModalTitle'), rcModalText: $('rcModalText'),
        rcAcceptBtn: $('rcAcceptBtn'), rcDenyBtn: $('rcDenyBtn'),
        rcStatus: $('remoteControlStatus'), rcControllerName: $('rcControllerName'),
        rcCursor: $('rcRemoteCursor'), rcCursorLabel: $('rcCursorLabel'), rcClickRipple: $('rcClickRipple'),
        fsControls: $('callFsControls'),
        fsMuteBtn: $('fsMuteBtn'), fsVideoBtn: $('fsVideoBtn'), fsScreenBtn: $('fsScreenBtn'),
        fsHangupBtn: $('fsHangupBtn'), fsExitBtn: $('fsExitBtn'),
    };

    // Remote control state
    this._rcActive = false;      // true if WE are controlling the remote
    this._rcBeingControlled = false; // true if THEY are controlling us
    this._rcPeerScreening = false; // true if the OTHER side is screen sharing (we see it)

    if (this._el.voiceBtn)         this._el.voiceBtn.onclick  = () => this.callStart('voice');
    if (this._el.videoBtn)         this._el.videoBtn.onclick  = () => this.callStart('video');
    if (this._el.acceptBtn)        this._el.acceptBtn.onclick = () => this.callAccept();
    if (this._el.rejectBtn)        this._el.rejectBtn.onclick = () => this.callReject();
    if (this._el.hangupBtn)        this._el.hangupBtn.onclick = () => this.callHangup();
    if (this._el.muteBtn)          this._el.muteBtn.onclick   = () => this.callToggleMute();
    if (this._el.videoToggleBtn)   this._el.videoToggleBtn.onclick   = () => this.callToggleVideo();
    if (this._el.switchToVideoBtn) this._el.switchToVideoBtn.onclick = () => this.callSwitchToVideo();
    if (this._el.screenShareBtn)   this._el.screenShareBtn.onclick   = () => this.callShareScreen();
    if (this._el.flipCamBtn)       this._el.flipCamBtn.onclick       = () => this.callFlipCamera();
    if (this._el.fullscreenBtn)    this._el.fullscreenBtn.onclick    = () => this.callToggleFullscreen();
    if (this._el.remoteControlBtn) this._el.remoteControlBtn.onclick = () => this.callRequestRemoteControl();
    if (this._el.rcAcceptBtn)      this._el.rcAcceptBtn.onclick      = () => this.callAcceptRemoteControl();
    if (this._el.rcDenyBtn)        this._el.rcDenyBtn.onclick        = () => this.callDenyRemoteControl();
    if (this._el.rcStatus)         this._el.rcStatus.onclick         = () => this.callStopRemoteControl();
    // Fullscreen duplicate controls (inside the fullscreen view)
    if (this._el.fsMuteBtn)        this._el.fsMuteBtn.onclick        = () => this.callToggleMute();
    if (this._el.fsVideoBtn)       this._el.fsVideoBtn.onclick       = () => this.callToggleVideo();
    if (this._el.fsScreenBtn)      this._el.fsScreenBtn.onclick      = () => this.callShareScreen();
    if (this._el.fsHangupBtn)      this._el.fsHangupBtn.onclick      = () => this.callHangup();
    if (this._el.fsExitBtn)        this._el.fsExitBtn.onclick        = () => this.callToggleFullscreen();

    this._subscribeIncomingCalls();
    this.initPresence();

    // End call when tab/window is TRULY closed.
    // IMPORTANT: pagehide with !persisted fires on mobile when user locks screen or
    // switches apps — that must NOT end the call. Only fire beacon on real unload.
    const _beacon = (id) => {
        navigator.sendBeacon('/api/end-call', new Blob([JSON.stringify({callId:id})],{type:'application/json'}));
    };
    let _realUnload = false;
    window.addEventListener('beforeunload', () => { _realUnload = true; if (this._callId) _beacon(this._callId); });
    window.addEventListener('pagehide', (e) => { if (this._callId && !e.persisted && _realUnload) _beacon(this._callId); });

    // NOTE: No background-kill timer — WebRTC calls survive background/screen-lock on mobile.
    // The beforeunload beacon above handles actual tab/app close.
    this._bgEndTimer = null;
};

// ── INCOMING CALLS ───────────────────────────────────────────
AIAssistant.prototype._subscribeIncomingCalls = function() {
    if (!this.supabase || !this.userId) return;

    // PRIMARY: broadcast channel — works instantly, no Supabase realtime toggle needed
    this._incomingCh = this.supabase.channel(`ic-${this.userId}`)
        .on('broadcast', {event:'ring'}, ({payload:p}) => {
            if (!p?.call) return;
            if (this._incomingCall?.id === p.call.id) return; // dedup
            if (this._callId) return; // already in a call
            this._showIncoming(p.call);
        })
        .on('broadcast', {event:'end'}, ({payload:p}) => {
            // Hangup delivered via peer's incoming channel — most reliable path
            if (!p?.callId) return;
            if (this._callId && this._callId === p.callId) this._endLocal('Call ended');
            else if (this._incomingCall && this._incomingCall.id === p.callId) {
                this._stopRingtone();
                this._incomingCall = null;
                if (this._el.incomingModal) this._el.incomingModal.style.display = 'none';
            }
        })
        .subscribe();

    // FALLBACK: postgres_changes (only fires if realtime is ON in Supabase dashboard)
    this.supabase.channel(`inc-${this.userId}`)
        .on('postgres_changes', { event:'INSERT', schema:'public', table:'calls', filter:`callee_id=eq.${this.userId}` },
            p => {
                if (p.new.status !== 'ringing') return;
                if (this._incomingCall?.id === p.new.id) return; // dedup
                if (this._callId) return;
                this._showIncoming(p.new);
            }).subscribe();

    // FALLBACK 2: REST poll every 3s (works with zero Supabase config)
    this._pollForIncoming();
};

// ── WEB PUSH SETUP ───────────────────────────────────────────
function _urlB64ToUint8(base64String) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const raw = atob(base64);
    return Uint8Array.from([...raw].map(c => c.charCodeAt(0)));
}

AIAssistant.prototype.initPushNotifications = async function() {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;
    try {
        const reg = await navigator.serviceWorker.register('/sw.js');
        const perm = await Notification.requestPermission();
        if (perm !== 'granted') return;

        // Fetch VAPID public key from server
        const keyResp = await fetch('/api/push/vapid-key');
        const { key } = await keyResp.json();
        if (!key) return; // VAPID not configured on server

        let sub = await reg.pushManager.getSubscription();
        if (!sub) {
            sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: _urlB64ToUint8(key) });
        }
        await fetch('/api/push/subscribe', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ userId:this.userId, subscription:sub.toJSON() }) });
    } catch(e) {
        console.warn('[Push] setup failed:', e.message);
    }
};

// ── RINGTONE (Web Audio — no external file needed) ───────────
AIAssistant.prototype._playRingtone = function() {
    if (this._ringtoneTimer) return;
    const ring = () => {
        try {
            const ctx = new (window.AudioContext || window.webkitAudioContext)();
            [[480, 0, 0.4], [620, 0.4, 0.4], [480, 0.8, 0.4], [620, 1.2, 0.4]].forEach(([freq, when, dur]) => {
                const osc = ctx.createOscillator(), gain = ctx.createGain();
                osc.connect(gain); gain.connect(ctx.destination);
                osc.type = 'sine'; osc.frequency.value = freq;
                gain.gain.setValueAtTime(0.25, ctx.currentTime + when);
                gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + when + dur);
                osc.start(ctx.currentTime + when); osc.stop(ctx.currentTime + when + dur);
                osc.onended = () => { try { ctx.close(); } catch(_) {} };
            });
        } catch(_) {}
    };
    ring();
    this._ringtoneTimer = setInterval(ring, 3000);
};

AIAssistant.prototype._stopRingtone = function() {
    if (this._ringtoneTimer) { clearInterval(this._ringtoneTimer); this._ringtoneTimer = null; }
};

// ── INCOMING CALL DISPLAY ────────────────────────────────────
AIAssistant.prototype._showIncoming = async function(call) {
    if (this._callId) return;
    this._incomingCall = call;
    let name = 'Unknown';
    try { const {data} = await this.supabase.from('users').select('username,email').eq('id',call.caller_id).single(); name = data?.username || data?.email?.split('@')[0] || 'Unknown'; } catch(_){}
    if (this._el.callerName)    this._el.callerName.textContent    = name;
    if (this._el.callTypeLabel) this._el.callTypeLabel.textContent = call.call_type==='video' ? '🎥 Incoming Video Call' : '📞 Incoming Voice Call';
    if (this._el.callIcon)      this._el.callIcon.textContent      = call.call_type==='video' ? '🎥' : '📞';
    if (this._el.incomingModal) this._el.incomingModal.style.display = 'flex';
    this._playRingtone();
    this._showNativeNotification(`📞 Incoming ${call.call_type==='video'?'Video':'Voice'} Call`, `${name} is calling you`, 'incoming-call');
    if (this._incomingWatchSub) this.supabase.removeChannel(this._incomingWatchSub);
    this._incomingWatchSub = this.supabase.channel(`iw-${call.id}`)
        .on('postgres_changes', { event:'UPDATE', schema:'public', table:'calls', filter:`id=eq.${call.id}` },
            p => { if (p.new.status==='ended'||p.new.status==='rejected') { this._stopRingtone(); this._incomingCall=null; if(this._el.incomingModal) this._el.incomingModal.style.display='none'; if(this._incomingWatchSub){this.supabase.removeChannel(this._incomingWatchSub);this._incomingWatchSub=null;} } })
        .subscribe();
};

// ── PEER CONNECTION ──────────────────────────────────────────
AIAssistant.prototype._makePc = function() {
    if (this._pc) { try{this._pc.close();}catch(_){} }
    this._pc = new RTCPeerConnection(_ICE);
    this._rcDataChannel = null;    // WebRTC DataChannel for low-latency remote control
    this._rcDataChannelReady = false;

    const _connBadge = document.getElementById('webrtcConnBadge');
    const _updateBadge = (state) => {
        if (!_connBadge) return;
        _connBadge.style.display = 'block';
        _connBadge.className = 'webrtc-conn-badge';
        if (state === 'connected' || state === 'completed') {
            // Check if using relay (TURN) by inspecting selected candidate pair
            this._checkRelayStatus().then(isRelay => {
                _connBadge.className = 'webrtc-conn-badge ' + (isRelay ? 'relay' : 'connected');
                _connBadge.textContent = isRelay ? 'Relay (TURN)' : 'P2P Connected';
            });
        } else if (state === 'connecting' || state === 'new' || state === 'checking') {
            _connBadge.className = 'webrtc-conn-badge connecting';
            _connBadge.textContent = 'Connecting...';
        } else if (state === 'disconnected' || state === 'failed') {
            _connBadge.className = 'webrtc-conn-badge disconnected';
            _connBadge.textContent = state === 'failed' ? 'Connection Failed' : 'Reconnecting...';
        }
    };

    // ontrack: wire audio to <audio>, video to <video>
    // Use e.streams[0] so replaceTrack auto-updates the remote side
    this._pc.ontrack = (e) => {
        console.log('[CALL] ontrack:', e.track.kind, 'streams:', e.streams.length, 'track.readyState:', e.track.readyState, 'track.enabled:', e.track.enabled);
        if (e.track.kind === 'audio') {
            const s = e.streams[0] || new MediaStream([e.track]);
            if (this._el.remoteAudio) {
                this._el.remoteAudio.srcObject = s;
                this._el.remoteAudio.volume = 0.7;
                const play = () => { if (this._el.remoteAudio) this._el.remoteAudio.play().catch(() => {}); };
                play(); setTimeout(play, 200); setTimeout(play, 800); setTimeout(play, 2000);
                const tap = () => { play(); };
                document.addEventListener('click',    tap, {once:true, capture:true});
                document.addEventListener('touchstart', tap, {once:true, capture:true});
                document.addEventListener('keydown',  tap, {once:true, capture:true});
            }
        }
        if (e.track.kind === 'video') {
            const s = e.streams[0] || new MediaStream([e.track]);
            if (this._el.remoteVideo) {
                this._el.remoteVideo.srcObject = s;
                // Force video to play — multiple attempts to handle autoplay restrictions
                const playVideo = () => {
                    if (!this._el.remoteVideo) return;
                    this._el.remoteVideo.play().catch(err => {
                        console.warn('[CALL] remote video play failed:', err.name);
                    });
                };
                playVideo();
                setTimeout(playVideo, 100);
                setTimeout(playVideo, 500);
                setTimeout(playVideo, 1500);
                // Monitor track state for black screen prevention
                e.track.onended = () => console.warn('[CALL] remote video track ended');
            }
            if (this._el.videoContainer) this._el.videoContainer.style.display = 'block';
            if (this._el.overlayAvatar)  this._el.overlayAvatar.style.display = 'none';
        }
        e.track.onunmute = () => {
            console.log('[CALL] track unmuted:', e.track.kind);
            if (e.track.kind==='video') {
                if(this._el.videoContainer) this._el.videoContainer.style.display='block';
                if(this._el.overlayAvatar)  this._el.overlayAvatar.style.display='none';
                if(this._el.remoteVideo) {
                    // Re-attach stream on unmute to prevent black screen
                    const currentSrc = this._el.remoteVideo.srcObject;
                    if (currentSrc) {
                        this._el.remoteVideo.srcObject = null;
                        this._el.remoteVideo.srcObject = currentSrc;
                    }
                    this._el.remoteVideo.play().catch(()=>{});
                }
            }
            if (e.track.kind==='audio' && this._el.remoteAudio) { this._el.remoteAudio.volume=0.7; this._el.remoteAudio.play().catch(()=>{}); }
        };
        e.track.onmute = () => { console.log('[CALL] track muted:', e.track.kind); };
    };

    // ── ICE GATHERING STATE LOGGING ─────────────────────────────
    this._pc.onicegatheringstatechange = () => {
        console.log('[ICE] gathering:', this._pc?.iceGatheringState);
    };
    this._pc.oniceconnectionstatechange = () => {
        const s = this._pc?.iceConnectionState;
        console.log('[ICE] connection:', s);
        _updateBadge(s);
    };
    this._pc.onsignalingstatechange = () => {
        console.log('[ICE] signaling:', this._pc?.signalingState);
    };

    // ── DataChannel for remote control (low latency) ─────────────
    // The caller creates the channel; the callee receives it via ondatachannel
    this._pc.ondatachannel = (ev) => {
        console.log('[DC] received data channel:', ev.channel.label);
        if (ev.channel.label === 'rc') {
            this._rcDataChannel = ev.channel;
            this._setupRcDataChannel(ev.channel);
        }
    };

    this._pc.onconnectionstatechange = () => {
        const s = this._pc?.connectionState; console.log('[CALL] conn:', s);
        _updateBadge(s);
        if (s==='connected') {
            if(this._el.statusText) this._el.statusText.textContent='Connected';
            if(this._dcTimeout){clearTimeout(this._dcTimeout);this._dcTimeout=null;}
            this._iceRestarted = false;
            // Start adaptive bitrate monitoring
            this._startBitrateMonitor();
            // Schedule TURN credential refresh at 45 min (tokens expire at 60 min)
            this._startCredentialRefresh();
        }
        else if (s==='connecting') {
            if(this._dcTimeout){clearTimeout(this._dcTimeout);this._dcTimeout=null;}
        }
        else if (s==='disconnected') {
            if(this._el.statusText) this._el.statusText.textContent='Reconnecting...';
            if(this._dcTimeout) clearTimeout(this._dcTimeout);
            this._dcTimeout = setTimeout(()=>{
                if(this._pc?.connectionState==='disconnected') {
                    console.log('[CALL] attempting ICE restart...');
                    this._pc.restartIce();
                    this._triggerRenegotiation();
                    this._dcTimeout = setTimeout(()=>{
                        if(this._pc?.connectionState==='disconnected'||this._pc?.connectionState==='failed') this.callHangup();
                    }, 30000);
                }
            }, 15000); // 15s before restart (was 60s — too slow)
        }
        else if (s==='failed') {
            if(this._dcTimeout){clearTimeout(this._dcTimeout);this._dcTimeout=null;}
            if (!this._iceRestarted && this._pc) {
                this._iceRestarted = true;
                if(this._el.statusText) this._el.statusText.textContent='Reconnecting...';
                console.log('[CALL] connection failed, restarting ICE...');
                this._pc.restartIce();
                this._triggerRenegotiation();
                this._dcTimeout = setTimeout(()=>{
                    if(this._pc?.connectionState==='failed') {
                        // Last resort: force relay-only reconnection
                        console.log('[CALL] P2P failed, trying relay-only...');
                        this._forceRelayReconnect();
                    }
                }, 20000);
            } else if (this._iceRestarted) {
                if(this._dcTimeout) clearTimeout(this._dcTimeout);
                this._dcTimeout = setTimeout(()=>{ this.callHangup(); }, 30000);
            }
        }
    };
};

// ── Check if connection is using TURN relay ──────────────────
AIAssistant.prototype._checkRelayStatus = async function() {
    if (!this._pc) return false;
    try {
        const stats = await this._pc.getStats();
        for (const [, report] of stats) {
            if (report.type === 'candidate-pair' && report.state === 'succeeded') {
                for (const [, r2] of stats) {
                    if (r2.id === report.localCandidateId || r2.id === report.remoteCandidateId) {
                        if (r2.candidateType === 'relay') return true;
                    }
                }
            }
        }
    } catch(_) {}
    return false;
};

// ── Force relay-only reconnection (last resort for symmetric NAT) ──
AIAssistant.prototype._forceRelayReconnect = function() {
    if (!this._pc || !this._renegoCh) return;
    console.log('[ICE] forcing relay-only transport policy');
    // We can't change iceTransportPolicy on existing PC, so trigger a restart
    // and log the attempt — the existing TURN servers should relay
    this._pc.restartIce();
    this._triggerRenegotiation();
};

// ── Trigger renegotiation after ICE restart ─────────────────
AIAssistant.prototype._triggerRenegotiation = async function() {
    if (!this._pc || !this._renegoCh || this._renegoLock) return;
    this._renegoLock = true;
    try {
        const o = await this._pc.createOffer({ iceRestart: true });
        await this._pc.setLocalDescription(o);
        this._renegoCh.send({type:'broadcast',event:'ro',payload:{offer:o,sid:this.userId}}).catch(()=>{});
    } catch(e) { this._renegoLock = false; console.warn('[RENEGO] restart offer err:', e); }
};

// ── ADAPTIVE BITRATE MONITOR ────────────────────────────────
AIAssistant.prototype._startBitrateMonitor = function() {
    if (this._bitrateTimer) clearInterval(this._bitrateTimer);
    let _prevBytesSent = 0, _prevTimestamp = 0;
    this._bitrateTimer = setInterval(async () => {
        if (!this._pc || this._pc.connectionState !== 'connected') {
            clearInterval(this._bitrateTimer); this._bitrateTimer = null; return;
        }
        try {
            const stats = await this._pc.getStats();
            for (const [, report] of stats) {
                if (report.type === 'outbound-rtp' && report.kind === 'video') {
                    if (_prevTimestamp > 0) {
                        const bitrate = 8 * (report.bytesSent - _prevBytesSent) / (report.timestamp - _prevTimestamp) * 1000;
                        // If bitrate drops below 100kbps and we're screen sharing, reduce resolution
                        if (bitrate < 100_000 && this._isScreenSharing) {
                            const sender = this._pc.getSenders().find(s => s.track?.kind === 'video');
                            if (sender) {
                                const params = sender.getParameters();
                                if (params.encodings?.[0]) {
                                    params.encodings[0].maxBitrate = Math.max(500_000, (params.encodings[0].maxBitrate || 2_500_000) * 0.7);
                                    params.encodings[0].scaleResolutionDownBy = Math.min(4, (params.encodings[0].scaleResolutionDownBy || 1) * 1.2);
                                    await sender.setParameters(params);
                                }
                            }
                        }
                        // If bitrate is good and we reduced quality, restore it
                        else if (bitrate > 500_000 && this._isScreenSharing) {
                            const sender = this._pc.getSenders().find(s => s.track?.kind === 'video');
                            if (sender) {
                                const params = sender.getParameters();
                                if (params.encodings?.[0]?.scaleResolutionDownBy > 1) {
                                    params.encodings[0].maxBitrate = 2_500_000;
                                    params.encodings[0].scaleResolutionDownBy = 1;
                                    await sender.setParameters(params);
                                }
                            }
                        }
                    }
                    _prevBytesSent = report.bytesSent;
                    _prevTimestamp = report.timestamp;
                }
            }
        } catch(_) {}
    }, 5000);
};

// ── TURN CREDENTIAL REFRESH (prevents 1hr expiry drop) ──────
// Metered.ca tokens expire after 60 min. At 45 min we silently fetch
// fresh credentials, update the live PeerConnection, and restart ICE
// so the relay stays open with zero interruption to the screen share.
AIAssistant.prototype._startCredentialRefresh = function() {
    if (this._credRefreshTimer) clearTimeout(this._credRefreshTimer);
    this._credRefreshTimer = setTimeout(async () => {
        if (!this._pc || !this._callId) return;
        console.log('[ICE] Refreshing TURN credentials before 1hr expiry...');
        try {
            const r = await fetch('https://voidzen_ai.metered.live/api/v1/turn/credentials?apiKey=c6ebad70334072baa1f086fcd5884ccf7921');
            if (r.ok) {
                const servers = await r.json();
                if (Array.isArray(servers) && servers.length > 0) {
                    const dynamic = servers.map(s => ({ urls: s.urls || s.url, username: s.username, credential: s.credential }));
                    const newConfig = { ..._ICE_BASE, iceServers: [..._ICE_BASE.iceServers, ...dynamic] };
                    _ICE = newConfig;
                    _iceLastFetch = Date.now();
                    // Hot-swap credentials into the live PeerConnection
                    try { this._pc.setConfiguration(newConfig); } catch(_) {}
                    // Restart ICE so the relay uses the new tokens
                    this._pc.restartIce();
                    this._triggerRenegotiation();
                    console.log('[ICE] Credentials refreshed silently, ICE restarted');
                }
            }
        } catch(e) { console.warn('[ICE] Credential refresh failed:', e); }
        // Schedule next refresh again (for calls longer than 1.5 hours)
        this._startCredentialRefresh();
    }, 45 * 60 * 1000); // 45 minutes
};

// ── SETUP RC DATA CHANNEL ───────────────────────────────────
AIAssistant.prototype._setupRcDataChannel = function(ch) {
    ch.onopen = () => {
        console.log('[DC] remote control channel open');
        this._rcDataChannelReady = true;
    };
    ch.onclose = () => {
        console.log('[DC] remote control channel closed');
        this._rcDataChannelReady = false;
    };
    ch.onerror = (e) => console.warn('[DC] error:', e);
    ch.onmessage = (ev) => {
        try {
            const p = JSON.parse(ev.data);
            if (p.uid !== this.userId) this._handleRemoteControlEvent(p);
        } catch(_) {}
    };
};

// ── VIDEO SENDER HELPER ──────────────────────────────────────
AIAssistant.prototype._vidSender = function() {
    if (!this._pc) return null;
    let s = this._pc.getSenders().find(x => x.track?.kind === 'video');
    if (s) return s;
    const tc = this._pc.getTransceivers().find(t => (t.receiver?.track?.kind==='video' && (!t.sender.track||t.sender.track.readyState==='ended')) || t.sender.track===null);
    if (tc) { if(tc.direction==='recvonly'||tc.direction==='inactive') tc.direction='sendrecv'; return tc.sender; }
    return null;
};

// ── MEDIA HELPER ─────────────────────────────────────────────
AIAssistant.prototype._getMedia = function(type) {
    // autoGainControl OFF for voice: prevents mic amplifying speaker echo into a feedback loop
    // autoGainControl ON for video: better quality when using headset/camera
    const voiceAudio = { echoCancellation:true, noiseSuppression:true, autoGainControl:false, channelCount:1 };
    const videoAudio = { echoCancellation:true, noiseSuppression:true, autoGainControl:true,  channelCount:1 };
    return type === 'video'
        ? navigator.mediaDevices.getUserMedia({ audio:videoAudio, video:{ width:{ideal:1280}, height:{ideal:720}, frameRate:{ideal:30}, facingMode:'user' } })
        : navigator.mediaDevices.getUserMedia({ audio:voiceAudio, video:false });
};

// ── SAFE DB WRITE (Supabase thenable ≠ full Promise — use async wrapper) ─────
function _dbw(promise) { (async()=>{ try{ await promise; }catch(_){} })(); }

// ── POLLING HELPERS (primary reliability — no Supabase realtime needed) ─────
// Called by CALLER after offer sent: polls every 500ms for answer
AIAssistant.prototype._pollForAnswer = function() {
    if (this._pollTimer) clearInterval(this._pollTimer);
    this._pollTimer = setInterval(async () => {
        if (!this._callId || !this._pc) { clearInterval(this._pollTimer); this._pollTimer=null; return; }
        try {
            const {data} = await this.supabase.from('calls').select('status,answer,call_type').eq('id',this._callId).single();
            if (!data) return;
            if (data.status==='rejected') { clearInterval(this._pollTimer); this._pollTimer=null; this.showNotification('Call','Declined.'); this._endLocal(); return; }
            if (data.status==='ended')    { clearInterval(this._pollTimer); this._pollTimer=null; this._endLocal('Call ended'); return; }
            if (data.answer && this._pc && !this._pc.remoteDescription) {
                clearInterval(this._pollTimer); this._pollTimer=null;
                try {
                    await this._pc.setRemoteDescription(new RTCSessionDescription(data.answer));
                    if(this._el.statusText) this._el.statusText.textContent='Connected';
                    this._startCallTimer(); this._setupRenego(true); this._setupBroadcast();
                    this._pollForEnd();
                } catch(e) { console.warn('[CALL] poll-answer err:',e); }
            }
            if (data.call_type==='video' && this._callType!=='video') this._upgradeToVideo();
        } catch(_) {}
    }, 500);
};

// Called by BOTH sides once connected: polls every 1s for status='ended'
// Uses separate _endPollTimer so it doesn't conflict with _pollForAnswer
AIAssistant.prototype._pollForEnd = function() {
    if (this._endPollTimer) clearInterval(this._endPollTimer);
    this._endPollTimer = setInterval(async () => {
        if (!this._callId) { clearInterval(this._endPollTimer); this._endPollTimer=null; return; }
        try {
            const {data} = await this.supabase.from('calls').select('status,call_type').eq('id',this._callId).single();
            if (!data) return;
            if (data.status==='ended') { clearInterval(this._endPollTimer); this._endPollTimer=null; this._endLocal('Call ended'); return; }
            if (data.call_type==='video' && this._callType!=='video') this._upgradeToVideo();
        } catch(_) {}
    }, 500);
};

// Poll for new ICE candidates from the other side every 300ms
AIAssistant.prototype._pollForCandidates = function() {
    if (this._candTimer) clearInterval(this._candTimer);
    let _since = new Date().toISOString();
    this._candTimer = setInterval(async () => {
        if (!this._callId || !this._pc) { clearInterval(this._candTimer); this._candTimer=null; return; }
        try {
            const {data} = await this.supabase.from('call_candidates')
                .select('candidate,created_at').eq('call_id',this._callId).neq('sender_id',this.userId)
                .gt('created_at',_since).order('created_at',{ascending:true});
            if (data?.length) {
                _since = data[data.length-1].created_at;
                for (const c of data) { try{await this._pc.addIceCandidate(new RTCIceCandidate(c.candidate));}catch(_){} }
            }
        } catch(_) {}
    }, 300);
};

// Poll for incoming ringing calls (hard fallback if broadcast ring fails)
AIAssistant.prototype._pollForIncoming = function() {
    if (this._incTimer) return; // already polling
    this._incTimer = setInterval(async () => {
        if (this._callId || this._incomingCall) return; // busy
        try {
            const {data} = await this.supabase.from('calls').select('*')
                .eq('callee_id',this.userId).eq('status','ringing')
                .order('created_at',{ascending:false}).limit(1).single();
            if (data && !this._incomingCall && !this._callId) this._showIncoming(data);
        } catch(_) {}
    }, 3000);
};

// ── START CALL ───────────────────────────────────────────────
AIAssistant.prototype.callStart = async function(callType) {
    if (!this.dcActiveChatUser?.id) { this.showNotification('Error','Open a DM chat first.'); return; }
    if (this._callId) { this.showNotification('Error','Already in a call.'); return; }
    this._callType = callType;
    try {
        // Refresh ICE servers before starting (fetches dynamic TURN if available)
        await _refreshICE();
        if (this._el.remoteAudio) { this._el.remoteAudio.muted = false; this._el.remoteAudio.play().catch(()=>{}); }
        this._ls = await this._getMedia(callType);
        this._makePc();
        this._ls.getTracks().forEach(t => this._pc.addTrack(t, this._ls));

        // Create DataChannel for low-latency remote control
        this._rcDataChannel = this._pc.createDataChannel('rc', { ordered: false, maxRetransmits: 0 });
        this._setupRcDataChannel(this._rcDataChannel);
        if (this._el.localVideo) { this._el.localVideo.srcObject=this._ls; this._el.localVideo.style.display=callType==='video'?'block':'none'; }

        // Buffer ICE candidates until callId is known
        const _iceBuf = [];
        this._pc.onicecandidate = e => { if (e.candidate) _iceBuf.push(e.candidate.toJSON()); };

        const offer = await this._pc.createOffer();
        await this._pc.setLocalDescription(offer);

        const resp = await fetch('/api/start-call', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({callerId:this.userId,calleeId:this.dcActiveChatUser.id,callType,offer:{type:offer.type,sdp:offer.sdp}})});
        const result = await resp.json();
        if (!result.success) throw new Error(result.error||'Failed to create call');
        this._callId = result.callId; this._isCaller = true; this._callPeerId = this.dcActiveChatUser.id;

        // ── ICE: send buffered + future candidates via DB (always works) ──────────
        const _sendIce = c => {
            if (!this._callId) return;
            _dbw(this.supabase.from('call_candidates').insert({call_id:this._callId,sender_id:this.userId,candidate:c}));
            if (this._sigCh) this._sigCh.send({type:'broadcast',event:'ice',payload:{c,sid:this.userId}}).then(null,()=>{}); // speed bonus
        };
        this._pc.onicecandidate = e => { if (e.candidate) _sendIce(e.candidate.toJSON()); };
        _iceBuf.forEach(c => _sendIce(c)); // flush buffer immediately

        // ── PRIMARY: poll every 1s for answer + poll every 500ms for ICE ─────────
        this._pollForAnswer();
        this._pollForCandidates();

        // ── BROADCAST ring to callee (speed bonus — works if realtime is enabled) ─
        const calleeId = this.dcActiveChatUser.id;
        const callData = {id:this._callId,caller_id:this.userId,callee_id:calleeId,call_type:callType,status:'ringing',offer:{type:offer.type,sdp:offer.sdp}};
        const _ringCh = this.supabase.channel(`ic-${calleeId}`);
        _ringCh.subscribe(s => {
            if (s==='SUBSCRIBED') {
                _ringCh.send({type:'broadcast',event:'ring',payload:{call:callData}}).catch(()=>{});
                setTimeout(() => { try{this.supabase.removeChannel(_ringCh);}catch(_){} }, 5000);
            }
        });

        // ── BROADCAST sig channel — speed bonus for answer + end ─────────────────
        this._sigCh = this.supabase.channel(`sig-${this._callId}`)
            .on('broadcast',{event:'ice'},    ({payload:p}) => { if(p.sid!==this.userId&&this._pc) this._pc.addIceCandidate(new RTCIceCandidate(p.c)).catch(()=>{}); })
            .on('broadcast',{event:'answer'}, async ({payload:p}) => {
                if (!p?.answer||!this._pc||this._pc.remoteDescription) return;
                try { await this._pc.setRemoteDescription(new RTCSessionDescription(p.answer)); if(this._el.statusText)this._el.statusText.textContent='Connected'; this._startCallTimer();this._setupRenego(true);this._setupBroadcast();this._pollForEnd(); } catch(e){}
            })
            .on('broadcast',{event:'end'},    () => { this._endLocal('Call ended'); })
            .subscribe();

        this._callShowOverlay(callType, this.dcActiveChatUser.name, false);
    } catch(err) {
        console.error('[CALL] start err:', err);
        this.showNotification('Call Failed', err.message?.includes('NotAllowed')?'Mic/camera denied':err.message||'Error');
        this._endLocal();
    }
};

// ── ACCEPT CALL ──────────────────────────────────────────────
AIAssistant.prototype.callAccept = async function() {
    if (!this._incomingCall) return;
    this._stopRingtone();
    const call = this._incomingCall; this._incomingCall = null;
    if (this._el.incomingModal) this._el.incomingModal.style.display = 'none';
    if (this._incomingWatchSub) { this.supabase.removeChannel(this._incomingWatchSub); this._incomingWatchSub=null; }
    this._callType = call.call_type;
    this._callId = call.id;
    this._isCaller = false;
    this._callPeerId = call.caller_id;
    try {
        await _refreshICE();
        if (this._el.remoteAudio) { this._el.remoteAudio.muted = false; this._el.remoteAudio.play().catch(()=>{}); }
        this._ls = await this._getMedia(call.call_type);
        this._makePc();
        this._ls.getTracks().forEach(t => this._pc.addTrack(t, this._ls));
        if (this._el.localVideo) { this._el.localVideo.srcObject=this._ls; this._el.localVideo.style.display=call.call_type==='video'?'block':'none'; }

        // ── ICE sending: DB insert always + broadcast as speed bonus ──────────────
        const _sendIce = c => {
            if (!this._callId) return;
            _dbw(this.supabase.from('call_candidates').insert({call_id:this._callId,sender_id:this.userId,candidate:c}));
            if (this._sigCh) this._sigCh.send({type:'broadcast',event:'ice',payload:{c,sid:this.userId}}).then(null,()=>{});
        };
        this._pc.onicecandidate = e => { if (e.candidate) _sendIce(e.candidate.toJSON()); };

        await this._pc.setRemoteDescription(new RTCSessionDescription(call.offer));
        const answer = await this._pc.createAnswer();
        await this._pc.setLocalDescription(answer); // ICE gathering starts here

        // Fetch caller's ICE candidates already in DB
        const {data:ec} = await this.supabase.from('call_candidates').select('candidate').eq('call_id',this._callId).neq('sender_id',this.userId);
        if (ec) for (const c of ec) { try{await this._pc.addIceCandidate(new RTCIceCandidate(c.candidate));}catch(_){} }

        // Write answer to DB — this is what the caller's poll will find
        await this.supabase.from('calls').update({answer:{type:answer.type,sdp:answer.sdp},status:'active'}).eq('id',call.id);

        // ── BROADCAST sig channel — speed bonus: fast answer + ICE + end ─────────
        this._sigCh = this.supabase.channel(`sig-${this._callId}`)
            .on('broadcast',{event:'ice'}, ({payload:p}) => { if(p.sid!==this.userId&&this._pc) this._pc.addIceCandidate(new RTCIceCandidate(p.c)).catch(()=>{}); })
            .on('broadcast',{event:'end'}, () => { this._endLocal('Call ended'); })
            .subscribe(s => {
                if (s==='SUBSCRIBED') {
                    // Send answer via broadcast now that channel is confirmed ready
                    const _ans = {type:answer.type,sdp:answer.sdp};
                    this._sigCh.send({type:'broadcast',event:'answer',payload:{answer:_ans}}).then(null,()=>{});
                    setTimeout(()=>this._sigCh?.send({type:'broadcast',event:'answer',payload:{answer:_ans}}).then(null,()=>{}), 800);
                }
            });

        // ── PRIMARY: poll every 2s for call ended ─────────────────────────────────
        this._pollForEnd();
        // ── PRIMARY: poll every 500ms for new ICE from caller ────────────────────
        this._pollForCandidates();

        const callerLabel = this._el.callerName?.textContent||'User';
        this._callShowOverlay(call.call_type, callerLabel, true);
        this._startCallTimer(); this._setupRenego(false); this._setupBroadcast();
    } catch(err) {
        console.error('[CALL] accept err:', err);
        this.showNotification('Error','Could not accept: '+(err.message||'Check mic'));
        this._endLocal();
    }
};

// ── REJECT / HANGUP ──────────────────────────────────────────
AIAssistant.prototype.callReject = async function() {
    if (!this._incomingCall) return;
    this._stopRingtone();
    const id = this._incomingCall.id; this._incomingCall = null;
    if (this._el.incomingModal) this._el.incomingModal.style.display = 'none';
    if (this._incomingWatchSub) { this.supabase.removeChannel(this._incomingWatchSub); this._incomingWatchSub=null; }
    await this.supabase.from('calls').update({status:'rejected'}).eq('id',id);
};

AIAssistant.prototype.callHangup = function() {
    const id = this._callId;
    const peerId = this._callPeerId;
    // Detach sigCh from _endLocal FIRST so _endLocal won't remove it before broadcast delivers
    const sigCh = this._sigCh;
    this._sigCh = null;
    this._endLocal('You ended the call');
    if (!id) return;

    // ── DB update: server-side (supabaseAdmin, bypasses RLS) ─────────────────
    fetch('/api/end-call',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({callId:id})}).catch(()=>{});
    // ── DB update: client-side backup ────────────────────────────────────────
    _dbw(this.supabase.from('calls').update({status:'ended'}).eq('id',id));

    // ── Broadcast on peer's ic- channel (PRIMARY delivery to other side) ─────
    // The peer is ALWAYS subscribed to ic-{peerId} — more reliable than sigCh
    if (peerId) {
        const _endCh = this.supabase.channel(`ic-${peerId}`);
        _endCh.subscribe(s => {
            if (s === 'SUBSCRIBED') {
                _endCh.send({type:'broadcast',event:'end',payload:{callId:id}}).then(null,()=>{});
                // Retry multiple times to ensure delivery
                setTimeout(() => { _endCh.send({type:'broadcast',event:'end',payload:{callId:id}}).then(null,()=>{}); }, 500);
                setTimeout(() => { _endCh.send({type:'broadcast',event:'end',payload:{callId:id}}).then(null,()=>{}); }, 1500);
                setTimeout(() => { _endCh.send({type:'broadcast',event:'end',payload:{callId:id}}).then(null,()=>{}); }, 3000);
                setTimeout(() => { try{this.supabase.removeChannel(_endCh);}catch(_){} }, 5000);
            }
        });
    }

    // ── Broadcast on sig channel (SPEED BONUS — may already be subscribed) ──
    if (sigCh) {
        sigCh.send({type:'broadcast',event:'end',payload:{sid:this.userId}}).then(null,()=>{});
        setTimeout(() => { try{this.supabase.removeChannel(sigCh);}catch(_){} }, 4000);
    }
};

// ── LOCAL CLEANUP ────────────────────────────────────────────
AIAssistant.prototype._endLocal = function(reason) {
    this._stopRingtone();
    if (!this._callId && !this._pc && !this._ls) { if(this._el.overlay) this._el.overlay.style.display='none'; return; }
    console.log('[CALL] _endLocal:', reason);
    if (this._callTimer)    { clearInterval(this._callTimer);    this._callTimer=null;    } this._callStartTime=null;
    if (this._pollTimer)    { clearInterval(this._pollTimer);    this._pollTimer=null;    }
    if (this._endPollTimer) { clearInterval(this._endPollTimer); this._endPollTimer=null; }
    if (this._candTimer)    { clearInterval(this._candTimer);    this._candTimer=null;    }
    // _incTimer stays alive — keeps watching for new incoming calls even after a call ends
    if (this._dcTimeout)    { clearTimeout(this._dcTimeout);     this._dcTimeout=null;    }
    if (this._bgEndTimer)   { clearTimeout(this._bgEndTimer);    this._bgEndTimer=null;   }
    this._iceRestarted = false;
    if (this._bitrateTimer)    { clearInterval(this._bitrateTimer);    this._bitrateTimer = null; }
    if (this._credRefreshTimer){ clearTimeout(this._credRefreshTimer); this._credRefreshTimer = null; }
    if (this._rcDataChannel) { try{this._rcDataChannel.close();}catch(_){} this._rcDataChannel=null; this._rcDataChannelReady=false; }
    if (this._screenStream) { this._screenStream.getTracks().forEach(t=>t.stop()); this._screenStream=null; }
    if (this._ls) { this._ls.getTracks().forEach(t=>t.stop()); this._ls=null; }
    if (this._pc) { this._pc.ontrack=null; this._pc.onconnectionstatechange=null; this._pc.oniceconnectionstatechange=null; this._pc.onicegatheringstatechange=null; this._pc.onsignalingstatechange=null; this._pc.onnegotiationneeded=null; this._pc.onicecandidate=null; this._pc.ondatachannel=null; this._pc.close(); this._pc=null; }
    if (this._callSub) { this.supabase.removeChannel(this._callSub); this._callSub=null; }
    if (this._candSub) { this.supabase.removeChannel(this._candSub); this._candSub=null; }
    if (this._renegoCh){ this.supabase.removeChannel(this._renegoCh);this._renegoCh=null; }
    if (this._stateCh) { this.supabase.removeChannel(this._stateCh); this._stateCh=null; }
    if (this._sigCh)   { this.supabase.removeChannel(this._sigCh);   this._sigCh=null; }
    if (this._incomingWatchSub) { this.supabase.removeChannel(this._incomingWatchSub); this._incomingWatchSub=null; }
    if (this._el.localVideo)  this._el.localVideo.srcObject  = null;
    if (this._el.remoteVideo) this._el.remoteVideo.srcObject = null;
    if (this._el.remoteAudio) { this._el.remoteAudio.srcObject = null; this._el.remoteAudio.pause(); }
    if (this._el.incomingModal) this._el.incomingModal.style.display = 'none';
    if (this._el.overlay && (this._el.overlay.style.display==='flex' || this._el.overlay.style.display==='block')) {
        if(this._el.statusText) this._el.statusText.textContent = reason||'Call ended';
        if(this._el.callTimer)  this._el.callTimer.style.display = 'none';
        setTimeout(()=>{ if(this._el.overlay) this._el.overlay.style.display='none'; }, 1500);
    }
    this._callId=null; this._callPeerId=null; this._isMuted=false; this._isVideoOff=false; this._isScreenSharing=false;
    this._renegoLock=false; this._facingMode='user'; this._callType='voice'; this._savedCamTrack=null;
    // Clean up remote control
    if(this._rcActive||this._rcBeingControlled) this.callStopRemoteControl();
    this._rcActive=false; this._rcBeingControlled=false; this._rcPeerScreening=false;
    if(this._el.remoteControlBtn) this._el.remoteControlBtn.style.display='none';
    if(this._el.rcModal) this._el.rcModal.style.display='none';
    if(this._el.rcStatus) this._el.rcStatus.style.display='none';
    if(this._el.rcCursor) this._el.rcCursor.style.display='none';
    if(this._el.videoContainer) this._el.videoContainer.classList.remove('rc-controlling');
    // Exit fullscreen if active
    const _fsEl = document.fullscreenElement || document.webkitFullscreenElement;
    if(_fsEl) (document.exitFullscreen || document.webkitExitFullscreen).call(document).catch(()=>{});
    // Hide connection badge
    const _badge = document.getElementById('webrtcConnBadge');
    if(_badge) _badge.style.display = 'none';
    if(this._el.muteBtn){this._el.muteBtn.textContent='🎤';this._el.muteBtn.style.background='#374151';}
    if(this._el.videoToggleBtn){this._el.videoToggleBtn.textContent='📹';this._el.videoToggleBtn.style.background='#374151';}
    if(this._el.screenShareBtn){this._el.screenShareBtn.textContent='🖥️';this._el.screenShareBtn.style.background='#374151';}
    if(this._el.remoteMuteIndicator) this._el.remoteMuteIndicator.style.display='none';
};

// ── OVERLAY ──────────────────────────────────────────────────
AIAssistant.prototype._callShowOverlay = function(type, name, isCallee) {
    if (!this._el.overlay) return;
    if (this._el.overlayAvatar) { this._el.overlayAvatar.textContent=(name||'U')[0].toUpperCase(); this._el.overlayAvatar.style.display='flex'; }
    if (this._el.overlayName) this._el.overlayName.textContent = name||'User';
    if (this._el.statusText)  this._el.statusText.textContent  = isCallee?'Connecting…':`Calling ${name}…`;
    if (this._el.videoContainer)   this._el.videoContainer.style.display   = type==='video'?'block':'none';
    // toggleVideoBtn: icon-only, shown only in video calls; switchToVideoBtn shown in voice calls
    if (this._el.videoToggleBtn)   this._el.videoToggleBtn.style.display   = type==='video'?'flex':'none';
    if (this._el.switchToVideoBtn) this._el.switchToVideoBtn.style.display = type==='video'?'none':'flex';
    if (this._el.callTimer) { this._el.callTimer.textContent='0:00'; this._el.callTimer.style.display='none'; }
    this._el.overlay.style.display = 'block'; // block so it stacks vertically
};

// ── TIMER ────────────────────────────────────────────────────
AIAssistant.prototype._startCallTimer = function() {
    if (this._callTimer) return;
    this._callStartTime = Date.now();
    if (this._el.callTimer) this._el.callTimer.style.display = 'block';
    this._callTimer = setInterval(() => {
        const s = Math.floor((Date.now()-this._callStartTime)/1000);
        const str = Math.floor(s/3600)>0 ? `${Math.floor(s/3600)}:${String(Math.floor((s%3600)/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}` : `${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`;
        if(this._el.callTimer) this._el.callTimer.textContent = str;
    }, 1000);
};

// ── BROADCAST (mute/video/screen sync) ───────────────────────
AIAssistant.prototype._setupBroadcast = function() {
    if (!this._callId) return;
    if (this._stateCh) this.supabase.removeChannel(this._stateCh);
    this._stateCh = this.supabase.channel(`cs-${this._callId}`)
        .on('broadcast',{event:'cs'}, ({payload:p}) => {
            if(!p||p.uid===this.userId) return;
            if(this._el.remoteMuteIndicator) this._el.remoteMuteIndicator.style.display = p.muted?'block':'none';
            if(p.vidOff!==undefined && this._callType==='video' && this._el.overlayAvatar) this._el.overlayAvatar.style.display=p.vidOff?'flex':'none';
            if(p.screen) {
                this._rcPeerScreening = true;
                if(this._el.videoContainer) this._el.videoContainer.style.display='block';
                if(this._el.overlayAvatar)  this._el.overlayAvatar.style.display='none';
                if(this._el.remoteControlBtn) this._el.remoteControlBtn.style.display='flex';
                // Refresh the video element: re-attach srcObject to force render pipeline reset
                // This prevents black screen when remote switches from camera to screen share
                const rv = this._el.remoteVideo;
                if(rv) {
                    const doRefresh = () => {
                        const src = rv.srcObject;
                        if (src) {
                            // Check if video tracks are active
                            const vTracks = src.getVideoTracks();
                            console.log('[SCREEN-RX] refresh - tracks:', vTracks.length, vTracks.map(t => `enabled:${t.enabled} state:${t.readyState}`).join(', '));
                            rv.srcObject = null;
                            rv.srcObject = src;
                            rv.play().catch(()=>{});
                        }
                    };
                    doRefresh();
                    setTimeout(doRefresh, 300);
                    setTimeout(doRefresh, 800);
                    setTimeout(doRefresh, 1500);
                    setTimeout(doRefresh, 3000);
                    setTimeout(doRefresh, 5000);
                }
            }
            if(p.screenOff) {
                this._rcPeerScreening = false;
                // Hide remote control button and stop any active remote control
                if(this._el.remoteControlBtn) this._el.remoteControlBtn.style.display='none';
                if(this._rcActive) this.callStopRemoteControl();
                if(this._callType!=='video') { if(this._el.videoContainer)this._el.videoContainer.style.display='none'; if(this._el.overlayAvatar)this._el.overlayAvatar.style.display='flex'; }
                // Restore camera view
                const rv2 = this._el.remoteVideo;
                if(rv2) { const src=rv2.srcObject; if(src){rv2.srcObject=null;rv2.srcObject=src;} rv2.play().catch(()=>{}); }
            }
            if(p.toVideo && this._callType!=='video') this._upgradeToVideo();

            // ── Remote control signaling ──
            if(p.rcRequest) {
                // Someone is requesting to control our screen
                this._rcRequesterUid = p.uid;
                this._rcRequesterName = this._el.overlayName?.textContent || 'User';
                if(this._el.rcModalText) this._el.rcModalText.textContent = `${this._rcRequesterName} wants to control your screen`;
                if(this._el.rcModal) this._el.rcModal.style.display = 'block';
            }
            if(p.rcAccepted) {
                // Our request was accepted — start sending mouse/keyboard events
                this._startRemoteControlSending();
            }
            if(p.rcDenied) {
                if(this._el.remoteControlBtn) {
                    this._el.remoteControlBtn.textContent = '🖱️';
                    this._el.remoteControlBtn.style.background = 'rgba(0,0,0,0.6)';
                }
                this.showNotification('Remote Control', 'Request denied.');
            }
            if(p.rcStopped) {
                this.callStopRemoteControl();
                this.showNotification('Remote Control', 'Remote control ended.');
            }
        })
        .on('broadcast',{event:'rc'}, ({payload:p}) => {
            // Receive remote control mouse/keyboard events
            if(!p||p.uid===this.userId) return;
            this._handleRemoteControlEvent(p);
        })
        .subscribe();
};
AIAssistant.prototype._bcast = function(extra) {
    if(!this._stateCh) return;
    this._stateCh.send({type:'broadcast',event:'cs',payload:{uid:this.userId,muted:this._isMuted,vidOff:this._isVideoOff,screen:this._isScreenSharing,...(extra||{})}}).catch(()=>{});
};

// ── TOGGLE MUTE ──────────────────────────────────────────────
AIAssistant.prototype.callToggleMute = function() {
    if(!this._ls) return;
    this._isMuted = !this._isMuted;
    this._ls.getAudioTracks().forEach(t=>{t.enabled=!this._isMuted;});
    if(this._el.muteBtn){this._el.muteBtn.textContent=this._isMuted?'🔇':'🎤';this._el.muteBtn.style.background=this._isMuted?'#ef4444':'#374151';}
    this._bcast();
};

// ── TOGGLE VIDEO ─────────────────────────────────────────────
AIAssistant.prototype.callToggleVideo = function() {
    if(!this._ls) return;
    this._isVideoOff = !this._isVideoOff;
    this._ls.getVideoTracks().forEach(t=>{t.enabled=!this._isVideoOff;});
    if(this._el.videoToggleBtn){this._el.videoToggleBtn.textContent=this._isVideoOff?'▶️':'📹';this._el.videoToggleBtn.style.background=this._isVideoOff?'#ef4444':'#374151';}
    if(this._el.localVideo) this._el.localVideo.style.display = this._isVideoOff?'none':'block';
    this._bcast();
};

// ── SWITCH TO VIDEO ──────────────────────────────────────────
AIAssistant.prototype.callSwitchToVideo = async function() {
    if(!this._pc||!this._callId) return;
    try {
        const vs = await navigator.mediaDevices.getUserMedia({video:{width:{ideal:1280},height:{ideal:720},frameRate:{ideal:30},facingMode:'user'}});
        const vt = vs.getVideoTracks()[0]; if(!vt) throw new Error('No camera');
        if(this._ls){this._ls.getVideoTracks().forEach(o=>{this._ls.removeTrack(o);o.stop();}); this._ls.addTrack(vt);} else this._ls=vs;
        const s=this._vidSender(); if(s) await s.replaceTrack(vt); else this._pc.addTrack(vt,this._ls);
        if(this._el.localVideo){this._el.localVideo.srcObject=this._ls;this._el.localVideo.style.display='block';}
        if(this._el.videoContainer) this._el.videoContainer.style.display='block';
        if(this._el.overlayAvatar) this._el.overlayAvatar.style.display='none';
        if(this._el.videoToggleBtn) this._el.videoToggleBtn.style.display='flex';
        if(this._el.switchToVideoBtn) this._el.switchToVideoBtn.style.display='none';
        this._callType='video'; this._isVideoOff=false;
        await this.supabase.from('calls').update({call_type:'video'}).eq('id',this._callId);
        this._bcast({toVideo:true});
    } catch(err) { this.showNotification('Error','Could not enable camera: '+err.message); }
};

AIAssistant.prototype._upgradeToVideo = function() {
    this._callType='video';
    if(this._el.videoContainer) this._el.videoContainer.style.display='block';
    if(this._el.overlayAvatar)  this._el.overlayAvatar.style.display='none';
    if(this._el.videoToggleBtn) this._el.videoToggleBtn.style.display='flex';
    if(this._el.switchToVideoBtn) this._el.switchToVideoBtn.style.display='none';
    // Auto get camera
    navigator.mediaDevices.getUserMedia({video:{width:{ideal:1280},height:{ideal:720},frameRate:{ideal:30},facingMode:'user'}}).then(vs => {
        const vt=vs.getVideoTracks()[0]; if(!vt) return;
        if(this._ls){this._ls.getVideoTracks().forEach(o=>{this._ls.removeTrack(o);o.stop();}); this._ls.addTrack(vt);} else this._ls=vs;
        const s=this._vidSender(); if(s) s.replaceTrack(vt).catch(()=>{}); else if(this._pc) this._pc.addTrack(vt,this._ls);
        if(this._el.localVideo){this._el.localVideo.srcObject=this._ls;this._el.localVideo.style.display='block';}
        this._isVideoOff=false; this._bcast();
    }).catch(e => console.warn('[CALL] auto-video fail:', e.message));
};

// ── SCREEN SHARE ─────────────────────────────────────────────
AIAssistant.prototype.callShareScreen = async function() {
    if(!this._pc||!this._callId) { this.showNotification('Screen Share','No active call.'); return; }
    if(!navigator.mediaDevices?.getDisplayMedia) { this.showNotification('Screen Share','Not supported in this browser.'); return; }
    if(this._isScreenSharing) { this._stopScreen(); return; }
    try {
        // Cross-browser getDisplayMedia options — Firefox doesn't support all constraints
        const displayOpts = { video: { cursor: 'always' }, audio: false };
        // Chrome/Edge: add resolution + framerate hints
        if (navigator.userAgent.includes('Chrome') || navigator.userAgent.includes('Edg')) {
            displayOpts.video = { cursor: 'always', width: { ideal: 1920 }, height: { ideal: 1080 }, frameRate: { ideal: 30, max: 30 } };
        }
        const ss = await navigator.mediaDevices.getDisplayMedia(displayOpts);
        const st = ss.getVideoTracks()[0]; if(!st) throw new Error('No screen track');
        console.log('[SCREEN] track:', st.label, 'settings:', JSON.stringify(st.getSettings()));
        this._savedCamTrack = this._ls?.getVideoTracks()[0] || null;

        const sender = this._vidSender();
        if (sender) {
            // Video call — replace camera with screen (no renegotiation needed)
            await sender.replaceTrack(st);
            // Boost bitrate for screen share so remote viewer gets a sharp, readable image
            try {
                const params = sender.getParameters();
                if (!params.encodings || params.encodings.length === 0) params.encodings = [{}];
                params.encodings[0].maxBitrate = 4_000_000; // 4 Mbps for screen share (text readability)
                params.encodings[0].maxFramerate = 30;
                // Content hint tells encoder to optimize for detail (text) over motion
                st.contentHint = 'detail';
                await sender.setParameters(params);
            } catch(e) { console.warn('[SCREEN] setParameters:', e); }
        } else {
            // Voice call — add new video track (triggers renegotiation via onnegotiationneeded)
            st.contentHint = 'detail';
            this._pc.addTrack(st, ss);
        }

        this._screenStream = ss;
        this._isScreenSharing = true;

        // Show local preview of the screen being shared
        if(this._el.localVideo) {
            this._el.localVideo.srcObject = new MediaStream([st]);
            this._el.localVideo.style.display = 'block';
            this._el.localVideo.play().catch(()=>{});
        }
        if(this._el.screenShareBtn) { this._el.screenShareBtn.textContent='⏹️'; this._el.screenShareBtn.style.background='#ef4444'; }
        if(this._el.videoContainer) this._el.videoContainer.style.display='block';
        if(this._el.overlayAvatar)  this._el.overlayAvatar.style.display='none';

        // Tell the other side to refresh their video element.
        setTimeout(() => this._bcast(), 200);
        setTimeout(() => this._bcast(), 800);
        setTimeout(() => this._bcast(), 2000);
        setTimeout(() => this._bcast(), 4000);

        st.onended = () => this._stopScreen();
    } catch(err) {
        if (err.name === 'NotAllowedError' || err.name === 'AbortError') return; // user cancelled
        this.showNotification('Screen Share Error', err.message || err.name || 'Unknown error');
        console.error('[SCREEN]', err);
    }
};

AIAssistant.prototype._stopScreen = async function() {
    if(!this._isScreenSharing) return;
    this._isScreenSharing=false;
    if(this._screenStream){this._screenStream.getTracks().forEach(t=>t.stop());this._screenStream=null;}
    if(this._el.screenShareBtn){this._el.screenShareBtn.textContent='🖥️';this._el.screenShareBtn.style.background='#374151';}
    if(this._pc) {
        const s = this._pc.getSenders().find(x=>x.track===null||x.track?.kind==='video'||x.track?.readyState==='ended');
        if(s) {
            if(this._savedCamTrack?.readyState==='live') { await s.replaceTrack(this._savedCamTrack).catch(()=>{}); }
            else if(this._callType==='video') { try{const ns=await navigator.mediaDevices.getUserMedia({video:{facingMode:'user'}});const nt=ns.getVideoTracks()[0];if(nt){await s.replaceTrack(nt);if(this._ls){this._ls.getVideoTracks().forEach(o=>this._ls.removeTrack(o));this._ls.addTrack(nt);}}}catch(_){await s.replaceTrack(null).catch(()=>{});} }
            else { await s.replaceTrack(null).catch(()=>{}); }
        }
    }
    this._savedCamTrack=null;
    if(this._el.localVideo){if(this._callType==='video'&&this._ls){this._el.localVideo.srcObject=this._ls;this._el.localVideo.style.display='block';}else{this._el.localVideo.srcObject=null;this._el.localVideo.style.display='none';}}
    if(this._callType!=='video'){if(this._el.videoContainer)this._el.videoContainer.style.display='none';if(this._el.overlayAvatar)this._el.overlayAvatar.style.display='flex';}
    this._bcast({screenOff:true});
};

// ── RENEGOTIATION ────────────────────────────────────────────
AIAssistant.prototype._setupRenego = function(isCaller) {
    this._isCaller=isCaller; this._renegoLock=false;
    if(!this._callId||!this._pc) return;
    if(this._renegoCh){this.supabase.removeChannel(this._renegoCh);this._renegoCh=null;}
    this._renegoCh = this.supabase.channel(`rn-${this._callId}`)
        .on('broadcast',{event:'ro'}, async ({payload:p}) => {
            if(!this._pc||!p?.offer||p.sid===this.userId) return;
            try { if(this._pc.signalingState!=='stable'){if(this._isCaller)return;await this._pc.setLocalDescription({type:'rollback'});} await this._pc.setRemoteDescription(new RTCSessionDescription(p.offer)); const a=await this._pc.createAnswer(); await this._pc.setLocalDescription(a); this._renegoCh.send({type:'broadcast',event:'ra',payload:{answer:a,sid:this.userId}}).catch(()=>{}); } catch(e){console.warn('renego-o err:',e);}
        })
        .on('broadcast',{event:'ra'}, async ({payload:p}) => {
            if(!this._pc||!p?.answer||p.sid===this.userId) return;
            try { if(this._pc.signalingState!=='have-local-offer') return; await this._pc.setRemoteDescription(new RTCSessionDescription(p.answer)); this._renegoLock=false; } catch(e){console.warn('renego-a err:',e);}
        }).subscribe();
    this._pc.onnegotiationneeded = async () => {
        // Only renegotiate AFTER the call is fully connected — ignore events fired during initial setup
        if(!this._pc||!this._renegoCh||this._renegoLock) return;
        if(this._pc.signalingState!=='stable') return;
        if(this._pc.connectionState!=='connected') return;
        this._renegoLock=true;
        try {
            const o=await this._pc.createOffer();
            await this._pc.setLocalDescription(o);
            this._renegoCh.send({type:'broadcast',event:'ro',payload:{offer:o,sid:this.userId}}).catch(()=>{});
        } catch(e) { this._renegoLock=false; console.warn('[RENEGO] offer err:',e); }
    };
};

// ── FLIP CAMERA ──────────────────────────────────────────────
AIAssistant.prototype.callFlipCamera = async function() {
    if(!this._pc||!this._ls) return;
    this._facingMode = this._facingMode==='user'?'environment':'user';
    try {
        const ns = await navigator.mediaDevices.getUserMedia({audio:false,video:{facingMode:{exact:this._facingMode}}});
        const nt = ns.getVideoTracks()[0]; if(!nt){this._facingMode=this._facingMode==='user'?'environment':'user';return;}
        const ot=this._ls.getVideoTracks()[0]; if(ot){this._ls.removeTrack(ot);ot.stop();} this._ls.addTrack(nt);
        const s=this._pc.getSenders().find(x=>x.track?.kind==='video'); if(s) await s.replaceTrack(nt);
        if(this._el.localVideo) this._el.localVideo.srcObject=this._ls;
    } catch(err) { this._facingMode=this._facingMode==='user'?'environment':'user'; this.showNotification('Error','Flip failed: '+err.message); }
};

// ── FULLSCREEN ───────────────────────────────────────────────
AIAssistant.prototype.callToggleFullscreen = function() {
    const container = this._el.videoContainer;
    if (!container) return;

    // Cross-browser fullscreen detection
    const fsEl = document.fullscreenElement || document.webkitFullscreenElement || document.mozFullScreenElement || document.msFullscreenElement;

    if (fsEl) {
        (document.exitFullscreen || document.webkitExitFullscreen || document.mozCancelFullScreen || document.msExitFullscreen).call(document).catch(()=>{});
    } else {
        // Robust re-attach: save stream ref BEFORE entering fullscreen
        const rv = this._el.remoteVideo;
        const savedStream = rv?.srcObject;

        const _playAfterFs = () => {
            if (!rv) return;
            // Re-attach stream — this is the key fix for black screen in fullscreen
            if (savedStream) {
                rv.srcObject = null;
                // Small delay to let fullscreen layout settle before re-attaching
                setTimeout(() => {
                    rv.srcObject = savedStream;
                    rv.play().catch(()=>{});
                    // Double-check: verify video tracks are active
                    const vTracks = savedStream.getVideoTracks();
                    console.log('[FS] video tracks:', vTracks.length, vTracks.map(t => `${t.label} enabled:${t.enabled} readyState:${t.readyState}`).join(', '));
                    if (vTracks.length > 0 && vTracks[0].readyState === 'ended') {
                        console.warn('[FS] video track ended — stream may have been lost');
                    }
                }, 50);
            }
            // Also re-attach local video
            const lv = this._el.localVideo;
            if (lv && this._ls) {
                lv.srcObject = null;
                setTimeout(() => { lv.srcObject = this._ls; lv.play().catch(()=>{}); }, 50);
            }
        };

        const fsRequest = container.requestFullscreen || container.webkitRequestFullscreen || container.mozRequestFullScreen || container.msRequestFullscreen;
        if (fsRequest) {
            const p = fsRequest.call(container);
            if (p && p.then) {
                p.then(() => { setTimeout(_playAfterFs, 100); }).catch(() => {
                    // Fallback: try webkit prefix
                    if (container.webkitRequestFullscreen) { container.webkitRequestFullscreen(); setTimeout(_playAfterFs, 200); }
                });
            } else {
                setTimeout(_playAfterFs, 200);
            }
        }
    }

    if (!this._fsListenerAdded) {
        this._fsListenerAdded = true;
        const _onFsChange = () => {
            const isFs = !!(document.fullscreenElement || document.webkitFullscreenElement || document.mozFullScreenElement);
            if (this._el.fullscreenBtn) this._el.fullscreenBtn.textContent = isFs ? '✕' : '⛶';
            if (isFs) {
                if(this._el.fsMuteBtn) this._el.fsMuteBtn.textContent = this._isMuted ? '🔇' : '🎤';
                if(this._el.fsVideoBtn) this._el.fsVideoBtn.style.display = this._callType==='video' ? 'block' : 'none';
                if(this._el.fsScreenBtn) this._el.fsScreenBtn.textContent = this._isScreenSharing ? '⏹️' : '🖥️';
            } else {
                // Exiting fullscreen: re-attach streams to prevent black screen
                const rv2 = this._el.remoteVideo;
                if (rv2?.srcObject) {
                    const s = rv2.srcObject;
                    rv2.srcObject = null;
                    setTimeout(() => { rv2.srcObject = s; rv2.play().catch(()=>{}); }, 50);
                }
            }
        };
        document.addEventListener('fullscreenchange', _onFsChange);
        document.addEventListener('webkitfullscreenchange', _onFsChange);
    }
};

// ── REMOTE CONTROL ───────────────────────────────────────────
// Viewer clicks 🖱️ → request sent → Sharer sees Allow/Deny →
// If allowed: viewer's mouse hidden over video, all mouse/keyboard events sent to sharer
// who dispatches REAL DOM events + shows a visible red cursor arrow.
// Screen share video acts as live view so viewer sees everything happen in real time.

AIAssistant.prototype.callRequestRemoteControl = function() {
    if (!this._callId || !this._stateCh) return;
    if (this._rcActive) { this.callStopRemoteControl(); return; }
    this._stateCh.send({type:'broadcast',event:'cs',payload:{uid:this.userId,rcRequest:true}}).catch(()=>{});
    if (this._el.remoteControlBtn) {
        this._el.remoteControlBtn.textContent = '⏳';
        this._el.remoteControlBtn.style.background = 'rgba(250,204,21,0.4)';
    }
    this.showNotification('Remote Control', 'Request sent. Waiting for approval...');
};

AIAssistant.prototype.callAcceptRemoteControl = function() {
    if (this._el.rcModal) this._el.rcModal.style.display = 'none';
    this._rcBeingControlled = true;
    this._rcControllerUid = this._rcRequesterUid;
    if (this._stateCh) {
        this._stateCh.send({type:'broadcast',event:'cs',payload:{
            uid:this.userId, rcAccepted:true,
            vw:window.innerWidth, vh:window.innerHeight
        }}).catch(()=>{});
    }
    // Show the remote cursor on our page
    if (this._el.rcCursor) this._el.rcCursor.style.display = 'block';
    if (this._el.rcCursorLabel) this._el.rcCursorLabel.textContent = this._rcRequesterName || '';
    // Show status bar
    if (this._el.rcStatus) this._el.rcStatus.style.display = 'block';
    if (this._el.rcControllerName) this._el.rcControllerName.textContent = this._rcRequesterName || 'User';
    this.showNotification('Remote Control', 'Remote control enabled. Click the red bar to stop.');
};

AIAssistant.prototype.callDenyRemoteControl = function() {
    if (this._el.rcModal) this._el.rcModal.style.display = 'none';
    if (this._stateCh) {
        this._stateCh.send({type:'broadcast',event:'cs',payload:{uid:this.userId,rcDenied:true}}).catch(()=>{});
    }
};

AIAssistant.prototype.callStopRemoteControl = function() {
    // Guard: only notify peer if we were actually in a remote control session
    // Without this, both sides would ping rcStopped to each other indefinitely
    const wasActive = this._rcActive || this._rcBeingControlled;
    this._rcBeingControlled = false;
    this._rcActive = false;
    this._rcControllerUid = null;
    if (this._el.rcStatus) this._el.rcStatus.style.display = 'none';
    if (this._el.rcCursor) this._el.rcCursor.style.display = 'none';
    if (this._el.remoteControlBtn) {
        this._el.remoteControlBtn.textContent = '🖱️';
        this._el.remoteControlBtn.style.background = 'rgba(0,0,0,0.6)';
    }
    // Remove controller-side listeners
    if (this._rcMouseHandler) {
        const v = this._el.remoteVideo;
        if(v) {
            v.removeEventListener('mousemove',this._rcMouseHandler);
            v.removeEventListener('mousedown',this._rcClickHandler);
            v.removeEventListener('mouseup',this._rcMouseUpHandler);
            v.removeEventListener('contextmenu',this._rcContextHandler);
            v.removeEventListener('dblclick',this._rcDblClickHandler);
            v.removeEventListener('wheel',this._rcWheelHandler);
            if(this._rcTouchHandler) v.removeEventListener('touchmove',this._rcTouchHandler);
            if(this._rcTouchStartHandler) v.removeEventListener('touchstart',this._rcTouchStartHandler);
            if(this._rcTouchEndHandler) v.removeEventListener('touchend',this._rcTouchEndHandler);
        }
        document.removeEventListener('keydown', this._rcKeyHandler, true);
        document.removeEventListener('keyup', this._rcKeyUpHandler, true);
        this._rcMouseHandler = null;
        this._rcTouchHandler = null;
        this._rcTouchStartHandler = null;
        this._rcTouchEndHandler = null;
    }
    if (this._el.remoteVideo) this._el.remoteVideo.style.cursor = '';
    if (this._el.videoContainer) this._el.videoContainer.classList.remove('rc-controlling');
    if (wasActive && this._stateCh) {
        this._stateCh.send({type:'broadcast',event:'cs',payload:{uid:this.userId,rcStopped:true}}).catch(()=>{});
    }
};

// ── CONTROLLER SIDE: capture mouse/keyboard over remote video and send to sharer ──
AIAssistant.prototype._startRemoteControlSending = function() {
    this._rcActive = true;
    this._rcFocusedOnVideo = false;
    if (this._el.remoteControlBtn) {
        this._el.remoteControlBtn.textContent = '🔴';
        this._el.remoteControlBtn.style.background = 'rgba(239,68,68,0.6)';
    }
    if (this._el.videoContainer) this._el.videoContainer.classList.add('rc-controlling');
    this.showNotification('Remote Control', 'You have control! Move your mouse over the screen share.');

    const video = this._el.remoteVideo;
    if (!video) return;

    let _lastSend = 0;
    const _throttle = 16; // ~60fps for mouse (DataChannel is fast enough)

    const _getRelPos = (e) => {
        const rect = video.getBoundingClientRect();
        // Account for object-fit:contain letterboxing — black bars don't count as content
        const vw = video.videoWidth || rect.width;
        const vh = video.videoHeight || rect.height;
        const vr = vw / vh;
        const er = rect.width / rect.height;
        let contentW, contentH, ox, oy;
        if (vr > er) {
            contentW = rect.width;
            contentH = rect.width / vr;
            ox = 0;
            oy = (rect.height - contentH) / 2;
        } else {
            contentH = rect.height;
            contentW = rect.height * vr;
            ox = (rect.width - contentW) / 2;
            oy = 0;
        }
        return {
            x: Math.max(0, Math.min(1, (e.clientX - rect.left - ox) / contentW)),
            y: Math.max(0, Math.min(1, (e.clientY - rect.top - oy) / contentH))
        };
    };

    // Send via DataChannel (low latency) with Supabase broadcast fallback
    const _send = (data) => {
        const msg = {uid:this.userId,...data};
        // PRIMARY: WebRTC DataChannel — ~10-50ms latency
        if (this._rcDataChannel && this._rcDataChannelReady) {
            try { this._rcDataChannel.send(JSON.stringify(msg)); return; } catch(_) {}
        }
        // FALLBACK: Supabase broadcast — ~200-500ms latency
        if (this._stateCh) this._stateCh.send({type:'broadcast',event:'rc',payload:msg}).catch(()=>{});
    };

    this._rcMouseHandler = (e) => {
        this._rcFocusedOnVideo = true;
        const now = Date.now();
        if (now - _lastSend < _throttle) return;
        _lastSend = now;
        _send({t:'move',..._getRelPos(e)});
    };
    this._rcClickHandler = (e) => { e.preventDefault(); e.stopPropagation(); _send({t:'mousedown',..._getRelPos(e),btn:e.button}); };
    this._rcMouseUpHandler = (e) => { e.preventDefault(); e.stopPropagation(); _send({t:'mouseup',..._getRelPos(e),btn:e.button}); };
    this._rcContextHandler = (e) => { e.preventDefault(); e.stopPropagation(); _send({t:'contextmenu',..._getRelPos(e)}); };
    this._rcDblClickHandler = (e) => { e.preventDefault(); e.stopPropagation(); _send({t:'dblclick',..._getRelPos(e)}); };
    this._rcWheelHandler = (e) => { e.preventDefault(); e.stopPropagation(); _send({t:'scroll',dx:e.deltaX,dy:e.deltaY}); };

    this._rcKeyHandler = (e) => {
        if (!this._rcFocusedOnVideo) return;
        e.preventDefault(); e.stopPropagation();
        _send({t:'keydown',key:e.key,code:e.code,shift:e.shiftKey,ctrl:e.ctrlKey||e.metaKey,alt:e.altKey});
    };
    this._rcKeyUpHandler = (e) => {
        if (!this._rcFocusedOnVideo) return;
        e.preventDefault(); e.stopPropagation();
        _send({t:'keyup',key:e.key,code:e.code});
    };

    // Touch support for mobile remote control
    this._rcTouchHandler = (e) => {
        if (e.touches.length === 1) {
            this._rcFocusedOnVideo = true;
            const touch = e.touches[0];
            const fakeE = { clientX: touch.clientX, clientY: touch.clientY };
            const now = Date.now();
            if (now - _lastSend < _throttle) return;
            _lastSend = now;
            _send({t:'move',..._getRelPos(fakeE)});
        }
    };
    this._rcTouchStartHandler = (e) => {
        e.preventDefault();
        if (e.touches.length === 1) {
            const touch = e.touches[0];
            const fakeE = { clientX: touch.clientX, clientY: touch.clientY };
            _send({t:'mousedown',..._getRelPos(fakeE),btn:0});
        }
    };
    this._rcTouchEndHandler = (e) => {
        e.preventDefault();
        if (e.changedTouches.length === 1) {
            const touch = e.changedTouches[0];
            const fakeE = { clientX: touch.clientX, clientY: touch.clientY };
            _send({t:'mouseup',..._getRelPos(fakeE),btn:0});
        }
    };

    video.addEventListener('mouseleave', () => { this._rcFocusedOnVideo = false; });
    video.addEventListener('mouseenter', () => { this._rcFocusedOnVideo = true; });
    video.addEventListener('mousemove', this._rcMouseHandler);
    video.addEventListener('mousedown', this._rcClickHandler);
    video.addEventListener('mouseup', this._rcMouseUpHandler);
    video.addEventListener('contextmenu', this._rcContextHandler);
    video.addEventListener('dblclick', this._rcDblClickHandler);
    video.addEventListener('wheel', this._rcWheelHandler, {passive:false});
    video.addEventListener('touchmove', this._rcTouchHandler, {passive:false});
    video.addEventListener('touchstart', this._rcTouchStartHandler, {passive:false});
    video.addEventListener('touchend', this._rcTouchEndHandler, {passive:false});
    document.addEventListener('keydown', this._rcKeyHandler, true);
    document.addEventListener('keyup', this._rcKeyUpHandler, true);
};

// ── SHARER SIDE: receive remote events, show cursor, dispatch REAL DOM events ──
AIAssistant.prototype._handleRemoteControlEvent = function(p) {
    if (!this._rcBeingControlled || p.uid === this.userId) return;

    // Map normalized 0..1 coords → actual page pixel coords
    const px = p.x !== undefined ? Math.round(p.x * window.innerWidth) : 0;
    const py = p.y !== undefined ? Math.round(p.y * window.innerHeight) : 0;

    // Move the visible red cursor SVG element
    if (this._el.rcCursor && (p.t === 'move' || p.t === 'mousedown' || p.t === 'mouseup' || p.t === 'dblclick')) {
        this._el.rcCursor.style.left = px + 'px';
        this._el.rcCursor.style.top = py + 'px';
    }

    // Find element under the cursor
    // Temporarily hide the cursor so elementFromPoint doesn't hit it
    if (this._el.rcCursor) this._el.rcCursor.style.pointerEvents = 'none';
    const target = document.elementFromPoint(px, py);
    if (this._el.rcCursor) this._el.rcCursor.style.pointerEvents = 'none';

    if (p.t === 'move') {
        if (target) {
            target.dispatchEvent(new MouseEvent('mousemove', {clientX:px,clientY:py,bubbles:true,cancelable:true,view:window}));
            target.dispatchEvent(new MouseEvent('mouseover', {clientX:px,clientY:py,bubbles:true,cancelable:true,view:window}));
        }
    }
    else if (p.t === 'mousedown') {
        this._rcShowClickRipple(px, py);
        if (target) {
            if (target.focus && (target.tagName==='INPUT'||target.tagName==='TEXTAREA'||target.tagName==='SELECT'||target.tagName==='BUTTON'||target.tagName==='A'||target.contentEditable==='true'||target.tabIndex>=0)) target.focus();
            target.dispatchEvent(new MouseEvent('mousedown', {clientX:px,clientY:py,button:p.btn||0,bubbles:true,cancelable:true,view:window}));
        }
    }
    else if (p.t === 'mouseup') {
        if (target) {
            target.dispatchEvent(new MouseEvent('mouseup', {clientX:px,clientY:py,button:p.btn||0,bubbles:true,cancelable:true,view:window}));
            target.dispatchEvent(new MouseEvent('click', {clientX:px,clientY:py,button:p.btn||0,bubbles:true,cancelable:true,view:window}));
        }
    }
    else if (p.t === 'dblclick') {
        this._rcShowClickRipple(px, py, '#fbbf24');
        if (target) {
            target.dispatchEvent(new MouseEvent('dblclick', {clientX:px,clientY:py,bubbles:true,cancelable:true,view:window}));
            if (target.select) target.select();
        }
    }
    else if (p.t === 'contextmenu') {
        if (target) target.dispatchEvent(new MouseEvent('contextmenu', {clientX:px,clientY:py,bubbles:true,cancelable:true,view:window}));
    }
    else if (p.t === 'scroll') {
        if (target) target.dispatchEvent(new WheelEvent('wheel', {deltaX:p.dx||0,deltaY:p.dy||0,clientX:px,clientY:py,bubbles:true,cancelable:true,view:window}));
        const scrollEl = target?.closest('[style*="overflow"]') || document.scrollingElement;
        if (scrollEl) { scrollEl.scrollTop += (p.dy||0); scrollEl.scrollLeft += (p.dx||0); }
    }
    else if (p.t === 'keydown') {
        const ae = document.activeElement;
        const isTextInput = ae && (ae.tagName==='INPUT'||ae.tagName==='TEXTAREA'||ae.contentEditable==='true');
        (ae||document.body).dispatchEvent(new KeyboardEvent('keydown', {key:p.key,code:p.code,shiftKey:!!p.shift,ctrlKey:!!p.ctrl,altKey:!!p.alt,bubbles:true,cancelable:true,view:window}));

        // Actually type characters into text fields
        if (isTextInput && p.key.length === 1 && !p.ctrl && !p.alt) {
            if (ae.tagName==='INPUT'||ae.tagName==='TEXTAREA') {
                const s=ae.selectionStart??ae.value.length, e=ae.selectionEnd??ae.value.length;
                ae.value = ae.value.slice(0,s)+p.key+ae.value.slice(e);
                ae.selectionStart = ae.selectionEnd = s+1;
                ae.dispatchEvent(new Event('input',{bubbles:true}));
                ae.dispatchEvent(new Event('change',{bubbles:true}));
            }
        }
        else if (isTextInput && p.key==='Backspace') {
            if (ae.tagName==='INPUT'||ae.tagName==='TEXTAREA') {
                const s=ae.selectionStart??ae.value.length, e=ae.selectionEnd??ae.value.length;
                if(s!==e) { ae.value=ae.value.slice(0,s)+ae.value.slice(e); ae.selectionStart=ae.selectionEnd=s; }
                else if(s>0) { ae.value=ae.value.slice(0,s-1)+ae.value.slice(s); ae.selectionStart=ae.selectionEnd=s-1; }
                ae.dispatchEvent(new Event('input',{bubbles:true}));
            }
        }
        else if (isTextInput && p.key==='Delete') {
            if (ae.tagName==='INPUT'||ae.tagName==='TEXTAREA') {
                const s=ae.selectionStart??ae.value.length, e=ae.selectionEnd??ae.value.length;
                if(s!==e) ae.value=ae.value.slice(0,s)+ae.value.slice(e);
                else ae.value=ae.value.slice(0,s)+ae.value.slice(s+1);
                ae.selectionStart=ae.selectionEnd=s;
                ae.dispatchEvent(new Event('input',{bubbles:true}));
            }
        }
        else if (p.key==='Enter') {
            if(ae) ae.dispatchEvent(new KeyboardEvent('keypress',{key:'Enter',code:'Enter',bubbles:true,cancelable:true,view:window}));
            if(ae?.tagName==='BUTTON'||ae?.tagName==='A') ae.click();
            if(ae?.tagName==='TEXTAREA') {
                const s=ae.selectionStart??ae.value.length;
                ae.value=ae.value.slice(0,s)+'\n'+ae.value.slice(s);
                ae.selectionStart=ae.selectionEnd=s+1;
                ae.dispatchEvent(new Event('input',{bubbles:true}));
            }
            if(ae?.tagName==='INPUT'&&ae.form) ae.form.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));
        }
        else if (p.key==='Tab') {
            const focusables=[...document.querySelectorAll('input,textarea,select,button,a,[tabindex]')].filter(el=>!el.disabled&&el.tabIndex>=0);
            const idx=focusables.indexOf(ae);
            if(idx>=0){const next=p.shift?focusables[idx-1]:focusables[idx+1];if(next)next.focus();}
        }
        else if (p.ctrl && p.key==='a' && isTextInput) {
            ae.selectionStart=0; ae.selectionEnd=ae.value.length;
        }
    }
    else if (p.t === 'keyup') {
        (document.activeElement||document.body).dispatchEvent(new KeyboardEvent('keyup',{key:p.key,code:p.code,bubbles:true,cancelable:true,view:window}));
    }
};

// Show a click ripple at position on the sharer's page
AIAssistant.prototype._rcShowClickRipple = function(x, y, color) {
    const r = this._el.rcClickRipple;
    if (!r) return;
    r.style.left=x+'px'; r.style.top=y+'px'; r.style.borderColor=color||'#ef4444';
    r.style.display='block'; r.style.animation='none';
    r.offsetHeight; // reflow
    r.style.animation='rcRipple 0.4s ease-out forwards';
    setTimeout(()=>{r.style.display='none';},450);
};

// ============================================================
// PRESENCE — tracks who is online; shows call bar accordingly
// ============================================================

AIAssistant.prototype.initPresence = function() {
    if (!this.supabase || !this.userId) return;

    this._onlineUsers = new Set();

    // Use the userId as the presence key so we can look others up easily
    this._presenceCh = this.supabase
        .channel('user-presence', { config: { presence: { key: this.userId } } })
        .on('presence', { event: 'sync' }, () => {
            const state = this._presenceCh.presenceState();
            this._onlineUsers = new Set(Object.keys(state));
            this._updateCallBar();
        })
        .on('presence', { event: 'join' }, ({ key }) => {
            this._onlineUsers.add(key);
            this._updateCallBar();
        })
        .on('presence', { event: 'leave' }, ({ key }) => {
            this._onlineUsers.delete(key);
            this._updateCallBar();
        })
        .subscribe(async status => {
            if (status === 'SUBSCRIBED') {
                await this._presenceCh.track({ user_id: this.userId, online_at: new Date().toISOString() });
            }
        });
};

// ============================================================
// TYPING INDICATOR
// ============================================================

AIAssistant.prototype._subscribeTyping = function(chatId) {
    if (this._typingCh) { this.supabase.removeChannel(this._typingCh); this._typingCh = null; }
    if (!chatId) return;

    this._typingCh = this.supabase.channel(`typing-${chatId}`)
        .on('broadcast', { event: 'typing' }, ({ payload }) => {
            if (payload?.userId !== this.userId) this._showTypingIndicator(true);
        })
        .on('broadcast', { event: 'stop_typing' }, ({ payload }) => {
            if (payload?.userId !== this.userId) this._showTypingIndicator(false);
        })
        .subscribe();
};

AIAssistant.prototype._showTypingIndicator = function(show) {
    const el = document.getElementById('dcTypingIndicator');
    if (!el) return;
    if (show) {
        const name = this.dcActiveChatUser?.name || 'User';
        el.textContent = `${name} is typing…`;
        el.style.display = 'block';
        clearTimeout(this._typingHideTimer);
        this._typingHideTimer = setTimeout(() => this._showTypingIndicator(false), 4000);
    } else {
        el.style.display = 'none';
    }
};

AIAssistant.prototype._sendTypingEvent = function() {
    if (!this.dcActiveChatId || !this._typingCh) return;
    this._typingCh.send({ type: 'broadcast', event: 'typing', payload: { userId: this.userId } }).catch(() => {});
    clearTimeout(this._typingStopTimer);
    this._typingStopTimer = setTimeout(() => {
        if (this._typingCh) this._typingCh.send({ type: 'broadcast', event: 'stop_typing', payload: { userId: this.userId } }).catch(() => {});
    }, 2000);
};

// ============================================================
// MESSAGE CONTEXT MENU (right-click / long-press to copy/delete)
// ============================================================

AIAssistant.prototype._initMsgContextMenu = function() {
    if (this._msgCtxBound) return;
    this._msgCtxBound = true;

    const menu    = document.getElementById('msgContextMenu');
    const copyBtn = document.getElementById('msgCtxCopy');
    const delBtn  = document.getElementById('msgCtxDelete');
    if (!menu || !copyBtn || !delBtn) return;

    let targetMsgId   = null;
    let targetMsgText = null;
    let targetEl      = null;

    const show = (x, y, el) => {
        targetEl      = el;
        targetMsgId   = el?.dataset?.msgId;
        targetMsgText = el?.querySelector('div')?.textContent || '';
        const isSent  = el?.classList.contains('sent');
        delBtn.style.display = (isSent && targetMsgId && !targetMsgId.startsWith('temp-')) ? 'block' : 'none';
        menu.style.left    = `${Math.min(x, window.innerWidth - 160)}px`;
        menu.style.top     = `${Math.min(y, window.innerHeight - 100)}px`;
        menu.style.display = 'block';
    };
    const hide = () => { menu.style.display = 'none'; targetMsgId = null; targetEl = null; };

    // Context menu on dc-messages container (event delegation)
    document.addEventListener('contextmenu', e => {
        const msgEl = e.target.closest('.dc-msg');
        if (!msgEl) return;
        e.preventDefault();
        show(e.clientX, e.clientY, msgEl);
    });

    // Long-press for mobile
    let longPressTimer = null;
    document.addEventListener('touchstart', e => {
        const msgEl = e.target.closest('.dc-msg');
        if (!msgEl) return;
        longPressTimer = setTimeout(() => show(e.touches[0].clientX, e.touches[0].clientY, msgEl), 600);
    }, { passive: true });
    document.addEventListener('touchend', () => clearTimeout(longPressTimer), { passive: true });

    document.addEventListener('click', e => {
        if (!menu.contains(e.target)) hide();
    });

    copyBtn.addEventListener('click', () => {
        navigator.clipboard.writeText(targetMsgText || '').catch(() => {});
        hide();
    });

    delBtn.addEventListener('click', async () => {
        const id  = targetMsgId;
        const el2 = targetEl;
        hide();
        if (!id) return;

        const isGroup = !!this.dcActiveGroupId;
        const table   = isGroup ? 'group_messages' : 'direct_messages';
        el2?.remove();
        await this.supabase.from(table).delete().eq('id', id);
    });
};

// Show call bar whenever in a DM chat; online indicator updates dynamically
AIAssistant.prototype._updateCallBar = function() {
    const bar = document.getElementById('dcCallBar');
    if (!bar) return;

    // Only show in DM chat view (not groups)
    const inDmChat = !!(this.dcActiveChatUser?.id && !this.dcActiveGroupId);
    if (!inDmChat) { bar.style.display = 'none'; return; }

    const otherOnline = !!(this._onlineUsers?.has(this.dcActiveChatUser.id));
    bar.style.display = 'flex';

    // Update the status label
    const statusLabel = bar.querySelector('span');
    if (statusLabel) {
        statusLabel.textContent = otherOnline ? '🟢 Online' : '⚫ Offline';
        statusLabel.style.color  = otherOnline ? '#16a34a'  : '#9ca3af';
    }
};

// ============================================================
// BOOK VIEWER — flip-book with page-turn animation
// ============================================================

AIAssistant.prototype.initBook = function() {
    this._bookPages   = [];
    this._bookIndex   = 0;

    const btn = document.getElementById('bookBtn');
    if (btn) btn.onclick = () => this.showBook();

    const closeBtn = document.getElementById('bookCloseBtn');
    if (closeBtn) closeBtn.onclick = () => this.hideBook();

    const prevBtn = document.getElementById('bookPrevBtn');
    if (prevBtn) prevBtn.onclick = () => this._bookFlip(-1);

    const nextBtn = document.getElementById('bookNextBtn');
    if (nextBtn) nextBtn.onclick = () => this._bookFlip(1);

    // Admin controls
    const addBtn = document.getElementById('bookAdminAddBtn');
    if (addBtn) addBtn.onclick = () => {
        const m = document.getElementById('bookAddModal');
        if (m) m.style.display = 'flex';
    };
    const cancelBtn = document.getElementById('bookAddCancelBtn');
    if (cancelBtn) cancelBtn.onclick = () => {
        const m = document.getElementById('bookAddModal');
        if (m) m.style.display = 'none';
    };
    const saveBtn = document.getElementById('bookAddSaveBtn');
    if (saveBtn) saveBtn.onclick = () => this._bookSavePage();

    // Keyboard navigation
    document.addEventListener('keydown', (e) => {
        const panel = document.getElementById('bookPanel');
        if (!panel || panel.style.display === 'none') return;
        if (e.key === 'ArrowRight') this._bookFlip(1);
        if (e.key === 'ArrowLeft')  this._bookFlip(-1);
        if (e.key === 'Escape')     this.hideBook();
    });
};

AIAssistant.prototype.showBook = async function() {
    const panel = document.getElementById('bookPanel');
    if (!panel) return;
    panel.style.display = 'flex';
    await this._bookLoadPages();

    // Any logged-in user can add pages
    const addBtn = document.getElementById('bookAdminAddBtn');
    if (addBtn) addBtn.style.display = this.userId ? 'block' : 'none';
};

AIAssistant.prototype.hideBook = function() {
    const panel = document.getElementById('bookPanel');
    if (panel) panel.style.display = 'none';
};

AIAssistant.prototype._bookLoadPages = async function() {
    try {
        const { data, error } = await this.supabase.from('book_pages').select('*').order('page_order', { ascending: true });
        if (error) throw error;
        this._bookPages = data || [];
    } catch(e) {
        this._bookPages = [];
    }
    this._bookIndex = 0;
    this._bookRender();
};

AIAssistant.prototype._bookRender = function() {
    const pages  = this._bookPages;
    const idx    = this._bookIndex;
    const img    = document.getElementById('bookPageImg');
    const cap    = document.getElementById('bookPageCaption');
    const num    = document.getElementById('bookPageNum');
    const none   = document.getElementById('bookNoPages');

    if (!img) return;

    if (!pages.length) {
        img.style.display  = 'none';
        if (none) { none.style.display = 'flex'; }
        if (cap)  cap.style.display = 'none';
        if (num)  num.textContent   = 'No pages';
        return;
    }

    if (none) none.style.display = 'none';
    img.style.display = 'block';

    const page = pages[idx];
    img.src = page.image_url || '';
    if (cap) {
        cap.textContent   = page.caption || '';
        cap.style.display = page.caption ? 'block' : 'none';
    }
    if (num) num.textContent = `Page ${idx + 1} of ${pages.length}`;

    // Disable/style nav buttons
    const prev = document.getElementById('bookPrevBtn');
    const next = document.getElementById('bookNextBtn');
    if (prev) prev.style.opacity = idx === 0 ? '0.3' : '1';
    if (next) next.style.opacity = idx === pages.length - 1 ? '0.3' : '1';
};

AIAssistant.prototype._bookFlip = function(dir) {
    const pages = this._bookPages;
    if (!pages.length) return;
    const newIdx = this._bookIndex + dir;
    if (newIdx < 0 || newIdx >= pages.length) return;

    const page = document.getElementById('bookPage');
    if (!page) { this._bookIndex = newIdx; this._bookRender(); return; }

    // Apply flip-out animation
    const outClass = dir > 0 ? 'book-flip-out-left'  : 'book-flip-out-right';
    const inClass  = dir > 0 ? 'book-flip-in-right'  : 'book-flip-in-left';
    page.classList.remove('book-flip-out-left','book-flip-out-right','book-flip-in-right','book-flip-in-left');
    page.classList.add(outClass);

    setTimeout(() => {
        this._bookIndex = newIdx;
        this._bookRender();
        page.classList.remove(outClass);
        page.classList.add(inClass);
        setTimeout(() => page.classList.remove(inClass), 300);
    }, 280);
};

AIAssistant.prototype._bookSavePage = async function() {
    const fileInput = document.getElementById('bookPageFileInput');
    const capInput  = document.getElementById('bookPageCaptionInput');
    if (!fileInput?.files[0]) { this.showNotification('Error', 'Please select an image file'); return; }

    const saveBtn = document.getElementById('bookAddSaveBtn');
    if (saveBtn) { saveBtn.textContent = 'Saving…'; saveBtn.disabled = true; }

    try {
        const dataUrl = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            const canvas = document.createElement('canvas');
            const ctx    = canvas.getContext('2d');
            const imgEl  = new Image();
            reader.onload = e => { imgEl.src = e.target.result; };
            imgEl.onload = () => {
                // Compress to max 1200px wide/tall, JPEG 85%
                const MAX = 1200;
                let w = imgEl.naturalWidth, h = imgEl.naturalHeight;
                if (w > MAX || h > MAX) {
                    const ratio = Math.min(MAX / w, MAX / h);
                    w = Math.round(w * ratio); h = Math.round(h * ratio);
                }
                canvas.width = w; canvas.height = h;
                ctx.drawImage(imgEl, 0, 0, w, h);
                resolve(canvas.toDataURL('image/jpeg', 0.85));
            };
            imgEl.onerror = reject;
            reader.readAsDataURL(fileInput.files[0]);
        });

        const nextOrder = this._bookPages.length > 0
            ? Math.max(...this._bookPages.map(p => p.page_order)) + 1
            : 0;

        const { error } = await this.supabase.from('book_pages').insert({
            page_order: nextOrder,
            image_url: dataUrl,
            caption: capInput?.value?.trim() || ''
        });
        if (error) throw error;

        // Reset and close modal
        fileInput.value = '';
        if (capInput) capInput.value = '';
        const m = document.getElementById('bookAddModal');
        if (m) m.style.display = 'none';
        await this._bookLoadPages();
        this._bookIndex = this._bookPages.length - 1;
        this._bookRender();
        this.showNotification('Book', 'Page added!');
    } catch(e) {
        this.showNotification('Error', 'Failed to save page: ' + (e.message || ''));
    } finally {
        if (saveBtn) { saveBtn.textContent = 'Add Page'; saveBtn.disabled = false; }
    }
};
