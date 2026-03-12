const express = require('express');
const cors = require('cors');
const OpenAI = require('openai');
const { createClient } = require('@supabase/supabase-js');
const path = require('path');
const multer = require('multer');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' })); // Increased limit for image uploads
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(express.static(__dirname));

// Configure multer for image uploads
const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 10 * 1024 * 1024 // 10MB limit
    },
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('Only image files are allowed'), false);
        }
    }
});

// Initialize OpenAI client
const openai = process.env.OPENAI_API_KEY ? new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
}) : null;

// Initialize Together AI client (for image analysis - you have credits)
let togetherClient = null;
if (process.env.TOGETHER_API_KEY) {
    try {
        const Together = require('together-ai');
        togetherClient = new Together({
            apiKey: process.env.TOGETHER_API_KEY
        });
        console.log(' Together AI client initialized');
    } catch (e) {
        console.error('Failed to initialize Together AI client:', e);
    }
}

// Initialize OpenRouter client (backup for image analysis)
let openrouterClient = null;
if (process.env.OPENROUTER_API_KEY) {
    try {
        const OpenAI = require('openai');
        openrouterClient = new OpenAI({
            apiKey: process.env.OPENROUTER_API_KEY,
            baseURL: 'https://openrouter.ai/api/v1'
        });
        console.log(' OpenRouter client initialized (backup)');
    } catch (e) {
        console.error('Failed to initialize OpenRouter client:', e);
    }
}

// Initialize Groq client (for all chat messages)
let groqClient = null;
if (process.env.GROQ_API_KEY) {
    try {
        const Groq = require('groq-sdk');
        groqClient = new Groq({
            apiKey: process.env.GROQ_API_KEY
        });
        console.log(' Groq client initialized for chat');
    } catch (e) {
        console.error('Failed to initialize Groq client:', e);
    }
}

// Initialize Supabase (for admin operations)
const supabase = process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_KEY ? createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
) : null;

// Plan limits
const PLAN_LIMITS = {
    free: {
        tokens: 50,
        messages: 50,  // Changed from 500 to 50
        images: 5,
        codeGenerations: 5,
        memories: 10
    },
    pro: {
        tokens: 500,
        messages: 500,  // 10x free (50 * 10)
        images: 50,    // 10x free (5 * 10)
        codeGenerations: 50,
        memories: 100
    },
    ultra: {
        tokens: -1, // unlimited
        messages: -1, // unlimited
        images: -1,   // unlimited
        codeGenerations: -1,
        memories: -1   // unlimited
    }
};

// Conversation history is now managed by Supabase on the client side

// Helper to choose model based on mode (Groq only for chat)
function getModelsForMode(mode) {
    const selected = mode || 'fast';

    // Groq models for all chat messages
    const groqModels = {
        fast: process.env.GROQ_MODEL_FAST || 'llama-3.1-8b-instant',
        detailed: process.env.GROQ_MODEL_DETAILED || 'llama-3.1-8b-instant',
        coding: process.env.GROQ_MODEL_CODING || 'llama-3.1-8b-instant'
    };

    return {
        groqModel: groqModels[selected] || groqModels.fast
    };
}

