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
        this.userName = null;
        
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
            
            // Memory
            memoryEnabled: false
        };
    }

    // ONLY for temporary UI state (modal open/close, loading flags)
    loadUIState() {
        try {
            const saved = localStorage.getItem('voidzenzi_ui_state');
            return saved ? JSON.parse(saved) : { sidebarOpen: true };
        } catch {
            return { sidebarOpen: true };
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
        this.chatMemoryStatus = document.getElementById('chatMemoryStatus');
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
        this.memoryStatusText = document.getElementById('memoryStatusText');
    }

    async initializeApp() {
        console.log('🚀 INITIALIZING APP...');
        console.log('🔐 USER ID:', this.userId);
        console.log('🔐 SUPABASE CLIENT:', this.supabase ? 'EXISTS' : 'MISSING');
        
        if (!this.userId || !this.supabase) {
            console.error('❌ CRITICAL: Missing userId or supabase client');
            alert('Authentication error. Please log in again.');
            window.location.href = 'login.html';
            return;
        }
        
        // Load user info (plan, coins, referral)
        await this.loadUserInfo();
        await this.loadReferralInfo();
        
        // Update coin counter
        this.updateCoinCounter();
        
        // Load settings from Supabase
        await this.loadSettingsFromSupabase();
        this.applySettings();
        this.updateMemoryStatus();
        
        // Load chats from Supabase - CRITICAL: Must load after auth verified
        await this.loadChats();
        
        // If there are existing chats, don't auto-select one - let user choose
        // This ensures proper message isolation
        
        // Setup realtime subscriptions
        this.setupRealtimeSubscriptions();
        
        // Initialize other features
        this.initTextToSpeech();
        this.initSpeechRecognition();
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
                .select('plan, coins, invites_count, is_admin, username, email')
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
                        const response = await fetch(`${this.apiUrl}/users/create`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                userId: this.userId,
                                email: authUser.user.email
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
            if (memoryEl) memoryEl.textContent = this.settings.memoryEnabled ? 'ON' : 'OFF';
            
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
            alert(`You already have the ${plan.toUpperCase()} plan equipped!`);
            this.closeShopModal();
            return;
        }
        
        // For "Buy" actions, check if user has enough coins
        if (this.userPlan !== plan && price > 0) {
            if (this.userCoins < price) {
                alert(`Not enough coins! You need ${price} coins but only have ${this.userCoins}.`);
                return;
            }
        }
        
        // Confirm the action
        let actionText = this.userPlan === 'free' ? 'Upgrade to' : 'Switch to';
        if (this.userPlan === plan) {
            actionText = 'Equip';
        }
        
        if (!confirm(`${actionText} ${plan.toUpperCase()} plan?` + (price > 0 && this.userPlan !== plan ? ` This will cost ${price} coins.` : ''))) {
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
                alert(`Successfully equipped ${plan.toUpperCase()} plan!`);
            } else {
                alert(`Successfully upgraded to ${plan.toUpperCase()} plan!`);
            }
        } catch (error) {
            console.error('Failed to buy/equip plan:', error);
            alert(`Failed to ${this.userPlan === plan ? 'equip' : 'upgrade'}: ${error.message}`);
        }
    }

    updateCoinCounter() {
        if (this.coinAmount) {
            this.coinAmount.textContent = this.userCoins || 0;
        }
    }

    updateMemoryStatus() {
        if (!this.memoryStatusText) return;
        
        // CRITICAL: Get the actual value from settings AND check the toggle
        const memoryToggle = document.getElementById('memoryEnabled');
        const toggleValue = memoryToggle ? memoryToggle.checked : false;
        const settingsValue = this.settings.memoryEnabled || false;
        
        // Use toggle value if it exists, otherwise use settings value
        const isEnabled = memoryToggle ? toggleValue : settingsValue;
        
        // Sync settings with toggle if they differ
        if (memoryToggle && this.settings.memoryEnabled !== toggleValue) {
            console.log('🧠 SYNCING MEMORY SETTING - Toggle:', toggleValue, 'Settings:', this.settings.memoryEnabled);
            this.settings.memoryEnabled = toggleValue;
        }
        
        console.log('🧠 MEMORY STATUS UPDATE - Enabled:', isEnabled, 'Toggle:', toggleValue, 'Settings:', settingsValue);
        
        const statusDiv = document.getElementById('memoryStatus');
        
        if (isEnabled) {
            this.memoryStatusText.textContent = 'ON - Memory is being stored';
            if (statusDiv) {
                statusDiv.style.background = '#d4edda';
                statusDiv.style.color = '#155724';
            }
        } else {
            this.memoryStatusText.textContent = 'OFF - No memory stored';
            if (statusDiv) {
                statusDiv.style.background = '#f8d7da';
                statusDiv.style.color = '#721c24';
            }
        }

        // Update chat header memory status
        if (this.chatMemoryStatus) {
            if (isEnabled && this.currentChatId) {
                this.chatMemoryStatus.textContent = '🧠 Memory ON';
                this.chatMemoryStatus.style.color = '#10b981';
            } else {
                this.chatMemoryStatus.textContent = '';
            }
        }
    }

    copyReferralCode() {
        if (!this.referralCodeDisplay) return;
        this.referralCodeDisplay.select();
        document.execCommand('copy');
        alert('Referral code copied to clipboard!');
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
        
        // Delete account button
        const deleteAccountBtn = document.getElementById('deleteAccountBtn');
        if (deleteAccountBtn) {
            deleteAccountBtn.addEventListener('click', () => this.deleteAccount());
        }
        if (this.logoutBtn) {
            this.logoutBtn.addEventListener('click', () => this.handleLogout());
        }
        if (this.clearMemoryBtn) {
            this.clearMemoryBtn.addEventListener('click', () => this.clearMemory());
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
            { id: 'errorFreeMode', key: 'errorFreeMode' },
            { id: 'memoryEnabled', key: 'memoryEnabled', special: true } // Special handling for memory
        ];

        toggles.forEach(({ id, key, special }) => {
            const el = document.getElementById(id);
            if (el) {
                el.addEventListener('change', async (e) => {
                    const newValue = e.target.checked;
                    console.log(`🔄 TOGGLE CHANGED - ${id}:`, newValue);
                    this.settings[key] = newValue;
                    this.applySettings();
                    
                    // Special handling for memory toggle
                    if (special && id === 'memoryEnabled') {
                        console.log('🧠 MEMORY TOGGLE CHANGED:', newValue);
                        this.settings.memoryEnabled = newValue;
                        this.updateMemoryStatus();
                    }
                    
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
        this.sidebar.classList.add('open');
        this.sidebarOverlay.classList.add('show');
        this.uiState.sidebarOpen = true;
        this.saveUIState();
    }

    closeSidebar() {
        this.sidebar.classList.remove('open');
        this.sidebarOverlay.classList.remove('show');
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
            alert('Please enter a chat name');
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
            alert('Failed to create chat. Please try again.');
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
            this.updateMemoryStatus();
            
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
            alert(`Failed to load chat: ${error.message}`);
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
                console.error('❌ ERROR DETAILS:', JSON.stringify(error, null, 2));
                
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
                    alert(errorMsg);
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
            alert('Error: Not authenticated');
            return;
        }

        if (!confirm('Are you sure you want to delete this chat? All messages will be permanently deleted.')) {
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

            console.log('🗑️ DELETING MEMORIES for chat:', chatId);
            // Delete memories for this chat
            const { error: memoriesError } = await this.supabase
                .from('memories')
                .delete()
                .eq('chat_id', chatId)
                .eq('user_id', this.userId);

            if (memoriesError) {
                console.warn('⚠️ Failed to delete memories (non-critical):', memoriesError);
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
            alert(`Failed to delete chat: ${error.message}`);
        }
    }

    async deleteAccount() {
        if (!confirm('⚠️ WARNING: This will permanently delete your account and ALL your data (chats, messages, coins, settings, etc.).\n\nThis action CANNOT be undone!\n\nAre you absolutely sure?')) {
            return;
        }
        
        if (!confirm('This is your LAST chance to cancel. Click OK to permanently delete your account.')) {
            return;
        }
        
        try {
            const response = await fetch(`${this.apiUrl}/users/delete`, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: this.userId })
            });
            
            if (response.ok) {
                alert('Account deleted successfully. You will be logged out now.');
                // Sign out and redirect
                await this.supabase.auth.signOut();
                window.location.href = 'login.html';
            } else {
                const error = await response.json();
                throw new Error(error.error || 'Failed to delete account');
            }
        } catch (error) {
            console.error('Delete account error:', error);
            alert(`Failed to delete account: ${error.message}`);
        }
    }

    async clearCurrentChat() {
        if (!this.currentChatId) {
            this.newChat();
            return;
        }

        if (!confirm('Are you sure you want to clear all messages in this chat? This cannot be undone.')) {
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

            // Delete memories for this chat
            const { error: memoriesError } = await this.supabase
                .from('memories')
                .delete()
                .eq('chat_id', this.currentChatId)
                .eq('user_id', this.userId);

            if (memoriesError) {
                console.warn('⚠️ Failed to clear memories (non-critical):', memoriesError);
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
            alert(`Failed to clear chat: ${error.message}`);
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
    // MESSAGE HANDLING (STRICT SUPABASE)
    // ============================================
    async handleSend() {
        if (!this.userInput) return;
        const message = this.userInput.value.trim();
        if (!message) return;

        // ENFORCE: Must have a chat before sending
        if (!this.currentChatId) {
            // Automatically create a new chat with the first message as the name
            await this.createAutoNamedChat(message);
        }

        // Add user message to UI
        this.addMessageToUI(message, 'user', true);
        this.userInput.value = '';
        if (this.sendButton) this.sendButton.disabled = true;

        // Save user message to Supabase
        await this.saveMessageToSupabase(message, 'user');

        // Remove welcome message
        const welcomeMsg = this.chatContainer.querySelector('.welcome-message');
        if (welcomeMsg) welcomeMsg.remove();

        // Show typing indicator
        let typingId = null;
        if (this.settings.typingIndicator) {
            typingId = this.showTypingIndicator();
        }

        try {
            // Check if image mode is enabled
            if (this.settings.imageMode) {
                // Generate image instead of text response
                const response = await fetch(`${this.apiUrl}/image`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ 
                        prompt: message, 
                        userId: this.userId,
                        mode: this.settings.imageModeType || 'normal'
                    })
                });

                if (typingId) this.hideTypingIndicator(typingId);

                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.error || 'Failed to generate image');
                }

                const data = await response.json();
                
                // Add image to UI
                // Don't escape SVG data URLs as they contain special characters
                const escapedUrl = data.imageUrl.startsWith('data:image/svg+xml') ? data.imageUrl : this.escapeHtml(data.imageUrl);
                const imageHtml = `<div class="message-image"><img src="${escapedUrl}" alt="Generated image" style="max-width: 100%; border-radius: 8px;"></div>`;
                this.addMessageToUI(imageHtml, 'assistant', true);
                
                // Save image URL as message content
                await this.saveMessageToSupabase(`[Image Generated] ${data.imageUrl}`, 'assistant');
                
                // Refresh user data to update tokens
                await this.loadUserInfo();
                this.updateUserProfile();
                
                this.playSound('receive');
            } else {
                // Get conversation history from Supabase
                const history = await this.getConversationHistory();

                // Call AI API
                const response = await fetch(`${this.apiUrl}/chat`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        message: message,
                        history: history,
                        simpleLanguage: this.settings.simpleLanguage,
                        mode: this.settings.chatMode || 'fast',
                        mood: this.settings.mood || 'friendly',
                        errorFreeMode: this.settings.errorFreeMode
                    })
                });

                if (typingId) this.hideTypingIndicator(typingId);

                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.error || 'Failed to get response');
                }

                const data = await response.json();
                
                // Add AI response to UI
                this.addMessageToUI(data.response, 'assistant', true);
                
                // Save AI response to Supabase
                await this.saveMessageToSupabase(data.response, 'assistant');
                
                this.playSound('receive');
            }
        } catch (error) {
            if (typingId) this.hideTypingIndicator(typingId);
            this.showErrorMessage(error.message || 'Failed to communicate with AI');
        } finally {
            if (this.sendButton) this.sendButton.disabled = false;
            if (this.userInput) this.userInput.focus();
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

    async saveMessageToSupabase(content, role) {
        console.log('💬 SAVING MESSAGE - role:', role, 'chatId:', this.currentChatId, 'userId:', this.userId);
        console.log('💬 MESSAGE CONTENT LENGTH:', content ? content.length : 0);
        
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
            const { data: messageData, error } = await this.supabase
                .from('messages')
                .insert({
                    user_id: this.userId,        // CRITICAL: User ID
                    chat_id: this.currentChatId, // CRITICAL: Chat ID
                    role: role,
                    content: content.trim()
                })
                .select()
                .single();

            console.log('💬 MESSAGE SAVE RESULT:', messageData);
            console.log('💬 MESSAGE SAVE ERROR:', error);

            if (error) {
                console.error('❌ MESSAGE SAVE FAILED:', error);
                
                // Check if it's a table not found error
                if (error.message && ((error.message.includes('relation') || error.message.includes('table') || error.message.includes('schema cache')) && error.message.includes('does not exist'))) {
                    const errorMsg = `CRITICAL: Messages table doesn't exist in database!\n\n` +
                        `Error: ${error.message}\n\n` +
                        `Please run the SQL from FIX_MESSAGES_TABLE.sql in Supabase SQL Editor.\n\n` +
                        `Go to: Supabase Dashboard → SQL Editor → New Query → Paste SQL → Run`;
                    alert(errorMsg);
                    this.showErrorMessage(`Messages table not found: ${error.message}`);
                } else if (error.message && (error.message.includes('permission denied') || error.message.includes('policy'))) {
                    const errorMsg = `Permission Error: Row Level Security (RLS) is blocking message saves.\n\n` +
                        `Error: ${error.message}\n\n` +
                        `Please check RLS policies for the messages table in Supabase Dashboard.\n\n` +
                        `The policy should allow users to INSERT their own messages.`;
                    alert(errorMsg);
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

            // Save memory if enabled
            if (this.settings.memoryEnabled && role === 'assistant') {
                console.log('🧠 MEMORY SAVE ENABLED - Saving memory to Supabase');
                await this.saveMemory(content);
            } else if (this.settings.memoryEnabled) {
                console.log('🧠 MEMORY ENABLED but role is not assistant, skipping');
            } else {
                console.log('🧠 MEMORY DISABLED - Not saving');
            }
            
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

    async saveMemory(content) {
        if (!this.settings.memoryEnabled || !this.currentChatId || !this.userId) {
            console.log('🧠 Memory save skipped - enabled:', this.settings.memoryEnabled, 'chatId:', this.currentChatId, 'userId:', this.userId);
            return;
        }

        console.log('🧠 SAVING MEMORY - chatId:', this.currentChatId);

        try {
            const { data, error } = await this.supabase
                .from('memories')
                .insert({
                    user_id: this.userId,
                    chat_id: this.currentChatId,
                    memory_type: 'short_term',
                    content: content.substring(0, 500) // Limit memory size
                });

            console.log('🧠 MEMORY SAVE RESULT:', data);
            console.log('🧠 MEMORY SAVE ERROR:', error);

            if (error) {
                console.error('❌ Failed to save memory:', error);
            } else {
                console.log('✅ Memory saved successfully');
            }
        } catch (error) {
            console.error('❌ Failed to save memory:', error);
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
        
        const formattedText = text.replace(/\n/g, '<br>');
        const shouldTypeEffect = sender === 'assistant' &&
            this.settings.typingEffect &&
            this.settings.animations &&
            !text.includes('<');

        if (shouldTypeEffect && animate) {
            contentDiv.innerHTML = '';
            this.typeText(contentDiv, text);
        } else {
            contentDiv.innerHTML = formattedText;
        }

        if (sender === 'assistant' && this.settings.ttsEnabled) {
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
            
            // Update memory toggle - CRITICAL: Sync UI with settings
            const memoryToggle = document.getElementById('memoryEnabled');
            if (memoryToggle) {
                const memoryEnabled = this.settings.memoryEnabled || false;
                memoryToggle.checked = memoryEnabled;
                console.log('🧠 MEMORY TOGGLE SYNCED - UI:', memoryEnabled, 'Settings:', this.settings.memoryEnabled);
            }
            
            // Update memory status AFTER toggle is synced
            this.updateMemoryStatus();
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
            'errorFreeMode': this.settings.errorFreeMode,
            'memoryEnabled': this.settings.memoryEnabled
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

    showSettings() {
        this.chatView.classList.remove('active');
        this.settingsView.classList.add('active');
        this.loadSettingsToForm();
    }

    // ============================================
    // MEMORY MANAGEMENT (STRICT SUPABASE)
    // ============================================
    async clearMemory() {
        if (!confirm('Are you sure you want to clear all memory? This cannot be undone.')) {
            return;
        }

        try {
            const { error } = await this.supabase
                .from('memories')
                .delete()
                .eq('user_id', this.userId);

            if (error) throw error;
            alert('Memory cleared successfully');
        } catch (error) {
            console.error('Failed to clear memory:', error);
            alert('Failed to clear memory');
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
            alert('Voice input not supported');
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
        if (!confirm('Are you sure you want to logout?')) return;

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

    new AIAssistant();
});
