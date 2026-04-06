require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const Groq = require('groq-sdk');
const { createClient } = require('@supabase/supabase-js');

// Web Push (optional — needs VAPID keys in .env)
let webPush = null;
try {
    webPush = require('web-push');
    if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
        webPush.setVapidDetails(
            'mailto:' + (process.env.VAPID_EMAIL || 'admin@voidzenzi.com'),
            process.env.VAPID_PUBLIC_KEY,
            process.env.VAPID_PRIVATE_KEY
        );
        console.log('✅ Web Push (VAPID) initialized');
    } else {
        console.log('⚠️  VAPID keys not set — push notifications disabled. Add VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_EMAIL to .env');
        webPush = null;
    }
} catch(_) {
    console.log('⚠️  web-push not installed — run: npm install web-push');
}

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.text({ type: 'text/plain' }));

// ============================================
// CONFIGURATION
// ============================================

const supabaseUrl     = process.env.SUPABASE_URL;
const supabaseKey     = process.env.SUPABASE_ANON_KEY;
const supabaseService = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Missing SUPABASE_URL or SUPABASE_ANON_KEY — set them in Render environment variables');
    process.exit(1);
}

const supabase      = createClient(supabaseUrl, supabaseKey);
const supabaseAdmin = supabaseService
    ? createClient(supabaseUrl, supabaseService)
    : supabase;

const PLAN_LIMITS = {
    free: { messages: 100, images: 20, memories: 50, codeGenerations: 30 },
    pro: { messages: 1000, images: 200, memories: 500, codeGenerations: 300 },
    ultra: { messages: -1, images: -1, memories: -1, codeGenerations: -1 }
};

// ============================================
// GROQ CLIENT (the ONLY AI provider)
// ============================================

let groqClient = null;
if (process.env.GROQ_API_KEY) {
    try {
        groqClient = new Groq({ apiKey: process.env.GROQ_API_KEY });
        console.log('✅ Groq client initialized');
    } catch (e) {
        console.error('Failed to initialize Groq client:', e);
    }
}

const VISION_MODEL = 'meta-llama/llama-4-scout-17b-16e-instruct';
const CHAT_MODEL = process.env.GROQ_MODEL_FAST || 'llama-3.1-8b-instant';

// ============================================
// IMAGE MEMORY — remembers the last image per user
// so they don't have to re-upload for follow-ups
// ============================================
const imageMemory = new Map(); // userId -> imageData (base64)

// ============================================
// STATIC FILES
// ============================================

// Serve React build from client/dist
const reactBuildPath = path.join(__dirname, 'client', 'dist');
app.use(express.static(reactBuildPath));

// ============================================
// HEALTH CHECK
// ============================================

app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        message: 'voidzen AI Assistant server is running',
        providers: { groq: !!groqClient }
    });
});

// ============================================
// IMAGE ENDPOINT — send image + exact prompt to Groq vision
// ============================================

app.post('/api/image', async (req, res) => {
    try {
        const { prompt, userId, imageData } = req.body;

        if (!prompt || !prompt.trim()) {
            return res.status(400).json({ error: 'Prompt is required' });
        }

        // Use uploaded image, OR fall back to remembered image for this user
        let image = imageData;
        if (image) {
            // New image uploaded — save it to memory
            const memKey = userId || 'anonymous';
            imageMemory.set(memKey, image);
            console.log('📷 New image uploaded and saved to memory for:', memKey);
        } else {
            // No image uploaded — try to use the remembered one
            const memKey = userId || 'anonymous';
            image = imageMemory.get(memKey);
            if (image) {
                console.log('📷 Using remembered image for:', memKey);
            } else {
                return res.status(400).json({ error: 'No image uploaded and no previous image found. Please upload an image.' });
            }
        }

        console.log('📨 POST /api/image | prompt:', prompt.substring(0, 80));
        console.log('📨 Image data length:', image.length);

        if (!groqClient) {
            return res.status(500).json({ error: 'Groq client not initialized. Set GROQ_API_KEY in .env' });
        }

        // ── Send image + exact prompt straight to Groq Vision ──
        // Groq handles EVERYTHING: analysis, description, questions, enhancement requests
        const response = await groqClient.chat.completions.create({
            model: VISION_MODEL,
            messages: [
                {
                    role: 'system',
                    content: 'You are voidzen AI, a helpful AI assistant created by Srinikesh. The user uploaded an image. Do exactly what they ask — analyze it, describe it, answer questions about it, suggest improvements, or anything else. Be direct and helpful.'
                },
                {
                    role: 'user',
                    content: [
                        { type: 'text', text: prompt },
                        { type: 'image_url', image_url: { url: image } }
                    ]
                }
            ],
            temperature: 0.7,
            max_tokens: 1024
        });

        const aiResponse = response.choices[0].message.content;
        console.log('✅ Groq vision response received');

        return res.json({
            response: aiResponse,
            provider: 'Groq',
            type: 'image_analysis',
            prompt: prompt
        });

    } catch (error) {
        console.error('❌ Image endpoint error:', error.message);
        return res.status(500).json({
            error: 'Failed to process image',
            details: error.message
        });
    }
});

