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
    async loadSettingsFromSupabase() {
        console.log('⚙️ LOADING SETTINGS - userId:', this.userId);
        
        // CRITICAL: Must have userId
        if (!this.supabase || !this.userId) {
            console.warn('❌ Cannot load settings: missing Supabase client or userId');
            this.settings = this.getDefaultSettings();
            return;
        }

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
        console.log('💾 SETTINGS DATA:', JSON.stringify(this.settings, null, 2));
        
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
            
            // CRITICAL: Verify auth with getUser() first
            const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
            console.log('🔐 AUTH USER:', user);
            console.log('🔐 AUTH ERROR:', userError);
            
            if (userError || !user) {
                console.error('❌ AUTH FAILED - No user found');
                window.location.href = 'login.html';
                return;
            }
            
            // Also check session
            const { data: sessionData, error: sessionError } = await supabaseClient.auth.getSession();
            console.log('🔐 SESSION DATA:', sessionData);
            console.log('🔐 SESSION ERROR:', sessionError);
            
            if (sessionError || !sessionData || !sessionData.session) {
                console.error('❌ SESSION FAILED - No active session');
                window.location.href = 'login.html';
                return;
            }
            
            console.log('✅ AUTH VERIFIED - User:', user.email, 'ID:', user.id);
            window.__supabaseClient = supabaseClient;
            window.__currentUser = user;
        } catch (err) {
            console.error('❌ Supabase initialization error:', err);
            window.location.href = 'login.html';
            return;
        }
    } else {
        console.error('❌ Supabase not configured');
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
                this.supabase.from('direct_messages').update({ status: 'seen' }).in('id', unread).catch(() => {});
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
            // Refresh chat list when a new message arrives in any chat
            if (this.directChatPanel?.style.display === 'flex' && !this.dcActiveChatId) {
                this.dcLoadChats();
            }
        })
        .on('postgres_changes', {
            event: 'INSERT',
            schema: 'public',
            table: 'group_messages'
        }, (payload) => {
            if (this.directChatPanel?.style.display === 'flex' && !this.dcActiveGroupId) {
                this.dcLoadGroups();
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
// VOICE & VIDEO CALLS  (WebRTC + Supabase Realtime signaling)
// Production-grade: WhatsApp/Discord-level reliability
// ============================================================

const _ICE_CONFIG = { iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
    { urls: 'stun:stun4.l.google.com:19302' },
    // TURN relay for strict NATs
    { urls: 'turn:openrelay.metered.ca:80',  username: 'openrelayproject', credential: 'openrelayproject' },
    { urls: 'turn:openrelay.metered.ca:443', username: 'openrelayproject', credential: 'openrelayproject' },
    { urls: 'turn:openrelay.metered.ca:443?transport=tcp', username: 'openrelayproject', credential: 'openrelayproject' }
], iceCandidatePoolSize: 10 };

// ── INIT ──────────────────────────────────────────────────────
AIAssistant.prototype.initCallUI = function() {
    // State
    this._callPeer        = null;
    this._localStream     = null;
    this._remoteStream    = null;
    this._callId          = null;
    this._callSub         = null;
    this._candSub         = null;
    this._renegoCh        = null;
    this._callStateCh     = null;
    this._isCaller        = false;
    this._incomingCall    = null;
    this._isMuted         = false;
    this._isVideoOff      = false;
    this._isScreenSharing = false;
    this._screenStream    = null;
    this._savedCamTrack   = null;
    this._callTimer       = null;
    this._callStartTime   = null;
    this._facingMode      = 'user';
    this._callType        = 'voice';
    this._renegoInProgress = false;
    this._callEnding      = false;       // guard against double-end
    this._heartbeatIv     = null;

    const $ = id => document.getElementById(id);
    this._el = {
        voiceBtn:           $('dcVoiceCallBtn'),
        videoBtn:           $('dcVideoCallBtn'),
        incomingModal:      $('incomingCallModal'),
        callerName:         $('incomingCallerName'),
        callTypeLabel:      $('incomingCallTypeLabel'),
        callIcon:           $('incomingCallIcon'),
        acceptBtn:          $('acceptCallBtn'),
        rejectBtn:          $('rejectCallBtn'),
        overlay:            $('callOverlay'),
        overlayAvatar:      $('callOverlayAvatar'),
        overlayName:        $('callOverlayName'),
        statusText:         $('callStatusText'),
        callTimer:          $('callTimer'),
        remoteMuteIndicator:$('callRemoteMuteIndicator'),
        videoContainer:     $('callVideoContainer'),
        localVideo:         $('localVideo'),
        remoteVideo:        $('remoteVideo'),
        remoteAudio:        $('remoteAudio'),
        hangupBtn:          $('hangupBtn'),
        muteBtn:            $('toggleMuteBtn'),
        videoToggleBtn:     $('toggleVideoBtn'),
        switchToVideoBtn:   $('callSwitchToVideoBtn'),
        screenShareBtn:     $('callScreenShareBtn'),
        flipCamBtn:         $('callFlipCamBtn'),
    };

    // Bind buttons
    if (this._el.voiceBtn)         this._el.voiceBtn.addEventListener('click', () => this.callStart('voice'));
    if (this._el.videoBtn)         this._el.videoBtn.addEventListener('click', () => this.callStart('video'));
    if (this._el.acceptBtn)        this._el.acceptBtn.addEventListener('click', () => this.callAccept());
    if (this._el.rejectBtn)        this._el.rejectBtn.addEventListener('click', () => this.callReject());
    if (this._el.hangupBtn)        this._el.hangupBtn.addEventListener('click', () => this.callHangup());
    if (this._el.muteBtn)          this._el.muteBtn.addEventListener('click',   () => this.callToggleMute());
    if (this._el.videoToggleBtn)   this._el.videoToggleBtn.addEventListener('click', () => this.callToggleVideo());
    if (this._el.switchToVideoBtn) this._el.switchToVideoBtn.addEventListener('click', () => this.callSwitchToVideo());
    if (this._el.screenShareBtn)   this._el.screenShareBtn.addEventListener('click', () => this.callShareScreen());
    if (this._el.flipCamBtn)       this._el.flipCamBtn.addEventListener('click', () => this.callFlipCamera());

    this._subscribeIncomingCalls();
    this.initPresence();

    // ── PAGE LIFECYCLE ──────────────────────────────────────────
    // ONLY end the call when the tab/browser is ACTUALLY CLOSING.
    // Do NOT end on minimize, tab switch, or lock screen.
    // WebRTC keeps running in background automatically.

    const _beaconEndCall = (callId) => {
        const blob = new Blob([JSON.stringify({ callId })], { type: 'application/json' });
        navigator.sendBeacon('/api/end-call', blob);
    };

    // beforeunload fires ONLY when closing/navigating away — NOT on minimize
    window.addEventListener('beforeunload', (e) => {
        if (this._callId) {
            _beaconEndCall(this._callId);
            // Don't show confirmation on actual navigation
        }
    });

    // pagehide with persisted=false means actual page destruction (tab close)
    window.addEventListener('pagehide', (e) => {
        if (this._callId && !e.persisted) {
            _beaconEndCall(this._callId);
        }
    });

    // NOTE: We intentionally do NOT use visibilitychange to end calls.
    // Minimizing / switching tabs should NOT end the call.
    // WebRTC audio/video continue flowing in the background.
};

// ── SUBSCRIBE INCOMING CALLS ─────────────────────────────────
AIAssistant.prototype._subscribeIncomingCalls = function() {
    if (!this.supabase || !this.userId) return;
    this.supabase
        .channel(`incoming-calls-${this.userId}-${Date.now()}`)
        .on('postgres_changes', {
            event: 'INSERT', schema: 'public', table: 'calls',
            filter: `callee_id=eq.${this.userId}`
        }, payload => {
            if (payload.new.status === 'ringing') this._showIncoming(payload.new);
        })
        .subscribe();
};

// ── SHOW INCOMING CALL MODAL ─────────────────────────────────
AIAssistant.prototype._showIncoming = async function(call) {
    if (this._callId) return; // already in a call, ignore
    this._incomingCall = call;
    let name = 'Unknown';
    try {
        const { data } = await this.supabase.from('users').select('username,email').eq('id', call.caller_id).single();
        name = data?.username || data?.email?.split('@')[0] || 'Unknown';
    } catch (_) {}
    if (this._el.callerName)    this._el.callerName.textContent    = name;
    if (this._el.callTypeLabel) this._el.callTypeLabel.textContent = call.call_type === 'video' ? '🎥 Incoming Video Call' : '📞 Incoming Voice Call';
    if (this._el.callIcon)      this._el.callIcon.textContent      = call.call_type === 'video' ? '🎥' : '📞';
    if (this._el.incomingModal) this._el.incomingModal.style.display = 'flex';

    // Watch for caller cancel
    if (this._incomingWatchSub) { this.supabase.removeChannel(this._incomingWatchSub); }
    this._incomingWatchSub = this.supabase
        .channel(`incoming-watch-${call.id}`)
        .on('postgres_changes', {
            event: 'UPDATE', schema: 'public', table: 'calls',
            filter: `id=eq.${call.id}`
        }, payload => {
            if (payload.new.status === 'ended' || payload.new.status === 'rejected') {
                this._incomingCall = null;
                if (this._el.incomingModal) this._el.incomingModal.style.display = 'none';
                if (this._incomingWatchSub) { this.supabase.removeChannel(this._incomingWatchSub); this._incomingWatchSub = null; }
            }
        })
        .subscribe();
};

// ── SETUP PEER CONNECTION ────────────────────────────────────
AIAssistant.prototype._setupPeerConnection = function() {
    if (this._callPeer) { this._callPeer.close(); }
    this._callPeer = new RTCPeerConnection(_ICE_CONFIG);

    // TWO separate streams: one for audio-only, one for video-only
    // This prevents the BEEE/buzzing audio bug caused by duplicate audio playback
    this._remoteAudioStream = new MediaStream();  // goes to <audio> element ONLY
    this._remoteVideoStream = new MediaStream();  // goes to <video muted> element ONLY (no audio!)

    // Wire: audio element gets ONLY audio tracks
    if (this._el.remoteAudio) {
        this._el.remoteAudio.srcObject = this._remoteAudioStream;
    }
    // Wire: video element gets ONLY video tracks (element is muted in HTML)
    if (this._el.remoteVideo) {
        this._el.remoteVideo.srcObject = this._remoteVideoStream;
    }

    this._callPeer.ontrack = (e) => {
        console.log('[CALL] Remote track received:', e.track.kind, e.track.id, 'readyState:', e.track.readyState);

        if (e.track.kind === 'audio') {
            // Remove any existing audio tracks first (strict: only 1 audio track ever)
            this._remoteAudioStream.getAudioTracks().forEach(old => {
                this._remoteAudioStream.removeTrack(old);
            });
            this._remoteAudioStream.addTrack(e.track);
            console.log('[CALL] Audio track attached to remoteAudio element');

            // Force play with autoplay policy handling
            if (this._el.remoteAudio) {
                this._el.remoteAudio.play().catch(err => {
                    console.warn('[CALL] Audio autoplay blocked:', err.message);
                    const resume = () => {
                        if (this._el.remoteAudio) this._el.remoteAudio.play().catch(() => {});
                        document.removeEventListener('click', resume);
                        document.removeEventListener('touchstart', resume);
                    };
                    document.addEventListener('click', resume, { once: true });
                    document.addEventListener('touchstart', resume, { once: true });
                });
            }
        }

        if (e.track.kind === 'video') {
            // Remove any existing video tracks first (strict: only 1 video track ever)
            this._remoteVideoStream.getVideoTracks().forEach(old => {
                this._remoteVideoStream.removeTrack(old);
            });
            this._remoteVideoStream.addTrack(e.track);
            console.log('[CALL] Video track attached to remoteVideo element');

            // Show video container
            if (this._el.videoContainer) this._el.videoContainer.style.display = 'block';
            if (this._el.overlayAvatar)  this._el.overlayAvatar.style.display = 'none';
            if (this._el.remoteVideo) this._el.remoteVideo.play().catch(() => {});
        }

        // Track mute/unmute events (for when remote replaceTrack swaps video)
        e.track.onmute = () => {
            console.log('[CALL] Remote track muted:', e.track.kind);
            if (e.track.kind === 'video') {
                // Remote stopped video or screen share ended
                if (this._remoteVideoStream.getVideoTracks().every(t => t.muted)) {
                    if (this._callType !== 'video' && !this._isScreenSharing) {
                        if (this._el.videoContainer) this._el.videoContainer.style.display = 'none';
                        if (this._el.overlayAvatar)  this._el.overlayAvatar.style.display = 'flex';
                    }
                }
            }
        };
        e.track.onunmute = () => {
            console.log('[CALL] Remote track unmuted:', e.track.kind);
            if (e.track.kind === 'video') {
                if (this._el.videoContainer) this._el.videoContainer.style.display = 'block';
                if (this._el.overlayAvatar)  this._el.overlayAvatar.style.display = 'none';
                if (this._el.remoteVideo) this._el.remoteVideo.play().catch(() => {});
            }
        };

        e.track.onended = () => {
            console.log('[CALL] Remote track ended:', e.track.kind);
            if (e.track.kind === 'audio') {
                try { this._remoteAudioStream.removeTrack(e.track); } catch(_){}
            }
            if (e.track.kind === 'video') {
                try { this._remoteVideoStream.removeTrack(e.track); } catch(_){}
                if (this._remoteVideoStream.getVideoTracks().length === 0 && this._callType !== 'video') {
                    if (this._el.videoContainer) this._el.videoContainer.style.display = 'none';
                    if (this._el.overlayAvatar)  this._el.overlayAvatar.style.display = 'flex';
                }
            }
        };
    };

    // Connection state monitoring
    this._callPeer.onconnectionstatechange = () => {
        const st = this._callPeer?.connectionState;
        console.log('[CALL] PeerConnection state:', st);
        if (!st) return;
        if (st === 'connected') {
            if (this._el.statusText) this._el.statusText.textContent = 'Connected';
            // Clear any pending disconnect timeout
            if (this._disconnectTimeout) { clearTimeout(this._disconnectTimeout); this._disconnectTimeout = null; }
        } else if (st === 'connecting') {
            if (this._disconnectTimeout) { clearTimeout(this._disconnectTimeout); this._disconnectTimeout = null; }
        } else if (st === 'disconnected') {
            if (this._el.statusText) this._el.statusText.textContent = 'Reconnecting...';
            this._disconnectTimeout = setTimeout(() => {
                if (this._callPeer?.connectionState === 'disconnected') {
                    console.log('[CALL] Still disconnected after 15s, ending call');
                    this.callHangup();
                }
            }, 15000);
        } else if (st === 'failed') {
            console.log('[CALL] Connection failed');
            this.callHangup();
        }
    };

    this._callPeer.oniceconnectionstatechange = () => {
        const st = this._callPeer?.iceConnectionState;
        console.log('[CALL] ICE state:', st);
        if (st === 'failed') {
            console.log('[CALL] ICE failed, restarting...');
            if (this._callPeer) this._callPeer.restartIce();
        }
    };
};

// ── HELPER: find or create video sender ──────────────────────
AIAssistant.prototype._getVideoSender = function() {
    if (!this._callPeer) return null;
    // First try: sender with video track
    let sender = this._callPeer.getSenders().find(s => s.track?.kind === 'video');
    if (sender) return sender;
    // Second try: transceiver with no track (recvonly we added)
    const tc = this._callPeer.getTransceivers().find(t =>
        (t.receiver?.track?.kind === 'video' && (!t.sender.track || t.sender.track.readyState === 'ended'))
        || t.sender.track === null
    );
    if (tc) {
        if (tc.direction === 'recvonly' || tc.direction === 'inactive') {
            tc.direction = 'sendrecv';
        }
        return tc.sender;
    }
    return null;
};

// ── START CALL (caller side) ─────────────────────────────────
AIAssistant.prototype.callStart = async function(callType) {
    if (!this.dcActiveChatUser?.id) { this.showNotification('Error', 'Open a DM chat first to call.'); return; }
    if (this._callId) { this.showNotification('Error', 'Already in a call.'); return; }
    this._callType = callType;
    this._callEnding = false;

    try {
        // ── 1. Get local media ──
        console.log('[CALL] Requesting media for', callType, 'call...');
        const audioOpts = { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1, sampleRate: 48000 };
        const constraints = callType === 'video'
            ? { audio: audioOpts, video: { width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30 }, facingMode: 'user' } }
            : { audio: audioOpts, video: false };
        this._localStream = await navigator.mediaDevices.getUserMedia(constraints);
        console.log('[CALL] Got local stream. Audio tracks:', this._localStream.getAudioTracks().length, 'Video tracks:', this._localStream.getVideoTracks().length);

        // ── 2. Create peer connection & add tracks ──
        this._setupPeerConnection();
        this._localStream.getTracks().forEach(t => {
            console.log('[CALL] Adding local track:', t.kind, t.label);
            this._callPeer.addTrack(t, this._localStream);
        });

        // For voice calls: add recvonly video transceiver so mid-call video/screen share works
        if (callType === 'voice') {
            this._callPeer.addTransceiver('video', { direction: 'recvonly' });
        }

        // ── 3. Show local video preview ──
        if (this._el.localVideo) {
            this._el.localVideo.srcObject = this._localStream;
            this._el.localVideo.style.display = callType === 'video' ? 'block' : 'none';
        }

        // ── 4. Create offer ──
        const offer = await this._callPeer.createOffer();
        await this._callPeer.setLocalDescription(offer);
        console.log('[CALL] Offer created');

        // ── 5. Insert call row ──
        const { data: callRow, error } = await this.supabase.from('calls').insert({
            caller_id: this.userId,
            callee_id: this.dcActiveChatUser.id,
            call_type: callType,
            status: 'ringing',
            offer: { type: offer.type, sdp: offer.sdp }
        }).select().single();
        if (error) throw error;
        this._callId = callRow.id;
        this._isCaller = true;
        console.log('[CALL] Call created:', this._callId);

        // ── 6. ICE candidates ──
        this._callPeer.onicecandidate = async e => {
            if (e.candidate && this._callId) {
                await this.supabase.from('call_candidates').insert({
                    call_id: this._callId, sender_id: this.userId, candidate: e.candidate.toJSON()
                }).catch(() => {});
            }
        };

        // ── 7. Watch for answer / rejection / end ──
        this._callSub = this.supabase
            .channel(`call-watch-${this._callId}`)
            .on('postgres_changes', {
                event: 'UPDATE', schema: 'public', table: 'calls',
                filter: `id=eq.${this._callId}`
            }, async payload => {
                const c = payload.new;
                if (c.status === 'rejected') {
                    this.showNotification('Call', 'Call was declined.');
                    this._callEndLocal(); return;
                }
                if (c.status === 'ended') {
                    this._callEndLocal('Call ended'); return;
                }
                // Answer received
                if (c.answer && this._callPeer && !this._callPeer.remoteDescription) {
                    console.log('[CALL] Answer received, setting remote description...');
                    await this._callPeer.setRemoteDescription(new RTCSessionDescription(c.answer));
                    if (this._el.statusText) this._el.statusText.textContent = 'Connected';
                    this._startCallTimer();
                    this._setupRenegotiation(true);
                    this._setupCallStateBroadcast();
                    this._startHeartbeat();
                }
                // Call type upgrade
                if (c.call_type === 'video' && this._callType !== 'video') {
                    this._handleVideoUpgrade();
                }
            })
            .subscribe();

        // ── 8. Watch for callee's ICE candidates ──
        this._candSub = this.supabase
            .channel(`cand-caller-${this._callId}`)
            .on('postgres_changes', {
                event: 'INSERT', schema: 'public', table: 'call_candidates',
                filter: `call_id=eq.${this._callId}`
            }, async payload => {
                if (payload.new.sender_id !== this.userId && this._callPeer) {
                    try { await this._callPeer.addIceCandidate(new RTCIceCandidate(payload.new.candidate)); } catch(_){}
                }
            })
            .subscribe();

        // ── 9. Show overlay ──
        this._callShowOverlay(callType, this.dcActiveChatUser.name, false);

    } catch (err) {
        console.error('[CALL] callStart error:', err);
        let msg = err.message || 'Unknown error';
        if (msg.includes('NotAllowedError') || msg.includes('Permission denied')) {
            msg = 'Microphone/camera permission denied. Allow access in browser settings.';
        } else if (msg.includes('NotFoundError') || msg.includes('DevicesNotFoundError')) {
            msg = 'No microphone found. Please connect a microphone.';
        } else if (msg.includes('relation') || msg.includes('does not exist')) {
            msg = 'Calls table not set up. Run ENABLE_REALTIME.sql in Supabase first.';
        }
        this.showNotification('Call Failed', msg);
        this._callEndLocal();
    }
};

// ── ACCEPT CALL (callee side) ────────────────────────────────
AIAssistant.prototype.callAccept = async function() {
    if (!this._incomingCall) return;
    const call = this._incomingCall;
    this._incomingCall = null;
    this._callEnding = false;
    if (this._el.incomingModal) this._el.incomingModal.style.display = 'none';
    if (this._incomingWatchSub) { this.supabase.removeChannel(this._incomingWatchSub); this._incomingWatchSub = null; }
    this._callType = call.call_type;

    try {
        // ── 1. Get local media ──
        console.log('[CALL] Accepting', call.call_type, 'call...');
        const audioOpts = { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1, sampleRate: 48000 };
        const constraints = call.call_type === 'video'
            ? { audio: audioOpts, video: { width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30 }, facingMode: 'user' } }
            : { audio: audioOpts, video: false };
        this._localStream = await navigator.mediaDevices.getUserMedia(constraints);
        console.log('[CALL] Got local stream. Audio:', this._localStream.getAudioTracks().length, 'Video:', this._localStream.getVideoTracks().length);

        // ── 2. Create peer connection & add tracks ──
        this._setupPeerConnection();
        this._localStream.getTracks().forEach(t => {
            console.log('[CALL] Adding local track:', t.kind, t.label);
            this._callPeer.addTrack(t, this._localStream);
        });

        // ── 3. Local video preview ──
        if (this._el.localVideo) {
            this._el.localVideo.srcObject = this._localStream;
            this._el.localVideo.style.display = call.call_type === 'video' ? 'block' : 'none';
        }

        // ── 4. Set remote offer & create answer ──
        console.log('[CALL] Setting remote offer...');
        await this._callPeer.setRemoteDescription(new RTCSessionDescription(call.offer));
        const answer = await this._callPeer.createAnswer();
        await this._callPeer.setLocalDescription(answer);
        console.log('[CALL] Answer created');

        this._callId = call.id;
        this._isCaller = false;

        // ── 5. ICE candidates ──
        this._callPeer.onicecandidate = async e => {
            if (e.candidate && this._callId) {
                await this.supabase.from('call_candidates').insert({
                    call_id: this._callId, sender_id: this.userId, candidate: e.candidate.toJSON()
                }).catch(() => {});
            }
        };

        // ── 6. Fetch existing ICE candidates caller sent while we were setting up ──
        const { data: existingCands } = await this.supabase.from('call_candidates')
            .select('candidate').eq('call_id', this._callId).neq('sender_id', this.userId);
        if (existingCands) {
            for (const c of existingCands) {
                try { await this._callPeer.addIceCandidate(new RTCIceCandidate(c.candidate)); } catch(_){}
            }
            console.log('[CALL] Added', existingCands.length, 'existing ICE candidates');
        }

        // ── 7. Watch for new ICE candidates ──
        this._candSub = this.supabase
            .channel(`cand-callee-${this._callId}`)
            .on('postgres_changes', {
                event: 'INSERT', schema: 'public', table: 'call_candidates',
                filter: `call_id=eq.${this._callId}`
            }, async payload => {
                if (payload.new.sender_id !== this.userId && this._callPeer) {
                    try { await this._callPeer.addIceCandidate(new RTCIceCandidate(payload.new.candidate)); } catch(_){}
                }
            })
            .subscribe();

        // ── 8. Watch for call end / type change ──
        this._callSub = this.supabase
            .channel(`call-callee-${this._callId}`)
            .on('postgres_changes', {
                event: 'UPDATE', schema: 'public', table: 'calls',
                filter: `id=eq.${this._callId}`
            }, payload => {
                const c = payload.new;
                if (c.status === 'ended') {
                    this._callEndLocal('Call ended');
                }
                if (c.call_type === 'video' && this._callType !== 'video') {
                    this._handleVideoUpgrade();
                }
            })
            .subscribe();

        // ── 9. Send answer to DB ──
        await this.supabase.from('calls')
            .update({ answer: { type: answer.type, sdp: answer.sdp }, status: 'active' })
            .eq('id', call.id);
        console.log('[CALL] Answer sent to DB');

        // ── 10. Show overlay & start timer ──
        const callerLabel = this._el.callerName?.textContent || 'User';
        this._callShowOverlay(call.call_type, callerLabel, true);
        this._startCallTimer();
        this._setupRenegotiation(false);
        this._setupCallStateBroadcast();
        this._startHeartbeat();

    } catch (err) {
        console.error('[CALL] callAccept error:', err);
        this.showNotification('Error', 'Could not accept call: ' + (err.message || 'Check mic/camera permission'));
        this._callEndLocal();
    }
};