function tryOfflineAnswer(message, command) {
    const text = (message || '').trim();
    if (!text) return null;

    const lower = text.toLowerCase();

    // Check for special "Who am I?" questions
        if (userSystemPrompt && (text.toLowerCase().includes('who am i') || text.toLowerCase().includes('what is my name'))) {
            // Extract user name from the system prompt if available
            const nameMatch = userSystemPrompt.match(/The user's name is (\w+)/i);
            if (nameMatch) {
                const userName = nameMatch[1];
                return res.json({
                    response: `You are ${userName}!`,
                    provider: 'context-aware'
                });
            }
        }

        // Greetings
    if (/^(hi|hello|hey)\b/.test(lower)) {
        return 'Hi! I’m your AI assistant. How can I help you today?';
    }

    // Very small fact set
    if (lower.includes('capital of france')) {
        return 'The capital of France is Paris.';
    }
    if (lower.includes('largest planet')) {
        return 'The largest planet in our solar system is Jupiter.';
    }

    // Basic math solver (safe evaluation of simple expressions)
    const mathCandidate = text.replace(/\s+/g, '');
    if (/^[0-9+\-*/().]+$/.test(mathCandidate)) {
        try {
            // eslint-disable-next-line no-new-func
            const result = Function(`"use strict"; return (${mathCandidate});`)();
            if (typeof result === 'number' && isFinite(result)) {
                if (command === 'solve') {
                    return `Let’s solve it step by step.\nExpression: ${text}\nAnswer: ${result}`;
                }
                return `The result is ${result}.`;
            }
        } catch (e) {
            // ignore, fall through
        }
    }

    return null;
}

// API endpoint to chat with AI
app.post('/api/chat', async (req, res) => {
    try {
        const { message, history, simpleLanguage, mode, command, mood, errorFreeMode, userId, systemPrompt: userSystemPrompt } = req.body;

        // Track usage if userId provided
        if (userId && supabase) {
            const usageRes = await fetch(`${req.protocol}://${req.get('host')}/api/usage/track`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId, type: 'message' })
            });
            
            if (!usageRes.ok) {
                const errorData = await usageRes.json();
                if (usageRes.status === 403) {
                    return res.status(403).json({ 
                        error: 'Message limit exceeded. Please upgrade your plan.',
                        limitExceeded: true
                    });
                }
            }
        }

        if (!message || !message.trim()) {
            return res.status(400).json({ 
                error: 'Message is required' 
            });
        }

        // Check if Groq API is configured for chat
        if (!process.env.GROQ_API_KEY) {
            const offline = tryOfflineAnswer(message, command);
            if (offline) {
                return res.json({
                    response: offline,
                    provider: 'offline'
                });
            }

            return res.status(500).json({ 
                error: 'No AI API key configured. Please set GROQ_API_KEY in your .env file for chat functionality.' 
            });
        }

        // Use provided history or create new
        const conversationHistory = history || [];
        
        // Add user message to history
        conversationHistory.push({
            role: 'user',
            content: message
        });

        // Prepare system prompt based on guidelines
        let baseSystemPrompt = userSystemPrompt || `You are voidzen AI, a helpful AI assistant created by Srinikesh that follows these guidelines:
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

        // Build personalized system prompt with user memory
        let systemPrompt = await buildPersonalizedPrompt(userId, baseSystemPrompt);

        // Extract and save memory from this message (async, don't wait)
        if (userId && message) {
            extractMemoryFromMessage(message, null).then(extracted => {
                if (extracted) {
                    mergeMemoryWithProfile(userId, extracted);
                }
            });
        }

        if (simpleLanguage) {
            systemPrompt += '\nIMPORTANT: The user has requested simple language. Explain everything in easy-to-understand terms, using everyday words.';
        }

        if (mode === 'coding') {
            systemPrompt += '\nIMPORTANT: The user is in coding mode. Prefer concise, correct code examples, focus on implementation, and return code blocks where helpful.';
        } else if (mode === 'detailed') {
            systemPrompt += '\nIMPORTANT: The user is in detailed mode. Provide more in-depth explanations and longer, more complete answers.';
        } else if (mode === 'picture') {
            systemPrompt += '\nIMPORTANT: The user is in picture mode. Respond with visual descriptions and image-related content.';
        } else if (mode === 'code') {
            systemPrompt += '\nIMPORTANT: The user is in code mode. Use for coding assistance, provide detailed code examples, and focus on programming solutions.';
        } else if (mode === 'fast') {
            systemPrompt += '\nIMPORTANT: The user is in fast mode. Prioritize short, direct answers over long explanations.';
        }

        // Mood-based replies
        if (mood === 'friendly') {
            systemPrompt += '\nTone: Be warm, friendly, and encouraging, while staying clear and respectful.';
        } else if (mood === 'serious') {
            systemPrompt += '\nTone: Be serious and professional, without jokes.';
        } else if (mood === 'funny') {
            systemPrompt += '\nTone: Be light and a bit funny, but never offensive or distracting from the main answer.';
        } else if (mood === 'calm') {
            systemPrompt += '\nTone: Be calm, reassuring, and relaxed.';
        }

        // Error-free mode
        if (errorFreeMode) {
            systemPrompt += '\nIf you are not sure or do not know, say exactly: "I don\'t know yet, but here\'s what I can explain." and then give your best partial explanation.';
        }

        // Command-based behaviors
        if (command === 'short') {
            systemPrompt += '\nCOMMAND: Answer in 1–2 short sentences only.';
        } else if (command === 'simple') {
            systemPrompt += '\nCOMMAND: Explain in very simple language, as if to a young student. Use at most 2–3 short sentences.';
        } else if (command === 'notes') {
            systemPrompt += '\nCOMMAND: Reply only as short bullet-point notes.';
        } else if (command === 'solve') {
            systemPrompt += '\nCOMMAND: Act as a math solver. Show steps clearly, then the final answer.';
        } else if (command === 'translate') {
            systemPrompt += '\nCOMMAND: Translate between English and Hindi. Detect the direction automatically. For a single word, give meanings in both languages; for sentences, translate the full sentence clearly.';
        } else if (command === 'define') {
            systemPrompt += '\nCOMMAND: Give a short dictionary-style definition first, then one real-life example sentence.';
        } else if (command === 'eli5') {
            systemPrompt += '\nCOMMAND: Explain like I am 5 years old, using one very simple sentence.';
        } else if (command === 'mental') {
            systemPrompt += '\nCOMMAND: For math, explain how to do the calculation mentally in a few clear steps.';
        }

        // Prepare messages for AI
        const messages = [
            { role: 'system', content: systemPrompt },
            ...conversationHistory
        ];

        const { groqModel } = getModelsForMode(mode);

        // Use Groq for all chat messages
        let aiResponse;
        let usedProvider = 'Groq';
        
        try {
            console.log('🚀 Using Groq model:', groqModel);
            const groqCompletion = await groqClient.chat.completions.create({
                messages: messages,
                model: groqModel,
                temperature: 0.7,
                max_tokens: 800
            });
            aiResponse = groqCompletion.choices[0].message.content;
            usedProvider = 'Groq';
            console.log('✅ Groq API success!');
        } catch (groqError) {
            console.error('❌ Groq failed:', groqError.message);
            throw groqError;
        }

        // Add AI response to history
        conversationHistory.push({
            role: 'assistant',
            content: aiResponse
        });

        // Return the exact response from the AI
        res.json({ 
            response: aiResponse,
            provider: usedProvider
        });

    } catch (error) {
        console.error('Error calling AI API:', error);
        
        // Clear error handling - explain mistakes clearly
        let errorMessage = 'I apologize, but I encountered an error while processing your request.';
        let statusCode = 500;
        
        if (error.status || error.response?.status) {
            const errorStatus = error.status || error.response.status;
            const errorData = error.response?.data || error.error || {};
            
            if (errorStatus === 401) {
                errorMessage = 'API authentication failed. Please check your API keys in the .env file.';
                statusCode = 401;
            } else if (errorStatus === 429) {
                // Check if it's a quota issue or rate limit
                const errorMsg = errorData.error?.message || error.message || '';
                
                if (errorMsg.includes('quota') || errorMsg.includes('billing')) {
                    errorMessage = 'Quota exceeded: Your OpenAI account has reached its usage limit. Please check your billing and usage at https://platform.openai.com/usage. If you have credits remaining, there may be a billing issue - try adding a payment method or checking your account status.';
                } else {
                    errorMessage = 'Rate limit exceeded: Too many requests. Please wait a moment and try again. The server will automatically retry on rate limits.';
                }
                statusCode = 429;
            } else if (errorStatus === 500 || errorStatus === 502 || errorStatus === 503) {
                errorMessage = 'The AI service is currently unavailable. Please try again in a few moments.';
                statusCode = errorStatus;
            } else if (errorStatus === 400) {
                errorMessage = `Invalid request: ${errorData.error?.message || error.message || 'Please check your message and try again.'}`;
                statusCode = 400;
            }
        } else if (error.message) {
            // Check error message for quota-related keywords
            if (error.message.includes('quota') || error.message.includes('billing')) {
                errorMessage = `Quota/Billing Issue: ${error.message}. Please check your OpenAI account at https://platform.openai.com/account/billing to verify your payment method and usage limits.`;
            } else {
                errorMessage = `Error: ${error.message}`;
            }
        }

        res.status(statusCode).json({ 
            error: errorMessage,
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// Helper function to convert text prompt to emoji representation
function textToEmoji(prompt) {
    const emojiMap = {
        // Animals
        'bird': '🐦', 'birds': '🐦', 'duck': '🦆', 'eagle': '🦅', 'owl': '🦉', 'parrot': '🦜',
        'cat': '🐱', 'cats': '🐱', 'kitten': '🐱', 'lion': '🦁', 'tiger': '🐯', 'dog': '🐶',
        'fish': '🐟', 'whale': '🐋', 'shark': '🦈', 'turtle': '🐢', 'frog': '🐸',
        'horse': '🐴', 'cow': '🐮', 'pig': '🐷', 'sheep': '🐑', 'elephant': '🐘',
        'monkey': '🐵', 'gorilla': '🦍', 'chimp': '🦧', 'zebra': '🦓', 'giraffe': '🦒',
        // Nature
        'tree': '🌳', 'flower': '🌸', 'rose': '🌹', 'sunflower': '🌻', 'tulip': '🌷',
        'mountain': '⛰️', 'river': '🌊', 'lake': '💧', 'cloud': '☁️', 'rainbow': '🌈',
        'sun': '☀️', 'moon': '🌙', 'star': '⭐', 'fire': '🔥', 'snow': '❄️',
        // Objects
        'house': '🏠', 'car': '🚗', 'boat': '🚤', 'plane': '✈️', 'train': '🚂',
        'book': '📚', 'computer': '💻', 'phone': '📱', 'camera': '📷',
        'food': '🍎', 'pizza': '🍕', 'cake': '🎂', 'coffee': '☕', 'wine': '🍷',
        // People
        'person': '👤', 'people': '👥', 'man': '👨', 'woman': '👩', 'child': '👶',
        'family': '👪', 'couple': '💑', 'friend': '🤝', 'love': '❤️',
        // Animals
        'chicken': '🐔', 'rooster': '🐓', 'turkey': '🦃', 'duck': '🦆', 'eagle': '🦅', 'owl': '🦉', 'parrot': '🦜',
        'cat': '🐱', 'cats': '🐱', 'kitten': '🐱', 'lion': '🦁', 'tiger': '🐯', 'dog': '🐶',
        'fish': '🐟', 'whale': '🐋', 'shark': '🦈', 'turtle': '🐢', 'frog': '🐸',
        'horse': '🐴', 'cow': '🐮', 'pig': '🐷', 'sheep': '🐑', 'elephant': '🐘',
        'monkey': '🐵', 'gorilla': '🦍', 'chimp': '🦧', 'zebra': '🦓', 'giraffe': '🦒',
        // Abstract concepts
        'happy': '😊', 'sad': '😢', 'angry': '😠', 'surprised': '😲',
        'love': '😍', 'cool': '😎', 'sleep': '😴', 'party': '🎉',
        'music': '🎵', 'dance': '💃', 'sports': '⚽', 'art': '🎨',
        'work': '💼', 'money': '💰', 'time': '⏰', 'home': '🏠',
        'heart': '❤️', 'smile': '😊', 'laugh': '😂', 'cry': '😭',
        // Emotions
        'joy': '😄', 'funny': '🤣', 'wink': '😉', 'thinking': '🤔',
        'confused': '😕', 'worried': '😟', 'shocked': '😱', 'tired': '😪',
        'angry': '😠', 'mad': '😤', 'devil': '😈', 'angel': '😇',
        'sick': '🤒', 'injured': '🤕', 'bandage': '🩹', 'pill': '💊',
        // Activities
        'running': '🏃', 'walking': '🚶', 'swimming': '🏊', 'dancing': '💃',
        'playing': '🎮', 'reading': '📖', 'writing': '✍️', 'drawing': '🎨',
        'cooking': '🍳', 'eating': '🍽️', 'drinking': '🥤', 'sleeping': '😴',
        // Weather
        'rain': '🌧️', 'storm': '⛈️', 'wind': '💨', 'fog': '🌫️',
        'snowflake': '❄️', 'snowman': '⛄', 'lightning': '⚡',
        'sunny': '☀️', 'partly sunny': '⛅', 'night': '🌙', 'day': '☀️'
    };
    
    // Convert prompt to lowercase for matching
    const lowerPrompt = prompt.toLowerCase();
    
    // Split the prompt into words
    const words = lowerPrompt.split(/[\s,]+/);
    
    // Find relevant emojis
    let emojis = [];
    for (const word of words) {
        if (emojiMap[word]) {
            if (!emojis.includes(emojiMap[word])) { // Avoid duplicates
                emojis.push(emojiMap[word]);
            }
        }
    }
    
    // If no specific emojis found, use a generic art/picture emoji
    if (emojis.length === 0) {
        emojis = ['🎨'];
    }
    
    // Limit to 10 emojis to avoid excessive length
    emojis = emojis.slice(0, 10);
    
    // Create an artistic representation using emojis
    const emojiRows = [];
    
    // First row: all emojis in a grid-like pattern
    if (emojis.length > 0) {
        emojiRows.push(emojis.join(' '));
    }
    
    // Second row: if we have multiple emojis, arrange differently
    if (emojis.length > 2) {
        // Split emojis into two lines for better visual appearance
        const midPoint = Math.ceil(emojis.length / 2);
        const firstHalf = emojis.slice(0, midPoint);
        const secondHalf = emojis.slice(midPoint);
        
        if (firstHalf.length > 0) {
            emojiRows.push(firstHalf.join(' '));
        }
        if (secondHalf.length > 0) {
            emojiRows.push(secondHalf.join(' '));
        }
    } else if (emojis.length === 2) {
        // If only two emojis, put them in separate rows
        emojiRows.push(emojis[0]);
        emojiRows.push(emojis[1]);
    }
    
    // Add a decorative separator
    emojiRows.push('─────');
    
    // Add the original prompt at the bottom
    emojiRows.push(prompt.substring(0, 25) + (prompt.length > 25 ? '...' : ''));
    
    return emojiRows.join('\n');
}

// Helper: analyze image with OpenAI vision (fallback when Gemini fails or is unavailable)
async function analyzeImageWithOpenAI(prompt, imageData, smartPrompt) {
    if (!openai) return null;

    try {
        console.log('🧠 Using OpenAI vision model for image analysis...');

        // Use a configurable vision-capable model, defaulting to gpt-4o-mini
        const visionModel =
            process.env.OPENAI_VISION_MODEL ||
            process.env.OPENAI_MODEL_DETAILED ||
            process.env.OPENAI_MODEL ||
            'gpt-4o-mini';

        const completion = await openai.chat.completions.create({
            model: visionModel,
            messages: [
                { role: 'system', content: smartPrompt },
                {
                    role: 'user',
                    content: [
                        { type: 'text', text: `The user asked: "${prompt}". Carefully look at the image and respond exactly to that.` },
                        {
                            type: 'image_url',
                            image_url: {
                                // OpenAI supports data URLs with base64 image data
                                url: imageData
                            }
                        }
                    ]
                }
            ],
            max_tokens: 800
        });

        const content = completion.choices?.[0]?.message?.content;
        if (!content) {
            console.warn('OpenAI vision returned empty content');
            return null;
        }

        // content may be a string or an array of content parts; normalize to string
        if (typeof content === 'string') return content;
        if (Array.isArray(content)) {
            return content
                .map(part => (typeof part === 'string' ? part : part.text || ''))
                .join(' ')
                .trim();
        }

        return String(content);
    } catch (error) {
        console.error('❌ OpenAI vision analysis failed:', error.message || error);
        return null;
    }
}

// Helper function to analyze uploaded images using OpenRouter (with OpenAI/Groq fallbacks)
async function analyzeImage(req, res, prompt, userId, imageData) {
    try {
        console.log('🔍 ANALYZE IMAGE CALLED');
        console.log('🔍 Prompt:', prompt);
        console.log('🔍 Image data length:', imageData ? imageData.length : 0);
        console.log('🔍 OpenRouter client exists:', !!openrouterClient);
        console.log('🔍 OpenAI client exists:', !!openai);
        console.log('🔍 Groq client exists:', !!groqClient);

        // Track usage if userId provided (count as image generation for limits)
        if (userId && supabase) {
            const { data: user, error: userError } = await supabase
                .from('users')
                .select('plan')
                .eq('id', userId)
                .single();

            if (!userError && user) {
                const limits = PLAN_LIMITS[user.plan || 'free'];
                
                // Get current image usage
                const { data: usage, error: usageError } = await supabase
                    .from('usage_limits')
                    .select('images_used')
                    .eq('user_id', userId)
                    .single();
                
                const imagesUsed = usage?.images_used || 0;
                const imagesLimit = limits.images;
                
                // Check if user has reached image limit
                if (imagesLimit !== -1 && imagesUsed >= imagesLimit) {
                    return res.status(403).json({
                        error: `Image limit reached. Free plan: ${imagesLimit} images, Pro: ${imagesLimit * 10} images, Ultra: Unlimited.`,
                        imagesUsed: imagesUsed,
                        imagesLimit: imagesLimit
                    });
                }

                // Increment image usage
                const newImagesUsed = imagesUsed + 1;
                await supabase
                    .from('usage_limits')
                    .upsert({
                        user_id: userId,
                        images_used: newImagesUsed,
                        updated_at: new Date().toISOString()
                    }, {
                        onConflict: 'user_id',
                        ignoreDuplicates: true
                    });
            }
        }
                
        // Convert the image data URL to base64
        const base64Data = imageData.replace(/^data:image\/[a-zA-Z+]+;base64,/, '');
        const detectedMimeType = imageData.match(/^data:(image\/[a-zA-Z+]+);base64,/)[1];

        // Build a smart dynamic system prompt based on what the user asked
        const smartPrompt = `You are voidzen AI, a helpful AI assistant created by Srinikesh. The user has uploaded an image and asked: "${prompt}"

Your job is to carefully look at the image and respond EXACTLY to what the user asked:

- If they ask "what is written" or "read the text" → Extract and display ALL visible text from the image exactly as written.
- If they ask to "solve", "answer", or "help with questions" → Read the image carefully and solve/answer the question(s) shown.
- If they ask to "describe" or "explain" → Describe what is shown in the image in detail.
- If they ask to "make it more colorful", "make it look better", "enhance", "improve", or similar → Describe exactly how the image should be enhanced (brighter colors, saturation, contrast, etc.) and provide a detailed image generation prompt.
- If they ask something else → Use your best judgment based on the image content.

IMPORTANT:
- Always base your answer on what is actually visible in the image.
- If text is present, read it carefully before responding.
- Be precise, clear, and directly answer what was asked.`;

        // For enhancement requests, use Pollinations.ai directly
        const isEnhancementRequest = /make.*(it|this|image|photo|picture).*(better|colorful|colourful|flashy|nicer|beautiful|vibrant|brighter|cooler|amazing)|enhance|improve.*(image|photo|picture)|add.*(color|colour|effects)/i.test(prompt);

        if (isEnhancementRequest) {
            console.log('🎨 Enhancement request - using Pollinations.ai');
            const encodedPrompt = encodeURIComponent(`${prompt}, vibrant colors, high quality, detailed, photorealistic`);
            const imageUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=512&height=512&nologo=true`;
            return res.json({
                imageUrl: imageUrl,
                response: `Here's an enhanced version based on your request: "${prompt}". Here's the new image:`,
                provider: 'Pollinations.ai (free)',
                type: 'image_generation',
                prompt: prompt
            });
        }

        // Try Groq first for image analysis (it has vision capabilities!)
        if (groqClient) {
            try {
                console.log('🦙 Using Groq for image analysis...');
                console.log('🦙 Model: llama-3.2-90b-vision-instruct');
                console.log('🦙 Image data length:', imageData ? imageData.length : 0);
                
                const userPrompt = `The user asked: "${prompt}". Analyze this image and respond to their question. ${smartPrompt}`;
                
                // Use Groq's vision model for analysis
                const response = await groqClient.chat.completions.create({
                    model: 'llama-3.2-90b-vision-instruct',
                    messages: [
                        { role: 'system', content: smartPrompt },
                        { 
                            role: 'user', 
                            content: [
                                { type: 'text', text: `The user asked: "${prompt}". Analyze this image and respond.` },
                                { 
                                    type: 'image_url', 
                                    image_url: { 
                                        url: imageData 
                                    } 
                                }
                            ]
                        }
                    ],
                    temperature: 0.7,
                    max_tokens: 800
                });
                
                aiResponse = response.choices[0].message.content;
                usedProvider = 'Groq (Vision)';
                console.log('✅ Groq image analysis success!');
            } catch (groqError) {
                console.error('❌ Groq failed:', groqError.message);
                console.error('❌ Full error details:', JSON.stringify(groqError, null, 2));
                
                // Fallback to Together AI
                if (togetherClient) {
                    try {
                        console.log('🔄 Falling back to Together AI...');
                        const response = await togetherClient.chat.completions.create({
                            model: 'Qwen/Qwen2-VL-7B-Instruct',
                            messages: [
                                { role: 'system', content: smartPrompt },
                                { 
                                    role: 'user', 
                                    content: [
                                        { type: 'text', text: `The user asked: "${prompt}". Analyze this image and respond.` },
                                        { 
                                            type: 'image_url', 
                                            image_url: { 
                                                url: imageData 
                                            } 
                                        }
                                    ]
                                }
                            ],
                            temperature: 0.7,
                            max_tokens: 800
                        });
                        
                        aiResponse = response.choices[0].message.content;
                        usedProvider = 'Together AI (Qwen2-VL)';
                        console.log('✅ Together AI fallback success!');
                    } catch (togetherError) {
                        console.error('❌ Together AI failed:', togetherError.message);
                        
                        // Fallback to OpenRouter
                        if (openrouterClient) {
                            try {
                                console.log('🔄 Falling back to OpenRouter...');
                                const completion = await openrouterClient.chat.completions.create({
                                    model: 'meta-llama/llama-3.2-11b-vision-instruct',
                                    messages: [
                                        { role: 'system', content: smartPrompt },
                                        { 
                                            role: 'user', 
                                            content: [
                                                { type: 'text', text: `The user asked: "${prompt}". Analyze this image and respond.` },
                                                { 
                                                    type: 'image_url', 
                                                    image_url: { 
                                                        url: imageData 
                                                    } 
                                                }
                                            ]
                                        }
                                    ],
                                    temperature: 0.7,
                                    max_tokens: 800
                                });
                                
                                aiResponse = completion.choices[0].message.content;
                                usedProvider = 'OpenRouter (Llama-3.2-Vision)';
                                console.log('✅ OpenRouter fallback success!');
                            } catch (openrouterError) {
                                console.error('❌ OpenRouter fallback also failed:', openrouterError.message);
                                
                                // Final fallback to text-only response
                                aiResponse = 'I encountered an issue analyzing the image. Please try again or describe what you need help with.';
                                usedProvider = 'Fallback';
                            }
                        } else {
                            aiResponse = 'Image analysis failed. Please ensure your API keys are valid.';
                            usedProvider = 'None';
                        }
                    }
                } else {
                    // Direct fallback to OpenRouter
                    if (openrouterClient) {
                        try {
                            console.log('🔄 Falling back to OpenRouter...');
                            const completion = await openrouterClient.chat.completions.create({
                                model: 'meta-llama/llama-3.2-11b-vision-instruct',
                                messages: [
                                    { role: 'system', content: smartPrompt },
                                    { 
                                        role: 'user', 
                                        content: [
                                            { type: 'text', text: `The user asked: "${prompt}". Analyze this image and respond.` },
                                            { 
                                                type: 'image_url', 
                                                image_url: { 
                                                    url: imageData 
                                                } 
                                            }
                                        ]
                                    }
                                ],
                                temperature: 0.7,
                                max_tokens: 800
                            });
                            
                            aiResponse = completion.choices[0].message.content;
                            usedProvider = 'OpenRouter (Llama-3.2-Vision)';
                            console.log('✅ OpenRouter fallback success!');
                        } catch (openrouterError) {
                            console.error('❌ OpenRouter fallback also failed:', openrouterError.message);
                            
                            // Final fallback to text-only response
                            aiResponse = 'I encountered an issue analyzing the image. Please try again or describe what you need help with.';
                            usedProvider = 'Fallback';
                        }
                    } else {
                        // Final fallback to text-only response
                        aiResponse = 'I encountered an issue analyzing the image. Please try again or describe what you need help with.';
                        usedProvider = 'Fallback';
                    }
                }
            } else {
                // Fallback to text-only response when all vision APIs fail
                console.log('⚠️ All vision APIs failed, providing helpful text response');
                try {
                    const fallbackCompletion = await groqClient.chat.completions.create({
                        messages: [
                            { role: 'system', content: 'You are a helpful AI assistant. Be honest that you cannot see images directly, but try to help based on the user\'s description.' },
                            { role: 'user', content: `The user uploaded an image and asked: "${prompt}". I cannot see the image right now due to a technical issue with all vision APIs. Please provide a helpful response acknowledging this limitation and offer to help if they describe the image.` }
                        ],
                        model: 'llama-3.1-8b-instant',
                        temperature: 0.7,
                        max_tokens: 300
                    });
                    aiResponse = fallbackCompletion.choices[0].message.content;
                    usedProvider = 'Groq (text-only fallback)';
                } catch (fallbackError) {
                    aiResponse = 'I apologize, but I\'m currently unable to analyze images due to technical issues with all vision APIs. Please describe what you see in the image, and I\'ll be happy to help you with your question: "' + prompt + '"';
                    usedProvider = 'None';
                }
            }
        
        return res.json({
            response: aiResponse,
            provider: usedProvider,
            type: 'image_analysis'
        });
    } catch (error) {
        console.error('Error analyzing image:', error);
        console.error('Full error details:', JSON.stringify(error, null, 2));
        
        return res.status(500).json({
            error: 'Failed to analyze image',
            details: error.message
        });
    }
});

// ============================================
// HELPER FUNCTIONS
// ============================================

// Helper function to format response with emoji
function formatResponse(text, provider) {
    return text;
}

// Helper function to get emoji for provider
function getProviderEmoji(provider) {
    const emojis = {
        'Groq': '🦙',
        'OpenAI': '🤖',
        'Together AI': '🚀',
        'OpenRouter': '🌐',
        'Groq (Vision)': '🦙👁️',
        'Groq (fallback)': '🦙',
        'Fallback': '⚠️'
    };
    return emojis[provider] || '🤖';
}

// Helper function to get models for mode
function getModelsForMode(mode) {
    const selected = mode || 'fast';

    // Groq models only
    const groqModels = {
        fast: process.env.GROQ_MODEL_FAST || 'llama-3.1-8b-instant',
        detailed: process.env.GROQ_MODEL_DETAILED || process.env.GROQ_MODEL || 'llama-3.1-8b-instant',
        coding: process.env.GROQ_MODEL_CODING || process.env.GROQ_MODEL || 'llama-3.1-8b-instant'
    };

    return {
        groqModel: groqModels[selected] || groqModels.fast
    };
}

// Helper function to try offline answer
function tryOfflineAnswer(message, command) {
    // Simple offline responses for basic queries
    const offlineResponses = {
        'hello': 'Hello! I\'m voidzen AI. How can I help you today?',
        'hi': 'Hi there! I\'m voidzen AI. What can I do for you?',
        'help': 'I\'m voidzen AI. I can help with various tasks, but I\'m currently in offline mode. Please try again later.',
        'who are you': 'I am voidzen AI, created by Srinikesh.',
        'what is your name': 'My name is voidzen AI.',
        'bye': 'Goodbye! Have a great day!',
        'exit': 'Goodbye! Feel free to come back anytime.'
    };

    const lowerMessage = message.toLowerCase().trim();
    
    for (const [key, response] of Object.entries(offlineResponses)) {
        if (lowerMessage.includes(key)) {
            return response;
        }
    }

    // Command-specific offline responses
    if (command === 'short' && lowerMessage.length > 20) {
        return 'I\'m currently offline. Please try again later for a detailed response.';
    }

    return null;
}

// Helper function to get random emoji
function getRandomEmoji() {
    const emojis = ['🎉', '🚀', '✨', '🌟', '💫', '🎯', '🎪', '🎨', '🎭', '🎪'];
    return emojis[Math.floor(Math.random() * emojis.length)];
}

// ============================================
// API ENDPOINTS
// ============================================

// API endpoint to generate images from text and analyze uploaded images
app.post('/api/image', async (req, res) => {
    try {
        console.log('📨 POST /api/image received');
        console.log('📨 Request body:', JSON.stringify(req.body, null, 2));
        
        const { prompt, userId, mode, imageData } = req.body;

        if (!prompt || !prompt.trim()) {
            return res.status(400).json({
                error: 'Prompt is required'
            });
        }

        console.log('📨 Image data present:', !!imageData);
        console.log('📨 Image data length:', imageData ? imageData.length : 0);

        // If image data is provided, analyze image instead of generating one
        if (imageData) {
            console.log('📨 Routing to image analysis...');
            return await analyzeImage(req, res, prompt, userId, imageData);
        }

        // Generate image using Pollinations.ai
        const encodedPrompt = encodeURIComponent(prompt);
        const imageUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=512&height=512&nologo=true`;
        
        return res.json({
            imageUrl: imageUrl,
            response: `Here's an image based on your request: "${prompt}"`,
            provider: 'Pollinations.ai (free)',
            type: 'image_generation',
            prompt: prompt
        });
    } catch (error) {
        console.error('Error in image endpoint:', error);
        return res.status(500).json({
            error: 'Failed to process image request',
            details: error.message
        });
    }
});

// ============================================
// CHAT ENDPOINT
// ============================================

app.post('/api/chat', async (req, res) => {
    try {
        const { message, history, simpleLanguage, mode, command, mood, errorFreeMode, userId, systemPrompt: userSystemPrompt } = req.body;

        if (!message || !message.trim()) {
            return res.status(400).json({ 
                error: 'Message is required' 
            });
        }

        // Use provided history or create new
        const conversationHistory = history || [];
        
        // Add user message to history
        conversationHistory.push({
            role: 'user',
            content: message
        });

        // Prepare system prompt
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

        // Build personalized system prompt with user memory
        const personalizedSystemPrompt = await buildPersonalizedPrompt(userId, systemPrompt);

        // Extract and save memory from this message (async, don't wait)
        if (userId && message) {
            extractMemoryFromMessage(message, null).then(extracted => {
                if (extracted) {
                    mergeMemoryWithProfile(userId, extracted);
                }
            });
        }

        let finalPrompt = personalizedSystemPrompt;

        if (simpleLanguage) {
            finalPrompt += '\nIMPORTANT: The user has requested simple language. Explain everything in easy-to-understand terms, using everyday words.';
        }

        if (mode === 'coding') {
            finalPrompt += '\nIMPORTANT: The user is in coding mode. Prefer concise, correct code examples, focus on implementation, and return code blocks where helpful.';
        } else if (mode === 'detailed') {
            finalPrompt += '\nIMPORTANT: The user is in detailed mode. Provide more in-depth explanations and longer, more complete answers.';
        } else if (mode === 'picture') {
            finalPrompt += '\nIMPORTANT: The user is in picture mode. Respond with visual descriptions and image-related content.';
        } else if (mode === 'code') {
            finalPrompt += '\nIMPORTANT: The user is in code mode. Use detailed code examples, and focus on programming solutions.';
        } else if (mode === 'fast') {
            finalPrompt += '\nIMPORTANT: The user is in fast mode. Prioritize short, direct answers over long explanations.';
        }

        // Mood-based replies
        if (mood === 'friendly') {
            finalPrompt += '\nTone: Be warm, friendly, and encouraging, while staying clear and respectful.';
        } else if (mood === 'serious') {
            finalPrompt += '\nTone: Be serious and professional, without jokes.';
        } else if (mood === 'funny') {
            finalPrompt += '\nTone: Be light and a bit funny, but never offensive or distracting from the main answer.';
        } else if (mood === 'calm') {
            finalPrompt += '\nTone: Be calm, reassuring, and relaxed.';
        }

        // Error-free mode
        if (errorFreeMode) {
            finalPrompt += '\nIf you are not sure or do not know, say exactly: "I don't know yet, but here's what I can explain." and then give your best partial explanation.';
        }

        // Command-based behaviors
        if (command === 'short') {
            finalPrompt += '\nCOMMAND: Answer in 1-2 short sentences only.';
        } else if (command === 'simple') {
            finalPrompt += '\nCOMMAND: Explain in very simple language, as if to a young student. Use at most 2-3 short sentences.';
        } else if (command === 'notes') {
            finalPrompt += '\nCOMMAND: Reply only as short bullet-point notes.';
        } else if (command === 'solve') {
            finalPrompt += '\nCOMMAND: Act as a math solver. Show the steps clearly, then the final answer.';
        } else if (command === 'translate') {
            finalPrompt += '\nCOMMAND: Translate between English and Hindi. Detect the direction automatically. For a single word, give meanings in both languages; for sentences, translate the full sentence clearly.';
        } else if (command === 'define') {
            finalPrompt += '\nCOMMAND: Give a short dictionary-style definition first, then one real-life example sentence.';
        } else if (command === 'eli5') {
            finalPrompt += '\nCOMMAND: Explain like I am 5 years old, using one very simple sentence.';
        } else if (command === 'mental') {
            finalPrompt += '\nCOMMAND: For math, explain how to do the calculation mentally in a few clear steps.';
        }

        // Prepare messages for Groq
        const messages = [
            { role: 'system', content: finalPrompt },
            ...conversationHistory
        ];

        const { groqModel } = getModelsForMode(mode);

        // Use Groq for all chat responses
        let aiResponse;
        let usedProvider = 'Groq';
        
        if (groqClient) {
            try {
                const completion = await groqClient.chat.completions.create({
                    model: groqModel,
                    messages: messages,
                    temperature: 0.7,
                    max_tokens: 800
                });
                aiResponse = completion.choices[0].message.content;
                console.log('✅ Groq chat success!');
            } catch (groqError) {
                console.error('❌ Groq failed:', groqError.message);
                throw groqError;
            }
        } else {
            throw new Error('No AI provider available');
        }

        return res.json({
            response: aiResponse,
            provider: usedProvider
        });

    } catch (error) {
        console.error('Error in chat endpoint:', error);
        
        // Clear error handling
        let errorMessage = 'I apologize, but I encountered an error while processing your request.';
        let statusCode = 500;
        
        if (error.status || error.response?.status) {
            const errorStatus = error.status || error.response.status;
            
            if (errorStatus === 401) {
                errorMessage = 'API authentication failed. Please check your API keys in the .env file.';
                statusCode = 401;
            } else if (errorStatus === 429) {
                errorMessage = 'Rate limit exceeded. Please wait a moment and try again.';
                statusCode = 429;
            } else if (errorStatus === 400) {
                errorMessage = `Invalid request: ${error.message || 'Please check your request and try again.'}`;
                statusCode = 400;
            }
        } else if (error.message) {
            errorMessage = `Error: ${error.message}`;
        }

        return res.status(statusCode).json({ 
            error: errorMessage,
            details: error.message || 'Unknown error'
        });
    }
});

// ============================================
// START SERVER
// ============================================

const PORT = process.env.PORT || 3000;

// Start server
app.listen(PORT, () => {
    console.log(`AI Assistant server running on http://localhost:${PORT}`);
    console.log(`Make sure to set GROQ_API_KEY in your .env file for chat functionality`);
});
            .from('usage_limits')
            .upsert({
                user_id: userId,
                ...updateField
            }, {
                onConflict: 'user_id'
            });

        if (updateError) {
            return res.status(500).json({ error: 'Failed to update usage' });
        }

        res.json({ success: true, used: (usage?.[field] || 0) + 1, limit: limit });
    } catch (error) {
        console.error('Usage tracking error:', error);
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/usage/limits', async (req, res) => {
    try {
        const { userId } = req.query;

        if (!userId || !supabase) {
            return res.status(400).json({ error: 'Missing userId' });
        }

        const { data: user, error: userError } = await supabase
            .from('users')
            .select('plan, tokens_remaining, coins')
            .eq('id', userId)
            .single();

        if (userError || !user) {
            return res.status(404).json({ error: 'User not found' });
        }

        const { data: usage } = await supabase
            .from('usage_limits')
            .select('*')
            .eq('user_id', userId)
            .single();

        const limits = PLAN_LIMITS[user.plan];

        res.json({
            plan: user.plan,
            tokens: user.tokens_remaining,
            coins: user.coins,
            limits: limits,
            usage: usage || {
                messages_used: 0,
                images_used: 0,
                code_generations_used: 0,
                memories_used: 0
            }
        });
    } catch (error) {
        console.error('Get usage limits error:', error);
        res.status(500).json({ error: error.message });
    }
});