// ============================================
// CHAT ENDPOINT — Groq for everything
// Also handles "make me an image" / "show me X" by
// telling the user to upload or use picture mode
// ============================================

app.post('/api/chat', async (req, res) => {
    try {
        const { message, history, simpleLanguage, mode, command, mood, errorFreeMode, userId, systemPrompt: userSystemPrompt } = req.body;

        if (!message || !message.trim()) {
            return res.status(400).json({ error: 'Message is required' });
        }

        if (!groqClient) {
            return res.status(500).json({ error: 'Groq client not initialized. Set GROQ_API_KEY in .env' });
        }

        // Check if user has a remembered image and is talking about it
        const memKey = userId || 'anonymous';
        const rememberedImage = imageMemory.get(memKey);

        // If user has a remembered image, check if they're talking about it
        if (rememberedImage) {
            try {
                const intentCheck = await groqClient.chat.completions.create({
                    model: CHAT_MODEL,
                    messages: [
                        {
                            role: 'system',
                            content: `The user previously uploaded an image. Decide if their new message is about that image or about something else entirely.
A) ABOUT THE IMAGE — they're asking about, referencing, or wanting changes to the image (examples: "make it better", "what else is in it", "can you describe the colors", "now make it 3d", "improve the lighting", "zoom in on the left side")
B) NOT ABOUT THE IMAGE — they're asking a completely different question unrelated to any image (examples: "what is 2+2", "tell me a joke", "write me python code", "who is einstein")

Reply with ONLY the letter A or B.`
                        },
                        { role: 'user', content: `User's message: "${message}"` }
                    ],
                    temperature: 0,
                    max_tokens: 3
                });

                const intent = intentCheck.choices[0].message.content.trim().toUpperCase();
                console.log(`🧠 Chat intent (has remembered image): ${intent}`);

                if (intent.startsWith('A')) {
                    // User is talking about their remembered image — send to Groq Vision
                    console.log('📷 User is referencing their remembered image, sending to Groq Vision...');

                    const visionResponse = await groqClient.chat.completions.create({
                        model: VISION_MODEL,
                        messages: [
                            {
                                role: 'system',
                                content: 'You are voidzen AI, a helpful AI assistant created by Srinikesh. The user previously uploaded this image and is now asking a follow-up about it. Do exactly what they ask — analyze, describe, answer questions, etc. Be direct and helpful.'
                            },
                            {
                                role: 'user',
                                content: [
                                    { type: 'text', text: message },
                                    { type: 'image_url', image_url: { url: rememberedImage } }
                                ]
                            }
                        ],
                        temperature: 0.7,
                        max_tokens: 1024
                    });

                    return res.json({
                        response: visionResponse.choices[0].message.content,
                        provider: 'Groq (Vision)',
                        type: 'image_analysis'
                    });
                }
            } catch (intentError) {
                console.error('⚠️ Intent check failed, continuing as normal chat:', intentError.message);
            }
        }

        // Normal text chat
        const conversationHistory = history || [];
        conversationHistory.push({ role: 'user', content: message });

        let systemPrompt = userSystemPrompt || `You are voidzen AI, a helpful AI assistant created by Srinikesh that follows these guidelines:
- Your name is voidzen AI - when asked about your identity, name, or who created you, respond with "I am voidzen AI", "My name is voidzen AI", or "I was created by Srinikesh" as appropriate
- Give clear and correct answers to simple questions directly
- Understand and remember context from the conversation
- Be helpful and accurate in your responses
- Say "I don't know" instead of making things up
- Respond quickly and efficiently
- Use simple, easy-to-understand language when requested
- Provide accurate reasoning and correct conclusions
- Use your general knowledge for basic questions without unnecessary searching
- Explain mistakes clearly if something goes wrong
- Maintain a polite and neutral, respectful tone (not robotic)
- Avoid harmful or dangerous content
- When asked about your identity, name, or creator, always maintain your identity as voidzen AI created by Srinikesh
- Do not reveal technical details about underlying AI providers - maintain consistent voidzen AI branding
`;

        let finalPrompt = systemPrompt;

        if (simpleLanguage) finalPrompt += '\nIMPORTANT: The user has requested simple language. Explain everything in easy-to-understand terms, using everyday words.';

        if (mode === 'coding') finalPrompt += '\nIMPORTANT: The user is in coding mode. Prefer concise, correct code examples, focus on implementation, and return code blocks where helpful.';
        else if (mode === 'detailed') finalPrompt += '\nIMPORTANT: The user is in detailed mode. Provide more in-depth explanations and longer, more complete answers.';
        else if (mode === 'fast') finalPrompt += '\nIMPORTANT: The user is in fast mode. Prioritize short, direct answers over long explanations.';

        if (mood === 'friendly') finalPrompt += '\nTone: Be warm, friendly, and encouraging, while staying clear and respectful.';
        else if (mood === 'serious') finalPrompt += '\nTone: Be serious and professional, without jokes.';
        else if (mood === 'funny') finalPrompt += '\nTone: Be light and a bit funny, but never offensive or distracting from the main answer.';
        else if (mood === 'calm') finalPrompt += '\nTone: Be calm, reassuring, and relaxed.';

        if (errorFreeMode) finalPrompt += '\nIf you are not sure or do not know, say exactly: "I don\'t know yet, but here\'s what I can explain." and then give your best partial explanation.';

        if (command === 'short') finalPrompt += '\nCOMMAND: Answer in 1-2 short sentences only.';
        else if (command === 'simple') finalPrompt += '\nCOMMAND: Explain in very simple language, as if to a young student. Use at most 2-3 short sentences.';
        else if (command === 'notes') finalPrompt += '\nCOMMAND: Reply only as short bullet-point notes.';

        const messages = [
            { role: 'system', content: finalPrompt },
            ...conversationHistory
        ];

        const completion = await groqClient.chat.completions.create({
            model: CHAT_MODEL,
            messages: messages,
            temperature: 0.7,
            max_tokens: 800
        });

        const aiResponse = completion.choices[0].message.content;
        console.log('✅ Groq chat success!');

        return res.json({
            response: aiResponse,
            provider: 'Groq'
        });

    } catch (error) {
        console.error('Error in chat endpoint:', error);

        let errorMessage = 'I apologize, but I encountered an error while processing your request.';
        let statusCode = 500;

        if (error.status || error.response?.status) {
            const errorStatus = error.status || error.response.status;
            if (errorStatus === 401) { errorMessage = 'API authentication failed. Please check your GROQ_API_KEY in .env.'; statusCode = 401; }
            else if (errorStatus === 429) { errorMessage = 'Rate limit exceeded. Please wait a moment and try again.'; statusCode = 429; }
            else if (errorStatus === 400) { errorMessage = `Invalid request: ${error.message}`; statusCode = 400; }
        } else if (error.message) {
            errorMessage = `Error: ${error.message}`;
        }

        return res.status(statusCode).json({ error: errorMessage, details: error.message || 'Unknown error' });
    }
});