// ── REJECT CALL ──────────────────────────────────────────────
AIAssistant.prototype.callReject = async function() {
    if (!this._incomingCall) return;
    const id = this._incomingCall.id;
    this._incomingCall = null;
    if (this._el.incomingModal) this._el.incomingModal.style.display = 'none';
    if (this._incomingWatchSub) { this.supabase.removeChannel(this._incomingWatchSub); this._incomingWatchSub = null; }
    await this.supabase.from('calls').update({ status: 'rejected' }).eq('id', id).catch(() => {});
};

// ── HANG UP ──────────────────────────────────────────────────
AIAssistant.prototype.callHangup = async function() {
    if (this._callEnding) return; // prevent double-hangup
    this._callEnding = true;
    const callId = this._callId;
    if (callId) {
        // Update DB so other user gets notified via realtime
        await this.supabase.from('calls').update({ status: 'ended' }).eq('id', callId).catch(() => {});
        // Server backup
        fetch('/api/end-call', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ callId })
        }).catch(() => {});
    }
    this._callEndLocal('You ended the call');
};

// ── END CALL LOCAL CLEANUP ───────────────────────────────────
AIAssistant.prototype._callEndLocal = function(reason) {
    // Timer
    if (this._callTimer) { clearInterval(this._callTimer); this._callTimer = null; }
    this._callStartTime = null;
    // Heartbeat
    if (this._heartbeatIv) { clearInterval(this._heartbeatIv); this._heartbeatIv = null; }
    // Disconnect timeout
    if (this._disconnectTimeout) { clearTimeout(this._disconnectTimeout); this._disconnectTimeout = null; }

    // Screen share
    if (this._screenStream) { this._screenStream.getTracks().forEach(t => t.stop()); this._screenStream = null; }

    // Local stream
    if (this._localStream) { this._localStream.getTracks().forEach(t => t.stop()); this._localStream = null; }
    // Remote streams (separate audio/video — just release, don't stop)
    this._remoteAudioStream = null;
    this._remoteVideoStream = null;

    // Peer connection
    if (this._callPeer) {
        this._callPeer.ontrack = null;
        this._callPeer.onconnectionstatechange = null;
        this._callPeer.oniceconnectionstatechange = null;
        this._callPeer.onnegotiationneeded = null;
        this._callPeer.onicecandidate = null;
        this._callPeer.close();
        this._callPeer = null;
    }

    // Supabase channels
    if (this._callSub)     { this.supabase.removeChannel(this._callSub); this._callSub = null; }
    if (this._candSub)     { this.supabase.removeChannel(this._candSub); this._candSub = null; }
    if (this._renegoCh)    { this.supabase.removeChannel(this._renegoCh); this._renegoCh = null; }
    if (this._callStateCh) { this.supabase.removeChannel(this._callStateCh); this._callStateCh = null; }
    if (this._incomingWatchSub) { this.supabase.removeChannel(this._incomingWatchSub); this._incomingWatchSub = null; }

    // Clear media elements
    if (this._el.localVideo)  this._el.localVideo.srcObject  = null;
    if (this._el.remoteVideo) this._el.remoteVideo.srcObject = null;
    if (this._el.remoteAudio) this._el.remoteAudio.srcObject = null;
    if (this._el.incomingModal) this._el.incomingModal.style.display = 'none';

    // Show "Call Ended" briefly, then close overlay
    if (this._el.overlay && this._el.overlay.style.display === 'flex') {
        if (this._el.statusText) this._el.statusText.textContent = reason || 'Call ended';
        if (this._el.callTimer)  this._el.callTimer.style.display = 'none';
        setTimeout(() => { if (this._el.overlay) this._el.overlay.style.display = 'none'; }, 1500);
    }

    // Reset state
    this._callId           = null;
    this._isMuted          = false;
    this._isVideoOff       = false;
    this._isScreenSharing  = false;
    this._renegoInProgress = false;
    this._callEnding       = false;
    this._facingMode       = 'user';
    this._callType         = 'voice';
    this._savedCamTrack    = null;

    // Reset button UI
    if (this._el.muteBtn) { this._el.muteBtn.textContent = '🎤 Mute'; this._el.muteBtn.style.background = '#374151'; }
    if (this._el.videoToggleBtn) { this._el.videoToggleBtn.textContent = '📹 Stop Video'; this._el.videoToggleBtn.style.background = '#374151'; }
    if (this._el.screenShareBtn) { this._el.screenShareBtn.textContent = '🖥️ Share Screen'; this._el.screenShareBtn.style.background = '#374151'; }
    if (this._el.remoteMuteIndicator) this._el.remoteMuteIndicator.style.display = 'none';
};