// ============================================
// ADMIN ENDPOINTS
// ============================================
async function isAdmin(userId) {
    if (!supabase || !userId) return false;
    
    try {
        // Use service key client which bypasses RLS
        const { data, error } = await supabase
            .from('users')
            .select('is_admin, email')
            .eq('id', userId)
            .single();

        // Allow if is_admin is true OR email matches admin email
        const isAdminFlag = !error && data && data.is_admin === true;
        const isAdminEmail = !error && data && data.email === 'howtotutorialbysrinikesh@gmail.com';
        
        return isAdminFlag || isAdminEmail;
    } catch (error) {
        console.error('Admin check error:', error);
        // If RLS blocks, allow access anyway (password was already checked)
        return true;
    }
}

app.get('/api/admin/users', async (req, res) => {
    try {
        console.log('🔍 ADMIN USERS REQUEST - userId:', req.query.userId);
        
        const { userId } = req.query;

        if (!userId) {
            return res.status(400).json({ error: 'userId is required' });
        }

        if (!await isAdmin(userId)) {
            console.warn('❌ Admin access denied for userId:', userId);
            return res.status(403).json({ error: 'Admin access required' });
        }

        if (!supabase) {
            console.error('❌ Supabase not configured');
            return res.status(500).json({ error: 'Supabase not configured. Check SUPABASE_URL and SUPABASE_SERVICE_KEY in .env' });
        }

        console.log('🔍 Querying users table...');
        const { data: users, error } = await supabase
            .from('users')
            .select('id, email, username, plan, coins, is_admin, created_at')
            .order('created_at', { ascending: false });

        console.log('🔍 Users query result:', { count: users?.length || 0, error });

        if (error) {
            console.error('❌ Users query error:', error);
            if (error.message && (error.message.includes('relation') || error.message.includes('does not exist'))) {
                return res.status(500).json({ 
                    error: 'Users table not found. Run SUPABASE_SETUP.sql in Supabase SQL Editor.',
                    details: error.message 
                });
            }
            throw error;
        }

        console.log('✅ Returning users:', users?.length || 0);
        res.json({ users: users || [] });
    } catch (error) {
        console.error('❌ Admin get users error:', error);
        res.status(500).json({ 
            error: error.message || 'Failed to load users',
            details: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
});

app.post('/api/admin/update-user', async (req, res) => {
    try {
        const { adminUserId, targetUserId, updates } = req.body;

        if (!await isAdmin(adminUserId)) {
            return res.status(403).json({ error: 'Admin access required' });
        }

        if (!supabase || !targetUserId || !updates) {
            return res.status(400).json({ error: 'Missing parameters' });
        }

        // Sanitize updates to prevent scientific notation issues
        const sanitizedUpdates = { ...updates };
        
        if (sanitizedUpdates.coins !== undefined) {
            // Convert scientific notation to regular number and ensure it's an integer
            let coinValue = sanitizedUpdates.coins;
            if (typeof coinValue === 'string') {
                // Parse the string to a number
                coinValue = parseFloat(coinValue);
            }
            
            // Check if it's a valid number
            if (isNaN(coinValue)) {
                return res.status(400).json({ error: 'Invalid coin value' });
            }
            
            // Limit to a reasonable range
            coinValue = Math.max(0, Math.min(Math.floor(coinValue), 999999999));
            sanitizedUpdates.coins = coinValue;
        }

        if (sanitizedUpdates.is_admin !== undefined) {
            sanitizedUpdates.is_admin = Boolean(sanitizedUpdates.is_admin);
        }

        const { error } = await supabase
            .from('users')
            .update(sanitizedUpdates)
            .eq('id', targetUserId);

        if (error) throw error;

        res.json({ success: true });
    } catch (error) {
        console.error('Admin update user error:', error);
        res.status(500).json({ error: error.message });
    }
});

app.delete('/api/admin/delete-user', async (req, res) => {
    try {
        const { adminUserId, targetUserId } = req.body;

        if (!await isAdmin(adminUserId)) {
            return res.status(403).json({ error: 'Admin access required' });
        }

        if (!supabase || !targetUserId) {
            return res.status(400).json({ error: 'Missing parameters' });
        }

        // Delete user from multiple related tables
        const tables = ['chats', 'messages', 'user_settings', 'usage_limits', 
                       'game_results', 'memories', 'files', 'referral_codes', 'users'];
        
        let deletedCount = 0;
        
        for (const table of tables) {
            try {
                let result;
                if (table === 'users') {
                    // For users table, use 'id' instead of 'user_id'
                    result = await supabase
                        .from('users')
                        .delete()
                        .eq('id', targetUserId);
                } else {
                    // For other tables, use 'user_id'
                    result = await supabase
                        .from(table)
                        .delete()
                        .eq('user_id', targetUserId);
                }
                
                // Check if there was an error in the result
                if (result.error) {
                    console.error(`Error deleting from ${table}:`, result.error);
                } else {
                    deletedCount++;
                }
            } catch (tableError) {
                console.error(`Exception deleting from ${table}:`, tableError);
                // Continue with other tables even if one fails
            }
        }

        res.json({ success: true, message: `User deleted successfully. Tables affected: ${deletedCount}` });
    } catch (error) {
        console.error('Admin delete user error:', error);
        res.status(500).json({ error: error.message || 'Internal server error' });
    }
});

// ============================================
// GAMES ENDPOINTS
// ============================================
app.get('/api/games/list', async (req, res) => {
    try {
        console.log('🎮 GAMES LIST REQUEST');
        
        if (!supabase) {
            console.error('❌ Supabase not configured');
            return res.status(500).json({ error: 'Supabase not configured. Check SUPABASE_URL and SUPABASE_SERVICE_KEY in .env' });
        }

        console.log('🎮 Querying games table...');
        const { data: games, error } = await supabase
            .from('games')
            .select('*')
            .order('name');

        console.log('🎮 Games query result:', { games: games?.length || 0, error });

        if (error) {
            console.error('❌ Games query error:', error);
            if (error.message && (error.message.includes('relation') || error.message.includes('does not exist'))) {
                return res.status(500).json({ 
                    error: 'Games table not found. Run SUPABASE_SETUP.sql in Supabase SQL Editor.',
                    details: error.message 
                });
            }
            throw error;
        }

        console.log('✅ Returning games:', games?.length || 0);
        res.json({ games: games || [] });
    } catch (error) {
        console.error('❌ Get games error:', error);
        res.status(500).json({ 
            error: error.message || 'Failed to load games',
            details: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
});

app.post('/api/games/submit-result', async (req, res) => {
    try {
        const { userId, gameId, won, score, metadata } = req.body;

        if (!userId || !gameId || !supabase) {
            return res.status(400).json({ error: 'Missing parameters' });
        }

        const { data, error } = await supabase
            .from('game_results')
            .insert({
                user_id: userId,
                game_id: gameId,
                won: won || false,
                score: score || null,
                metadata: metadata || {}
            })
            .select()
            .single();

        if (error) throw error;

        res.json({ success: true, result: data });
    } catch (error) {
        console.error('Submit game result error:', error);
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/games/award-coins', async (req, res) => {
    try {
        const { userId, gameId, coins } = req.body;

        if (!userId || !coins || !supabase) {
            return res.status(400).json({ error: 'Missing parameters' });
        }

        // Get current coins
        const { data: user, error: userError } = await supabase
            .from('users')
            .select('coins')
            .eq('id', userId)
            .single();

        if (userError || !user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Update coins (service key bypasses RLS)
        const newCoins = (user.coins || 0) + coins;
        const { error: updateError } = await supabase
            .from('users')
            .update({ coins: newCoins })
            .eq('id', userId);

        if (updateError) throw updateError;

        res.json({ success: true, coins: newCoins, added: coins });
    } catch (error) {
        console.error('Award coins error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Create user record if missing
app.post('/api/users/create', async (req, res) => {
    try {
        const { userId, email } = req.body;

        if (!userId || !email || !supabase) {
            return res.status(400).json({ error: 'Missing parameters' });
        }

        // Check if user exists
        const { data: existingUser } = await supabase
            .from('users')
            .select('id')
            .eq('id', userId)
            .single();

        if (existingUser) {
            return res.json({ success: true, message: 'User already exists' });
        }

        // Create user record
        const { data: newUser, error } = await supabase
            .from('users')
            .insert({
                id: userId,
                email: email,
                username: email.split('@')[0],
                plan: 'free',
                coins: 0,
                invites_count: 0,
                is_admin: false
            })
            .select()
            .single();

        if (error) throw error;

        res.json({ success: true, user: newUser });
    } catch (error) {
        console.error('Create user error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Delete user account
app.delete('/api/users/delete', async (req, res) => {
    try {
        const { userId, password } = req.body;

        if (!userId || !supabase) {
            return res.status(400).json({ error: 'Missing parameters' });
        }

        // Verify user exists
        const { data: user, error: userError } = await supabase
            .from('users')
            .select('id, email')
            .eq('id', userId)
            .single();

        if (userError || !user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Delete from auth.users (this will cascade delete from public.users due to ON DELETE CASCADE)
        // Note: This requires admin privileges, so we'll delete from public tables first
        const tables = ['users', 'chats', 'messages', 'user_settings', 'usage_limits', 
                       'game_results', 'memories', 'files', 'referral_codes'];
        
        for (const table of tables) {
            const { error } = await supabase
                .from(table)
                .delete()
                .eq('user_id', userId);
            
            // Also try 'id' for users table
            if (table === 'users') {
                const { error: idError } = await supabase
                    .from('users')
                    .delete()
                    .eq('id', userId);
            }
        }

        res.json({ success: true, message: 'Account deleted successfully' });
    } catch (error) {
        console.error('Delete user error:', error);
        res.status(500).json({ error: error.message });
    }
});

// ============================================
// COMPREHENSIVE MEMORY SYSTEM ENDPOINTS
// ============================================

// Helper function to extract memory from user message using AI
async function extractMemoryFromMessage(message, existingProfile) {
    if (!groqClient) {
        console.log('⚠️ No AI client available for memory extraction');
        return null;
    }

    const extractionPrompt = `Analyze this user message and extract any personal information, interests, preferences, or facts about the user.

User message: "${message}"

Existing profile: ${JSON.stringify(existingProfile || {})}

Extract ONLY information that is explicitly stated in the message. Return a JSON object with this exact structure:
{
  "profile_updates": {
    "name": "if mentioned",
    "job_title": "if mentioned",
    "interests": ["array of interests mentioned"],
    "hobbies": ["array of hobbies mentioned"],
    "skills": ["array of skills mentioned"],
    "devices": ["devices mentioned"],
    "favorite_apps": ["apps mentioned"],
    "favorite_technologies": ["tech mentioned"],
    "vehicles": ["vehicles mentioned"],
    "favorite_sports": ["sports mentioned"],
    "favorite_games": ["games mentioned"],
    "favorite_movies": ["movies mentioned"],
    "favorite_music": ["music mentioned"],
    "favorite_books": ["books mentioned"],
    "news_interests": ["news topics mentioned"],
    "favorite_cuisines": ["cuisines mentioned"],
    "favorite_brands": ["brands mentioned"],
    "personality_style": "if mentioned"
  },
  "custom_terms": [
    {"term": "phrase", "meaning": "what it means to this user", "category": "project/slang/joke"}
  ],
  "relationships": [
    {"person_name": "name", "relationship_type": "friend/family/colleague/pet", "notes": "relevant context"}
  ],
  "private_facts": [
    {"fact_type": "story/habit/preference", "fact": "the fact", "context": "context"}
  ]
}

If no new information is found, return {"profile_updates": {}, "custom_terms": [], "relationships": [], "private_facts": []}.`;

    try {
        let response;
        
        // Use Groq for memory extraction
        const completion = await groqClient.chat.completions.create({
            model: 'llama-3.1-8b-instant',
            messages: [{ role: 'user', content: extractionPrompt }],
            temperature: 0.3,
            max_tokens: 1000
        });
        response = completion.choices[0].message.content;

        // Parse the JSON response
        const jsonMatch = response.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            try {
                const extracted = JSON.parse(jsonMatch[0]);
                console.log('🧠 Memory extracted:', extracted);
                return extracted;
            } catch (parseError) {
                console.warn('⚠️ JSON parse failed, trying alternative format:', parseError.message);
                // Try to extract JSON from markdown code blocks
                const codeBlockMatch = response.match(/```json\s*([\s\S]*?)\s*```/);
                if (codeBlockMatch) {
                    const extracted = JSON.parse(codeBlockMatch[1]);
                    console.log('🧠 Memory extracted (from code block):', extracted);
                    return extracted;
                }
            }
        }
        return null;
    } catch (error) {
        console.error('❌ Memory extraction error:', error);
        return null;
    }
}

// Helper function to merge extracted memory with existing profile
async function mergeMemoryWithProfile(userId, extractedData) {
    if (!supabase || !userId) return false;
    
    try {
        // Get existing profile
        const { data: existingProfile, error: profileError } = await supabase
            .from('user_profiles')
            .select('*')
            .eq('user_id', userId)
            .single();
        
        let profile = existingProfile;
        if (profileError || !existingProfile) {
            // Create new profile
            const { data: newProfile, error: createError } = await supabase
                .from('user_profiles')
                .insert({ user_id: userId })
                .select()
                .single();
            if (createError) throw createError;
            profile = newProfile;
        }

        const profileUpdates = {};
        const updates = extractedData.profile_updates || {};
        
        // Merge simple fields
        if (updates.name) profileUpdates.name = updates.name;
        if (updates.job_title) profileUpdates.job_title = updates.job_title;
        if (updates.profession) profileUpdates.profession = updates.profession;
        if (updates.bio) profileUpdates.bio = updates.bio;
        if (updates.personality_style) profileUpdates.personality_style = updates.personality_style;
        
        // Merge array fields (combine unique values)
        const arrayFields = ['interests', 'hobbies', 'skills', 'devices', 'favorite_apps', 
                            'favorite_technologies', 'vehicles', 'favorite_sports', 'favorite_games',
                            'favorite_movies', 'favorite_music', 'favorite_books', 'news_interests',
                            'favorite_cuisines', 'favorite_brands'];
        
        arrayFields.forEach(field => {
            if (updates[field] && updates[field].length > 0) {
                const existing = profile[field] || [];
                const combined = [...new Set([...existing, ...updates[field]])];
                profileUpdates[field] = combined;
            }
        });
        
        // Update profile if there are changes
        if (Object.keys(profileUpdates).length > 0) {
            const { error: updateError } = await supabase
                .from('user_profiles')
                .update(profileUpdates)
                .eq('user_id', userId);
            if (updateError) throw updateError;
            console.log('✅ Profile updated:', profileUpdates);
        }
        
        // Insert custom terms
        const customTerms = extractedData.custom_terms || [];
        for (const term of customTerms) {
            const { error: termError } = await supabase
                .from('user_custom_terms')
                .upsert({
                    user_id: userId,
                    term: term.term,
                    meaning: term.meaning,
                    category: term.category || 'general'
                }, { onConflict: 'user_id,term' });
            if (termError) console.error('Custom term error:', termError);
        }
        
        // Insert relationships
        const relationships = extractedData.relationships || [];
        for (const rel of relationships) {
            const { error: relError } = await supabase
                .from('user_relationships')
                .upsert({
                    user_id: userId,
                    person_name: rel.person_name || rel.name,
                    relationship_type: rel.relationship_type || rel.type || 'other',
                    notes: rel.notes || ''
                }, { onConflict: 'user_id,person_name' });
            if (relError) console.error('Relationship error:', relError);
        }
        
        // Insert private facts
        const privateFacts = extractedData.private_facts || [];
        for (const fact of privateFacts) {
            const { error: factError } = await supabase
                .from('user_private_facts')
                .insert({
                    user_id: userId,
                    fact_type: fact.fact_type || 'general',
                    fact: fact.fact,
                    context: fact.context || ''
                });
            if (factError) console.error('Private fact error:', factError);
        }
        
        // Log the extraction
        if (Object.keys(profileUpdates).length > 0 || customTerms.length > 0 || 
            relationships.length > 0 || privateFacts.length > 0) {
            await supabase.from('memory_extraction_log').insert({
                user_id: userId,
                extraction_type: 'auto_extraction',
                extracted_data: extractedData
            });
        }
        
        return true;
    } catch (error) {
        console.error('❌ Merge memory error:', error);
        return false;
    }
}

// GET user memory (profile + custom terms + relationships + facts)
app.get('/api/memory', async (req, res) => {
    try {
        const { userId } = req.query;
        
        if (!userId || !supabase) {
            return res.status(400).json({ error: 'Missing userId' });
        }
        
        // Fetch all memory data in parallel
        const [profileRes, termsRes, relationshipsRes, factsRes] = await Promise.all([
            supabase.from('user_profiles').select('*').eq('user_id', userId).single(),
            supabase.from('user_custom_terms').select('*').eq('user_id', userId),
            supabase.from('user_relationships').select('*').eq('user_id', userId),
            supabase.from('user_private_facts').select('*').eq('user_id', userId)
        ]);
        
        const memory = {
            profile: profileRes.data || null,
            customTerms: termsRes.data || [],
            relationships: relationshipsRes.data || [],
            privateFacts: factsRes.data || []
        };
        
        res.json({ success: true, memory });
    } catch (error) {
        console.error('Get memory error:', error);
        res.status(500).json({ error: error.message });
    }
});

// POST extract and save memory from message
app.post('/api/memory/extract', async (req, res) => {
    try {
        const { userId, message } = req.body;
        
        if (!userId || !message || !supabase) {
            return res.status(400).json({ error: 'Missing userId or message' });
        }
        
        // Get existing profile for context
        const { data: existingProfile } = await supabase
            .from('user_profiles')
            .select('*')
            .eq('user_id', userId)
            .single();
        
        // Extract memory using AI
        const extracted = await extractMemoryFromMessage(message, existingProfile);
        
        if (!extracted) {
            return res.json({ success: true, extracted: null, message: 'No new information found' });
        }
        
        // Merge with existing profile
        const saved = await mergeMemoryWithProfile(userId, extracted);
        
        res.json({ 
            success: true, 
            extracted: extracted,
            saved: saved,
            message: saved ? 'Memory saved' : 'Failed to save memory'
        });
    } catch (error) {
        console.error('Extract memory error:', error);
        res.status(500).json({ error: error.message });
    }
});

// POST update user profile
app.post('/api/memory/profile', async (req, res) => {
    try {
        const { userId, updates } = req.body;
        
        if (!userId || !updates || !supabase) {
            return res.status(400).json({ error: 'Missing userId or updates' });
        }
        
        const { data, error } = await supabase
            .from('user_profiles')
            .upsert({ user_id: userId, ...updates }, { onConflict: 'user_id' })
            .select()
            .single();
        
        if (error) throw error;
        
        res.json({ success: true, profile: data });
    } catch (error) {
        console.error('Update profile error:', error);
        res.status(500).json({ error: error.message });
    }
});

// POST add custom term
app.post('/api/memory/custom-term', async (req, res) => {
    try {
        const { userId, term, meaning, category } = req.body;
        
        if (!userId || !term || !meaning || !supabase) {
            return res.status(400).json({ error: 'Missing required fields' });
        }
        
        const { data, error } = await supabase
            .from('user_custom_terms')
            .upsert({
                user_id: userId,
                term: term,
                meaning: meaning,
                category: category || 'general'
            }, { onConflict: 'user_id,term' })
            .select()
            .single();
        
        if (error) throw error;
        
        res.json({ success: true, term: data });
    } catch (error) {
        console.error('Add custom term error:', error);
        res.status(500).json({ error: error.message });
    }
});

// POST add relationship
app.post('/api/memory/relationship', async (req, res) => {
    try {
        const { userId, personName, relationshipType, notes } = req.body;
        
        if (!userId || !personName || !supabase) {
            return res.status(400).json({ error: 'Missing required fields' });
        }
        
        const { data, error } = await supabase
            .from('user_relationships')
            .upsert({
                user_id: userId,
                person_name: personName,
                relationship_type: relationshipType || 'other',
                notes: notes || ''
            }, { onConflict: 'user_id,person_name' })
            .select()
            .single();
        
        if (error) throw error;
        
        res.json({ success: true, relationship: data });
    } catch (error) {
        console.error('Add relationship error:', error);
        res.status(500).json({ error: error.message });
    }
});

// POST add private fact
app.post('/api/memory/private-fact', async (req, res) => {
    try {
        const { userId, factType, fact, context } = req.body;
        
        if (!userId || !fact || !supabase) {
            return res.status(400).json({ error: 'Missing required fields' });
        }
        
        const { data, error } = await supabase
            .from('user_private_facts')
            .insert({
                user_id: userId,
                fact_type: factType || 'general',
                fact: fact,
                context: context || ''
            })
            .select()
            .single();
        
        if (error) throw error;
        
        res.json({ success: true, fact: data });
    } catch (error) {
        console.error('Add private fact error:', error);
        res.status(500).json({ error: error.message });
    }
});

// DELETE memory endpoints
app.delete('/api/memory/custom-term', async (req, res) => {
    try {
        const { userId, term } = req.body;
        const { error } = await supabase
            .from('user_custom_terms')
            .delete()
            .eq('user_id', userId)
            .eq('term', term);
        if (error) throw error;
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.delete('/api/memory/relationship', async (req, res) => {
    try {
        const { userId, personName } = req.body;
        const { error } = await supabase
            .from('user_relationships')
            .delete()
            .eq('user_id', userId)
            .eq('person_name', personName);
        if (error) throw error;
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ============================================
// ENHANCED CHAT WITH MEMORY
// ============================================

// Helper function to build personalized system prompt with memory
async function buildPersonalizedPrompt(userId, baseSystemPrompt) {
    if (!supabase || !userId) return baseSystemPrompt;
    
    try {
        // Fetch user memory
        const [profileRes, termsRes, relationshipsRes, factsRes] = await Promise.all([
            supabase.from('user_profiles').select('*').eq('user_id', userId).single(),
            supabase.from('user_custom_terms').select('*').eq('user_id', userId),
            supabase.from('user_relationships').select('*').eq('user_id', userId),
            supabase.from('user_private_facts').select('*').eq('user_id', userId)
        ]);
        
        const profile = profileRes.data;
        const customTerms = termsRes.data || [];
        const relationships = relationshipsRes.data || [];
        const privateFacts = factsRes.data || [];
        
        if (!profile && customTerms.length === 0 && relationships.length === 0 && privateFacts.length === 0) {
            return baseSystemPrompt;
        }
        
        let memoryContext = '\n\n[USER MEMORY CONTEXT - Use this to personalize your responses]:\n';
        
        // Add profile info
        if (profile) {
            if (profile.name) memoryContext += `- User's name: ${profile.name}\n`;
            if (profile.job_title || profile.profession) {
                memoryContext += `- User's job: ${profile.job_title || profile.profession}\n`;
            }
            if (profile.interests?.length > 0) {
                memoryContext += `- User's interests: ${profile.interests.join(', ')}\n`;
            }
            if (profile.hobbies?.length > 0) {
                memoryContext += `- User's hobbies: ${profile.hobbies.join(', ')}\n`;
            }
            if (profile.skills?.length > 0) {
                memoryContext += `- User's skills: ${profile.skills.join(', ')}\n`;
            }
            if (profile.favorite_apps?.length > 0) {
                memoryContext += `- Apps user uses: ${profile.favorite_apps.join(', ')}\n`;
            }
            if (profile.favorite_technologies?.length > 0) {
                memoryContext += `- Technologies user likes: ${profile.favorite_technologies.join(', ')}\n`;
            }
            if (profile.vehicles?.length > 0) {
                memoryContext += `- User's vehicles: ${profile.vehicles.join(', ')}\n`;
            }
            if (profile.favorite_sports?.length > 0) {
                memoryContext += `- Sports user follows: ${profile.favorite_sports.join(', ')}\n`;
            }
            if (profile.favorite_games?.length > 0) {
                memoryContext += `- Games user plays: ${profile.favorite_games.join(', ')}\n`;
            }
            if (profile.personality_style) {
                memoryContext += `- User's personality: ${profile.personality_style}\n`;
            }
        }
        
        // Add custom terms
        if (customTerms.length > 0) {
            memoryContext += '\n[Custom terms user uses]:\n';
            customTerms.forEach(term => {
                memoryContext += `- "${term.term}" means: ${term.meaning}\n`;
            });
        }
        
        // Add relationships
        if (relationships.length > 0) {
            memoryContext += '\n[User relationships]:\n';
            relationships.forEach(rel => {
                memoryContext += `- ${rel.person_name} (${rel.relationship_type})${rel.notes ? `: ${rel.notes}` : ''}\n`;
            });
        }
        
        // Add private facts
        if (privateFacts.length > 0) {
            memoryContext += '\n[Private facts about user]:\n';
            privateFacts.forEach(fact => {
                memoryContext += `- ${fact.fact}${fact.context ? ` (${fact.context})` : ''}\n`;
            });
        }
        
        memoryContext += '\n[INSTRUCTIONS]: Use the above context to personalize your responses. Reference their interests when relevant. Use their custom terms correctly. Remember their relationships and private facts.';
        
        return baseSystemPrompt + memoryContext;
    } catch (error) {
        console.error('Build personalized prompt error:', error);
        return baseSystemPrompt;
    }
}

// Catch-all route for SPA (must be placed before app.listen)
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Start server
app.listen(PORT, () => {
    console.log(`AI Assistant server running on http://localhost:${PORT}`);
    console.log(`Make sure to set GROQ_API_KEY in your .env file for chat functionality`);
});