// ============================================
// MEMORY SYSTEM — store & retrieve user info
// ============================================

// GET /api/memory — load all stored memory for a user
app.get('/api/memory', async (req, res) => {
    try {
        const userId = req.query.userId;
        if (!userId) return res.status(400).json({ success: false, error: 'userId required' });

        // Fetch profile
        const { data: profile } = await supabase
            .from('user_profiles')
            .select('*')
            .eq('user_id', userId)
            .single();

        // Fetch custom terms
        const { data: customTerms } = await supabase
            .from('user_custom_terms')
            .select('*')
            .eq('user_id', userId);

        // Fetch relationships
        const { data: relationships } = await supabase
            .from('user_relationships')
            .select('*')
            .eq('user_id', userId);

        // Fetch private facts
        const { data: privateFacts } = await supabase
            .from('user_private_facts')
            .select('*')
            .eq('user_id', userId);

        const memory = {
            profile: profile || null,
            customTerms: customTerms || [],
            relationships: relationships || [],
            privateFacts: privateFacts || []
        };

        console.log('🧠 Memory loaded for user:', userId, '| profile:', !!profile, '| facts:', (privateFacts || []).length);

        return res.json({ success: true, memory });
    } catch (error) {
        console.error('❌ Memory load error:', error.message);
        return res.json({ success: true, memory: { profile: null, customTerms: [], relationships: [], privateFacts: [] } });
    }
});