// ── SHOW CALL OVERLAY ────────────────────────────────────────
AIAssistant.prototype._callShowOverlay = function(callType, name, isCallee) {
    if (!this._el.overlay) return;
    const initial = (name || 'U')[0].toUpperCase();
    if (this._el.overlayAvatar) {
        this._el.overlayAvatar.textContent = initial;
        this._el.overlayAvatar.style.display = callType === 'video' ? 'none' : 'flex';
    }
    if (this._el.overlayName) this._el.overlayName.textContent = name || 'User';
    if (this._el.statusText)  this._el.statusText.textContent  = isCallee ? 'Connecting…' : `Calling ${name}…`;
    if (this._el.videoContainer)   this._el.videoContainer.style.display   = callType === 'video' ? 'block' : 'none';
    if (this._el.videoToggleBtn)   this._el.videoToggleBtn.style.display   = callType === 'video' ? 'inline-block' : 'none';
    if (this._el.switchToVideoBtn) this._el.switchToVideoBtn.style.display = callType === 'video' ? 'none' : 'inline-block';
    if (this._el.callTimer) { this._el.callTimer.textContent = '0:00'; this._el.callTimer.style.display = 'none'; }
    this._el.overlay.style.display = 'flex';
};

// ── HEARTBEAT: detect when other user is truly gone ──────────
AIAssistant.prototype._startHeartbeat = function() {
    if (this._heartbeatIv) clearInterval(this._heartbeatIv);
    this._lastRemoteHeartbeat = Date.now();

    // Send heartbeat every 3 seconds
    this._heartbeatIv = setInterval(() => {
        if (!this._callStateCh || !this._callId) return;
        this._callStateCh.send({
            type: 'broadcast', event: 'heartbeat',
            payload: { userId: this.userId, ts: Date.now() }
        }).catch(() => {});
        // Check if we haven't received remote heartbeat in 20 seconds
        if (Date.now() - this._lastRemoteHeartbeat > 20000) {
            console.log('[CALL] No heartbeat from other user for 20s, ending call');
            this.callHangup();
        }
    }, 3000);
};

// ── CALL STATE BROADCAST (mute/video/screen share sync) ──────
AIAssistant.prototype._setupCallStateBroadcast = function() {
    if (!this._callId) return;
    if (this._callStateCh) { this.supabase.removeChannel(this._callStateCh); }

    this._callStateCh = this.supabase.channel(`call-state-${this._callId}`)
        .on('broadcast', { event: 'call-state' }, ({ payload }) => {
            if (!payload || payload.userId === this.userId) return;
            console.log('[CALL] Remote state:', payload);
            // Mute indicator
            if (this._el.remoteMuteIndicator) {
                this._el.remoteMuteIndicator.style.display = payload.isMuted ? 'block' : 'none';
            }
            // Video off → show avatar
            if (payload.isVideoOff !== undefined && this._callType === 'video') {
                if (this._el.overlayAvatar) {
                    this._el.overlayAvatar.style.display = payload.isVideoOff ? 'flex' : 'none';
                }
            }
            // Screen sharing → show video container
            if (payload.isScreenSharing) {
                if (this._el.videoContainer) this._el.videoContainer.style.display = 'block';
                if (this._el.overlayAvatar)  this._el.overlayAvatar.style.display = 'none';
            }
            // Switched to video → auto-upgrade
            if (payload.switchedToVideo && this._callType !== 'video') {
                this._handleVideoUpgrade();
            }
        })
        .on('broadcast', { event: 'heartbeat' }, ({ payload }) => {
            if (payload && payload.userId !== this.userId) {
                this._lastRemoteHeartbeat = Date.now();
            }
        })
        .subscribe();
};