// POST /api/memory/extract — use Groq to extract info from user message and save it
app.post('/api/memory/extract', async (req, res) => {
    try {
        const { userId, message } = req.body;
        if (!userId || !message) return res.status(400).json({ success: false, error: 'userId and message required' });
        if (!groqClient) return res.status(500).json({ success: false, error: 'Groq not initialized' });

        // Ask Groq to extract personal info from the message
        const extraction = await groqClient.chat.completions.create({
            model: CHAT_MODEL,
            messages: [
                {
                    role: 'system',
                    content: `You extract personal information from user messages to build a memory profile. Analyze the message and return ONLY valid JSON (no markdown, no explanation).

Return this exact structure (include ONLY fields you find in the message, leave others null/empty):
{
  "profile": {
    "name": null,
    "job_title": null,
    "profession": null,
    "interests": [],
    "hobbies": [],
    "skills": [],
    "favorite_apps": [],
    "favorite_technologies": [],
    "favorite_games": [],
    "favorite_sports": [],
    "favorite_shows": [],
    "vehicles": [],
    "personality_style": null,
    "location": null,
    "age": null
  },
  "customTerms": [],
  "relationships": [],
  "privateFacts": []
}

Rules:
- customTerms: [{"term": "word", "meaning": "what it means"}] — only if user defines slang/nicknames
- relationships: [{"person_name": "name", "relationship_type": "friend/brother/etc", "notes": "optional detail"}]
- privateFacts: [{"fact": "something important", "category": "general"}]
- Only extract what is EXPLICITLY stated. Never guess or invent.
- If the message contains NO personal info, return: {"nothing": true}
- Arrays should only contain items found in this specific message.`
                },
                { role: 'user', content: message }
            ],
            temperature: 0,
            max_tokens: 500
        });

        let extracted;
        try {
            const raw = extraction.choices[0].message.content.trim();
            // Strip markdown code fences if Groq wraps it
            const cleaned = raw.replace(/^```json?\s*\n?/i, '').replace(/\n?```\s*$/i, '');
            extracted = JSON.parse(cleaned);
        } catch (parseErr) {
            console.log('🧠 No memory to extract (parse failed)');
            return res.json({ success: true, saved: false });
        }

        // If nothing to extract
        if (extracted.nothing) {
            return res.json({ success: true, saved: false });
        }

        let saved = false;

        // Save/update profile
        if (extracted.profile) {
            const p = extracted.profile;
            // Check if profile exists
            const { data: existing } = await supabase
                .from('user_profiles')
                .select('*')
                .eq('user_id', userId)
                .single();

            if (existing) {
                // Merge: append arrays, update non-null scalars
                const merged = { ...existing };
                const arrayFields = ['interests', 'hobbies', 'skills', 'favorite_apps', 'favorite_technologies', 'favorite_games', 'favorite_sports', 'favorite_shows', 'vehicles'];

                for (const field of arrayFields) {
                    if (p[field]?.length > 0) {
                        const existingArr = existing[field] || [];
                        const newItems = p[field].filter(item => !existingArr.includes(item));
                        merged[field] = [...existingArr, ...newItems];
                    }
                }

                const scalarFields = ['name', 'job_title', 'profession', 'personality_style', 'location', 'age'];
                for (const field of scalarFields) {
                    if (p[field]) merged[field] = p[field];
                }

                merged.updated_at = new Date().toISOString();

                await supabase.from('user_profiles').update(merged).eq('user_id', userId);
                saved = true;
                console.log('🧠 Profile UPDATED for:', userId);
            } else {
                // Check if there's anything worth saving
                const hasData = Object.entries(p).some(([k, v]) => {
                    if (Array.isArray(v)) return v.length > 0;
                    return v !== null && v !== undefined;
                });
                if (hasData) {
                    await supabase.from('user_profiles').insert({
                        user_id: userId,
                        ...p,
                        created_at: new Date().toISOString(),
                        updated_at: new Date().toISOString()
                    });
                    saved = true;
                    console.log('🧠 Profile CREATED for:', userId);
                }
            }
        }

        // Save custom terms
        if (extracted.customTerms?.length > 0) {
            for (const term of extracted.customTerms) {
                await supabase.from('user_custom_terms').upsert({
                    user_id: userId,
                    term: term.term,
                    meaning: term.meaning,
                    updated_at: new Date().toISOString()
                }, { onConflict: 'user_id, term' });
            }
            saved = true;
            console.log('🧠 Custom terms saved:', extracted.customTerms.length);
        }

        // Save relationships
        if (extracted.relationships?.length > 0) {
            for (const rel of extracted.relationships) {
                await supabase.from('user_relationships').upsert({
                    user_id: userId,
                    person_name: rel.person_name,
                    relationship_type: rel.relationship_type,
                    notes: rel.notes || null,
                    updated_at: new Date().toISOString()
                }, { onConflict: 'user_id, person_name' });
            }
            saved = true;
            console.log('🧠 Relationships saved:', extracted.relationships.length);
        }

        // Save private facts
        if (extracted.privateFacts?.length > 0) {
            for (const fact of extracted.privateFacts) {
                // Avoid duplicates by checking if fact already exists
                const { data: existingFacts } = await supabase
                    .from('user_private_facts')
                    .select('fact')
                    .eq('user_id', userId)
                    .ilike('fact', fact.fact);

                if (!existingFacts || existingFacts.length === 0) {
                    await supabase.from('user_private_facts').insert({
                        user_id: userId,
                        fact: fact.fact,
                        category: fact.category || 'general',
                        created_at: new Date().toISOString()
                    });
                }
            }
            saved = true;
            console.log('🧠 Private facts saved:', extracted.privateFacts.length);
        }

        return res.json({ success: true, saved });

    } catch (error) {
        console.error('❌ Memory extraction error:', error.message);
        return res.status(500).json({ success: false, error: error.message });
    }
});