AIAssistant.prototype._broadcastCallState = function() {
    if (!this._callStateCh) return;
    this._callStateCh.send({
        type: 'broadcast',
        event: 'call-state',
        payload: {
            userId: this.userId,
            isMuted: this._isMuted,
            isVideoOff: this._isVideoOff,
            isScreenSharing: this._isScreenSharing
        }
    }).catch(() => {});
};

// ── HANDLE VIDEO UPGRADE (voice → video) ─────────────────────
AIAssistant.prototype._handleVideoUpgrade = function() {
    this._callType = 'video';
    if (this._el.videoContainer)   this._el.videoContainer.style.display   = 'block';
    if (this._el.overlayAvatar)    this._el.overlayAvatar.style.display    = 'none';
    if (this._el.videoToggleBtn)   this._el.videoToggleBtn.style.display   = 'inline-block';
    if (this._el.switchToVideoBtn) this._el.switchToVideoBtn.style.display = 'none';
    this._autoAcquireVideo();
};

// ── AUTO-ACQUIRE VIDEO ───────────────────────────────────────
AIAssistant.prototype._autoAcquireVideo = async function() {
    if (!this._callPeer || !this._callId) return;
    try {
        console.log('[CALL] Auto-acquiring video...');
        const videoStream = await navigator.mediaDevices.getUserMedia({
            video: { width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30 }, facingMode: 'user' }
        });
        const videoTrack = videoStream.getVideoTracks()[0];
        if (!videoTrack) return;

        // Remove any existing video tracks from localStream first (prevent duplicates)
        if (this._localStream) {
            this._localStream.getVideoTracks().forEach(old => {
                this._localStream.removeTrack(old);
                old.stop();
            });
            this._localStream.addTrack(videoTrack);
        } else {
            this._localStream = videoStream;
        }

        // ALWAYS use replaceTrack, never addTrack
        const sender = this._getVideoSender();
        if (sender) {
            await sender.replaceTrack(videoTrack);
        } else {
            this._callPeer.addTrack(videoTrack, this._localStream);
        }

        if (this._el.localVideo) {
            this._el.localVideo.srcObject = this._localStream;
            this._el.localVideo.style.display = 'block';
        }
        this._isVideoOff = false;
        this._broadcastCallState();
        console.log('[CALL] Video acquired successfully');
    } catch (err) {
        console.warn('[CALL] Auto-acquire video failed:', err.message);
    }
};

// ── TOGGLE MUTE ──────────────────────────────────────────────
AIAssistant.prototype.callToggleMute = function() {
    if (!this._localStream) return;
    this._isMuted = !this._isMuted;
    this._localStream.getAudioTracks().forEach(t => { t.enabled = !this._isMuted; });
    console.log('[CALL] Mute:', this._isMuted);
    if (this._el.muteBtn) {
        this._el.muteBtn.textContent = this._isMuted ? '🔇 Unmute' : '🎤 Mute';
        this._el.muteBtn.style.background = this._isMuted ? '#ef4444' : '#374151';
    }
    this._broadcastCallState();
};

// ── TOGGLE VIDEO ─────────────────────────────────────────────
AIAssistant.prototype.callToggleVideo = function() {
    if (!this._localStream) return;
    this._isVideoOff = !this._isVideoOff;
    this._localStream.getVideoTracks().forEach(t => { t.enabled = !this._isVideoOff; });
    console.log('[CALL] Video off:', this._isVideoOff);
    if (this._el.videoToggleBtn) {
        this._el.videoToggleBtn.textContent = this._isVideoOff ? '📹 Start Video' : '📹 Stop Video';
        this._el.videoToggleBtn.style.background = this._isVideoOff ? '#ef4444' : '#374151';
    }
    if (this._el.localVideo) this._el.localVideo.style.display = this._isVideoOff ? 'none' : 'block';
    this._broadcastCallState();
};