// ============================================
// USER CREATION — ensures public.users row exists
// ============================================

app.post('/api/users/create', async (req, res) => {
    try {
        const { userId, email, username, avatar_url } = req.body;
        if (!userId || !email) {
            return res.status(400).json({ success: false, error: 'userId and email required' });
        }

        const displayName = username || email.split('@')[0];

        const upsertData = {
            id: userId,
            email: email,
            username: displayName,
            plan: 'free',
            coins: 0,
            invites_count: 0,
            is_admin: false,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        };
        if (avatar_url) upsertData.avatar_url = avatar_url;

        // Upsert: create if not exists, update email/username if exists
        // Use supabaseAdmin (service key) to bypass RLS — server has no user session
        const { data, error } = await supabaseAdmin
            .from('users')
            .upsert(upsertData, { onConflict: 'id' });

        if (error) {
            console.error('User create error:', error);
            return res.status(500).json({ success: false, error: error.message });
        }

        console.log('✅ User record created/updated for:', email);
        return res.json({ success: true });
    } catch (error) {
        console.error('User create endpoint error:', error);
        return res.status(500).json({ success: false, error: error.message });
    }
});

// ============================================
// UPDATE AVATAR
// ============================================

app.post('/api/users/update-avatar', async (req, res) => {
    try {
        const { userId, avatar_url } = req.body;
        if (!userId || !avatar_url) {
            return res.status(400).json({ success: false, error: 'userId and avatar_url required' });
        }

        const { error } = await supabaseAdmin
            .from('users')
            .update({ avatar_url, updated_at: new Date().toISOString() })
            .eq('id', userId);

        if (error) {
            console.error('Avatar update error:', error);
            return res.status(500).json({ success: false, error: error.message });
        }

        return res.json({ success: true });
    } catch (error) {
        console.error('Avatar update endpoint error:', error);
        return res.status(500).json({ success: false, error: error.message });
    }
});

// ============================================
// ADMIN ENDPOINTS — require is_admin flag
// Uses service-role client to bypass RLS
// ============================================

// Helper: verify the requesting user is an admin
async function verifyAdmin(adminUserId) {
    if (!adminUserId) return false;
    const { data, error } = await supabaseAdmin
        .from('users')
        .select('is_admin, email')
        .eq('id', adminUserId)
        .single();
    if (error || !data) return false;
    const isAdminEmail = (data.email || '').toLowerCase() === 'howtotutorialbysreenikesh@gmail.com';
    return data.is_admin === true || isAdminEmail;
}

// GET /api/admin/users — list all users
app.get('/api/admin/users', async (req, res) => {
    try {
        const { userId } = req.query;
        if (!(await verifyAdmin(userId))) {
            return res.status(403).json({ error: 'Admin access required' });
        }

        const { data: users, error } = await supabaseAdmin
            .from('users')
            .select('id, email, username, plan, coins, is_admin, created_at')
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Admin list users error:', error);
            return res.status(500).json({ error: error.message });
        }

        return res.json({ users: users || [] });
    } catch (error) {
        console.error('Admin users endpoint error:', error);
        return res.status(500).json({ error: error.message });
    }
});

// POST /api/admin/update-user — update any user's fields
app.post('/api/admin/update-user', async (req, res) => {
    try {
        const { adminUserId, targetUserId, updates } = req.body;

        if (!targetUserId || !updates) {
            return res.status(400).json({ error: 'targetUserId and updates required' });
        }

        if (!(await verifyAdmin(adminUserId))) {
            return res.status(403).json({ error: 'Admin access required' });
        }

        // Only allow safe fields to be updated
        const allowed = ['username', 'plan', 'coins', 'is_admin'];
        const safeUpdates = {};
        for (const key of allowed) {
            if (key in updates) safeUpdates[key] = updates[key];
        }
        safeUpdates.updated_at = new Date().toISOString();

        const { error } = await supabaseAdmin
            .from('users')
            .update(safeUpdates)
            .eq('id', targetUserId);

        if (error) {
            console.error('Admin update user error:', error);
            return res.status(500).json({ error: error.message });
        }

        console.log(`✅ Admin updated user ${targetUserId}:`, safeUpdates);
        return res.json({ success: true });
    } catch (error) {
        console.error('Admin update-user endpoint error:', error);
        return res.status(500).json({ error: error.message });
    }
});

// DELETE /api/admin/delete-user — remove a user record
app.delete('/api/admin/delete-user', async (req, res) => {
    try {
        const { adminUserId, targetUserId } = req.body;

        if (!targetUserId) {
            return res.status(400).json({ error: 'targetUserId required' });
        }

        if (!(await verifyAdmin(adminUserId))) {
            return res.status(403).json({ error: 'Admin access required' });
        }

        // Prevent admin from deleting themselves
        if (adminUserId === targetUserId) {
            return res.status(400).json({ error: 'Cannot delete your own account' });
        }

        const { error } = await supabaseAdmin
            .from('users')
            .delete()
            .eq('id', targetUserId);

        if (error) {
            console.error('Admin delete user error:', error);
            return res.status(500).json({ error: error.message });
        }

        console.log(`✅ Admin deleted user ${targetUserId}`);
        return res.json({ success: true });
    } catch (error) {
        console.error('Admin delete-user endpoint error:', error);
        return res.status(500).json({ error: error.message });
    }
});