// ── CALL TIMER ───────────────────────────────────────────────
AIAssistant.prototype._startCallTimer = function() {
    if (this._callTimer) return;
    this._callStartTime = Date.now();
    if (this._el.callTimer) this._el.callTimer.style.display = 'block';
    this._callTimer = setInterval(() => {
        const secs = Math.floor((Date.now() - this._callStartTime) / 1000);
        const h = Math.floor(secs / 3600);
        const m = Math.floor((secs % 3600) / 60);
        const s = secs % 60;
        const str = h > 0
            ? `${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`
            : `${m}:${String(s).padStart(2,'0')}`;
        if (this._el.callTimer) this._el.callTimer.textContent = str;
    }, 1000);
};

// ── SWITCH VOICE → VIDEO ─────────────────────────────────────
AIAssistant.prototype.callSwitchToVideo = async function() {
    if (!this._callPeer || !this._callId) return;
    try {
        console.log('[CALL] Switching to video...');
        const videoStream = await navigator.mediaDevices.getUserMedia({
            video: { width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30 }, facingMode: 'user' }
        });
        const videoTrack = videoStream.getVideoTracks()[0];
        if (!videoTrack) throw new Error('No camera track');

        // Remove existing video tracks to prevent duplicates
        if (this._localStream) {
            this._localStream.getVideoTracks().forEach(old => { this._localStream.removeTrack(old); old.stop(); });
            this._localStream.addTrack(videoTrack);
        } else {
            this._localStream = videoStream;
        }

        // ALWAYS use replaceTrack
        const sender = this._getVideoSender();
        if (sender) {
            await sender.replaceTrack(videoTrack);
        } else {
            this._callPeer.addTrack(videoTrack, this._localStream);
        }

        if (this._el.localVideo) { this._el.localVideo.srcObject = this._localStream; this._el.localVideo.style.display = 'block'; }
        if (this._el.videoContainer)   this._el.videoContainer.style.display   = 'block';
        if (this._el.overlayAvatar)    this._el.overlayAvatar.style.display    = 'none';
        if (this._el.videoToggleBtn)   this._el.videoToggleBtn.style.display   = 'inline-block';
        if (this._el.switchToVideoBtn) this._el.switchToVideoBtn.style.display = 'none';
        this._callType = 'video';
        this._isVideoOff = false;

        // Update DB + broadcast
        await this.supabase.from('calls').update({ call_type: 'video' }).eq('id', this._callId).catch(() => {});
        if (this._callStateCh) {
            this._callStateCh.send({
                type: 'broadcast', event: 'call-state',
                payload: { userId: this.userId, isMuted: this._isMuted, isVideoOff: false, isScreenSharing: false, switchedToVideo: true }
            }).catch(() => {});
        }
        console.log('[CALL] Switched to video');
    } catch (err) {
        this.showNotification('Error', 'Could not enable camera: ' + (err.message || 'Check permissions'));
    }
};

// ── SCREEN SHARE ─────────────────────────────────────────────
AIAssistant.prototype.callShareScreen = async function() {
    if (!this._callPeer || !this._callId) return;
    if (this._isScreenSharing) { this._stopScreenShare(); return; }

    try {
        console.log('[CALL] Starting screen share...');
        const screenStream = await navigator.mediaDevices.getDisplayMedia({
            video: { cursor: 'always', width: { ideal: 1920 }, height: { ideal: 1080 } },
            audio: false
        });
        const screenTrack = screenStream.getVideoTracks()[0];
        if (!screenTrack) throw new Error('No screen track');

        // Save current camera track for later restore (keep it alive, don't stop it)
        this._savedCamTrack = this._localStream?.getVideoTracks()[0] || null;

        // ALWAYS use replaceTrack — never addTrack for screen share
        const sender = this._getVideoSender();
        if (sender) {
            await sender.replaceTrack(screenTrack);
            console.log('[CALL] Replaced video sender track with screen track');
        } else {
            // Last resort: add track (will trigger renegotiation)
            this._callPeer.addTrack(screenTrack, screenStream);
            console.log('[CALL] Added screen track as new sender');
        }

        this._screenStream = screenStream;
        this._isScreenSharing = true;

        // Show screen preview locally (use a new MediaStream with only the screen track)
        if (this._el.localVideo) {
            this._el.localVideo.srcObject = new MediaStream([screenTrack]);
            this._el.localVideo.style.display = 'block';
        }
        if (this._el.screenShareBtn) { this._el.screenShareBtn.textContent = '🖥️ Stop Share'; this._el.screenShareBtn.style.background = '#ef4444'; }
        if (this._el.videoContainer) this._el.videoContainer.style.display = 'block';
        if (this._el.overlayAvatar)  this._el.overlayAvatar.style.display  = 'none';

        this._broadcastCallState();
        console.log('[CALL] Screen sharing started');

        screenTrack.onended = () => this._stopScreenShare();
    } catch (err) {
        if (err.name !== 'NotAllowedError') {
            this.showNotification('Error', 'Screen sharing failed: ' + (err.message || ''));
        }
    }
};