// ============================================
// ============================================
// PUBLIC CONFIG — only safe/public values (anon key is fine client-side)
// The SERVICE key and GROQ key are NEVER sent here
// ============================================

app.get('/api/config', (req, res) => {
    res.json({
        supabaseUrl:     process.env.SUPABASE_URL,
        supabaseAnonKey: process.env.SUPABASE_ANON_KEY,
    });
});

// ============================================
// WEB PUSH — subscribe + send
// ============================================

// Client fetches the VAPID public key to create a push subscription
app.get('/api/push/vapid-key', (req, res) => {
    res.json({ key: process.env.VAPID_PUBLIC_KEY || null });
});

// Save a user's push subscription
app.post('/api/push/subscribe', async (req, res) => {
    try {
        const { userId, subscription } = req.body;
        if (!userId || !subscription) return res.status(400).json({ error: 'Missing userId or subscription' });
        const { error } = await supabaseAdmin.from('push_subscriptions')
            .upsert({ user_id: userId, subscription, updated_at: new Date().toISOString() }, { onConflict: 'user_id' });
        return res.json({ success: !error });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

// Internal helper — send push to a user (fire-and-forget)
async function sendPushToUser(userId, payload) {
    if (!webPush) return;
    try {
        const { data } = await supabaseAdmin.from('push_subscriptions').select('subscription').eq('user_id', userId).single();
        if (data?.subscription) {
            await webPush.sendNotification(data.subscription, JSON.stringify(payload));
        }
    } catch (e) {
        // subscription expired or user not subscribed — remove stale entry
        if (e.statusCode === 410) {
            await supabaseAdmin.from('push_subscriptions').delete().eq('user_id', userId).catch(() => {});
        }
    }
}

// Start call — insert row into calls table AND push-notify the callee
app.post('/api/start-call', async (req, res) => {
    try {
        const { callerId, calleeId, callType, offer } = req.body;
        if (!callerId || !calleeId || !callType || !offer) return res.status(400).json({ error: 'Missing fields' });

        const { data: row, error } = await supabaseAdmin.from('calls').insert({
            caller_id: callerId, callee_id: calleeId, call_type: callType, status: 'ringing', offer
        }).select().single();
        if (error) return res.status(500).json({ error: error.message });

        // Send push to callee (non-blocking)
        (async () => {
            try {
                const { data: caller } = await supabaseAdmin.from('users').select('username,email').eq('id', callerId).single();
                const name = caller?.username || caller?.email?.split('@')[0] || 'Someone';
                await sendPushToUser(calleeId, {
                    title: callType === 'video' ? '📹 Incoming Video Call' : '📞 Incoming Voice Call',
                    body: `${name} is calling you — open voidzenzi to answer`,
                    tag: 'incoming-call',
                    requireInteraction: true,
                    vibrate: [500, 200, 500, 200, 500],
                    url: '/'
                });
            } catch(e) { /* non-fatal */ }
        })();

        return res.json({ success: true, callId: row.id, callRow: row });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

// ============================================
// END CALL (called via sendBeacon on page unload)
// ============================================

app.post('/api/end-call', async (req, res) => {
    try {
        // sendBeacon sends text/plain, regular fetch sends application/json
        let callId;
        if (typeof req.body === 'string') {
            try { callId = JSON.parse(req.body).callId; } catch (_) { callId = null; }
        } else {
            callId = req.body?.callId;
        }
        if (!callId) return res.status(400).json({ error: 'callId required' });
        await supabaseAdmin.from('calls').update({ status: 'ended' }).eq('id', callId).neq('status', 'ended');
        return res.json({ success: true });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

// ============================================
// START SERVER
// ============================================

// React SPA catch-all (must be after all API routes)
const fs = require('fs');
if (fs.existsSync(path.join(reactBuildPath, 'index.html'))) {
    app.get('*', (req, res) => {
        res.sendFile(path.join(reactBuildPath, 'index.html'));
    });
}

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`🚀 voidzen AI Assistant server running on http://localhost:${PORT}`);
    console.log(`✅ Groq client: ${groqClient ? 'initialized' : 'NOT initialized'}`);
    console.log(`📝 Make sure to set GROQ_API_KEY in your .env file`);
});