AIAssistant.prototype._stopScreenShare = async function() {
    if (!this._isScreenSharing) return;
    console.log('[CALL] Stopping screen share...');
    this._isScreenSharing = false;

    // Stop screen stream tracks
    if (this._screenStream) { this._screenStream.getTracks().forEach(t => t.stop()); this._screenStream = null; }

    if (this._el.screenShareBtn) { this._el.screenShareBtn.textContent = '🖥️ Share Screen'; this._el.screenShareBtn.style.background = '#374151'; }

    // Restore camera track via replaceTrack on the SAME sender
    if (this._callPeer) {
        // Find the video sender (it currently has the now-stopped screen track)
        const sender = this._callPeer.getSenders().find(s => s.track === null || s.track?.kind === 'video' || s.track?.readyState === 'ended');
        if (sender) {
            if (this._savedCamTrack && this._savedCamTrack.readyState === 'live') {
                await sender.replaceTrack(this._savedCamTrack).catch(e => console.warn('[CALL] Restore cam err:', e));
                console.log('[CALL] Restored camera track');
            } else if (this._callType === 'video') {
                // Camera track died, get a new one
                try {
                    const newCamStream = await navigator.mediaDevices.getUserMedia({
                        video: { width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30 }, facingMode: 'user' }
                    });
                    const newCamTrack = newCamStream.getVideoTracks()[0];
                    if (newCamTrack) {
                        await sender.replaceTrack(newCamTrack);
                        if (this._localStream) {
                            const old = this._localStream.getVideoTracks()[0];
                            if (old) { this._localStream.removeTrack(old); }
                            this._localStream.addTrack(newCamTrack);
                        }
                        console.log('[CALL] Got new camera track after screen share');
                    }
                } catch(_) {
                    await sender.replaceTrack(null).catch(() => {});
                }
            } else {
                // Voice call: send null (no video needed)
                await sender.replaceTrack(null).catch(() => {});
                console.log('[CALL] Set video sender to null (voice call)');
            }
        }
    }
    this._savedCamTrack = null;

    // Restore local video preview
    if (this._el.localVideo) {
        if (this._callType === 'video' && this._localStream) {
            this._el.localVideo.srcObject = this._localStream;
            this._el.localVideo.style.display = 'block';
        } else {
            this._el.localVideo.srcObject = null;
            this._el.localVideo.style.display = 'none';
        }
    }
    if (this._callType !== 'video') {
        if (this._el.videoContainer) this._el.videoContainer.style.display = 'none';
        if (this._el.overlayAvatar)  this._el.overlayAvatar.style.display  = 'flex';
    }
    this._broadcastCallState();
};

// ── RENEGOTIATION (perfect negotiation pattern) ──────────────
AIAssistant.prototype._setupRenegotiation = function(isCaller) {
    this._isCaller = isCaller;
    this._renegoInProgress = false;
    if (!this._callId || !this._callPeer) return;

    if (this._renegoCh) { this.supabase.removeChannel(this._renegoCh); this._renegoCh = null; }

    this._renegoCh = this.supabase.channel(`call-renego-${this._callId}`)
        .on('broadcast', { event: 'renego-offer' }, async ({ payload }) => {
            if (!this._callPeer || !payload?.offer || payload.senderId === this.userId) return;
            try {
                const isStable = this._callPeer.signalingState === 'stable';
                if (!isStable) {
                    if (this._isCaller) return; // impolite peer ignores
                    await this._callPeer.setLocalDescription({ type: 'rollback' });
                }
                await this._callPeer.setRemoteDescription(new RTCSessionDescription(payload.offer));
                const answer = await this._callPeer.createAnswer();
                await this._callPeer.setLocalDescription(answer);
                this._renegoCh.send({ type: 'broadcast', event: 'renego-answer', payload: { answer, senderId: this.userId } }).catch(() => {});
            } catch (e) { console.warn('[CALL] renego-offer err:', e); }
        })
        .on('broadcast', { event: 'renego-answer' }, async ({ payload }) => {
            if (!this._callPeer || !payload?.answer || payload.senderId === this.userId) return;
            try {
                if (this._callPeer.signalingState !== 'have-local-offer') return;
                await this._callPeer.setRemoteDescription(new RTCSessionDescription(payload.answer));
                this._renegoInProgress = false;
            } catch (e) { console.warn('[CALL] renego-answer err:', e); }
        })
        .subscribe();

    this._callPeer.onnegotiationneeded = async () => {
        if (!this._callPeer || !this._renegoCh || this._renegoInProgress) return;
        if (this._callPeer.signalingState !== 'stable') return;
        this._renegoInProgress = true;
        console.log('[CALL] Negotiation needed, creating offer...');
        try {
            const offer = await this._callPeer.createOffer();
            await this._callPeer.setLocalDescription(offer);
            this._renegoCh.send({ type: 'broadcast', event: 'renego-offer', payload: { offer, senderId: this.userId } }).catch(() => {});
        } catch (e) {
            console.warn('[CALL] onnegotiationneeded err:', e);
            this._renegoInProgress = false;
        }
    };
};

// ── FLIP CAMERA (mobile front/back) ─────────────────────────
AIAssistant.prototype.callFlipCamera = async function() {
    if (!this._callPeer || !this._localStream) return;
    this._facingMode = this._facingMode === 'user' ? 'environment' : 'user';
    try {
        const newStream = await navigator.mediaDevices.getUserMedia({
            audio: false, video: { facingMode: { exact: this._facingMode } }
        });
        const newTrack = newStream.getVideoTracks()[0];
        if (!newTrack) { this._facingMode = this._facingMode === 'user' ? 'environment' : 'user'; return; }

        const oldTrack = this._localStream.getVideoTracks()[0];
        if (oldTrack) { this._localStream.removeTrack(oldTrack); oldTrack.stop(); }
        this._localStream.addTrack(newTrack);

        const sender = this._callPeer.getSenders().find(s => s.track?.kind === 'video');
        if (sender) await sender.replaceTrack(newTrack);
        if (this._el.localVideo) this._el.localVideo.srcObject = this._localStream;
    } catch (err) {
        this._facingMode = this._facingMode === 'user' ? 'environment' : 'user';
        this.showNotification('Error', 'Could not flip camera: ' + (err.message || 'Not supported'));
    }
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
        await this.supabase.from(table).delete().eq('id', id).catch(() => {});
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
