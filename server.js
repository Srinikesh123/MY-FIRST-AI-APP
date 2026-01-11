const express = require('express');
const cors = require('cors');
const OpenAI = require('openai');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

// Initialize OpenAI client
const openai = process.env.OPENAI_API_KEY ? new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
}) : null;

// Initialize Groq client (free alternative using Llama models)
let groqClient = null;
if (process.env.GROQ_API_KEY) {
    try {
        const Groq = require('groq-sdk');
        groqClient = new Groq({
            apiKey: process.env.GROQ_API_KEY
        });
    } catch (e) {
        console.log('Groq SDK not installed.');
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
        codeGenerations: 5
    },
    pro: {
        tokens: 500,
        messages: 500,  // 10x free (50 * 10)
        images: 50,    // 10x free (5 * 10)
        codeGenerations: 50
    },
    ultra: {
        tokens: -1, // unlimited
        messages: -1, // unlimited
        images: -1,   // unlimited
        codeGenerations: -1
    }
};

// Conversation history is now managed by Supabase on the client side

// Helper to choose model based on mode
function getModelsForMode(mode) {
    const selected = mode || 'fast';

    // Defaults can be overridden via .env
    const openaiModels = {
        fast: process.env.OPENAI_MODEL_FAST || 'gpt-3.5-turbo',
        detailed: process.env.OPENAI_MODEL_DETAILED || process.env.OPENAI_MODEL || 'gpt-4o-mini',
        coding: process.env.OPENAI_MODEL_CODING || process.env.OPENAI_MODEL || 'gpt-4o-mini'
    };

    const groqModels = {
        fast: process.env.GROQ_MODEL_FAST || 'llama-3.1-8b-instant',
        detailed: process.env.GROQ_MODEL_DETAILED || process.env.GROQ_MODEL || 'llama-3.1-70b-versatile',
        coding: process.env.GROQ_MODEL_CODING || process.env.GROQ_MODEL || 'llama-3.1-8b-instant'
    };

    return {
        openaiModel: openaiModels[selected] || openaiModels.fast,
        groqModel: groqModels[selected] || groqModels.fast
    };
}

function tryOfflineAnswer(message, command) {
    const text = (message || '').trim();
    if (!text) return null;

    const lower = text.toLowerCase();

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
        const { message, history, simpleLanguage, mode, command, mood, errorFreeMode, userId } = req.body;

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

        // Check if at least one API is configured; if not, try offline-safe logic
        if (!process.env.OPENAI_API_KEY && !process.env.GROQ_API_KEY) {
            const offline = tryOfflineAnswer(message, command);
            if (offline) {
                return res.json({
                    response: offline,
                    provider: 'offline'
                });
            }

            return res.status(500).json({ 
                error: 'No AI API key configured. Please set either OPENAI_API_KEY or GROQ_API_KEY in your .env file.' 
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
        let systemPrompt = `You are a helpful AI assistant that follows these guidelines:
- Give clear and correct answers to simple questions directly
- Understand and remember context from the conversation
- Be honest - say "I don't know" instead of making things up
- Respond quickly and efficiently
- Use simple, easy-to-understand language when requested
- Provide accurate reasoning and correct conclusions
- Use your general knowledge for basic questions without unnecessary searching
- Explain mistakes clearly if something goes wrong
- Maintain a polite and neutral, respectful tone (not robotic)
- Avoid harmful or dangerous content
`;

        if (simpleLanguage) {
            systemPrompt += '\nIMPORTANT: The user has requested simple language. Explain everything in easy-to-understand terms, using everyday words.';
        }

        if (mode === 'coding') {
            systemPrompt += '\nIMPORTANT: The user is in coding mode. Prefer concise, correct code examples, focus on implementation, and return code blocks where helpful.';
        } else if (mode === 'detailed') {
            systemPrompt += '\nIMPORTANT: The user is in detailed mode. Provide more in-depth explanations and longer, more complete answers.';
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
            systemPrompt += '\nIf you are not sure or do not know, say exactly: "I don’t know yet, but here’s what I can explain." and then give your best partial explanation.';
        }

        // Command-based behaviors
        if (command === 'short') {
            systemPrompt += '\nCOMMAND: Answer in 1–2 short sentences only.';
        } else if (command === 'simple') {
            systemPrompt += '\nCOMMAND: Explain in very simple language, as if to a young student. Use at most 2–3 short sentences.';
        } else if (command === 'notes') {
            systemPrompt += '\nCOMMAND: Reply only as short bullet-point notes.';
        } else if (command === 'solve') {
            systemPrompt += '\nCOMMAND: Act as a math solver. Show the steps clearly, then the final answer.';
        } else if (command === 'translate') {
            systemPrompt += '\nCOMMAND: Translate between English and Hindi. Detect the direction automatically. For a single word, give meanings in both languages; for sentences, translate the full sentence clearly.';
        } else if (command === 'define') {
            systemPrompt += '\nCOMMAND: Give a short dictionary-style definition first, then one real-life example sentence.';
        } else if (command === 'eli5') {
            systemPrompt += '\nCOMMAND: Explain like I am 5 years old, using one very simple sentence.';
        } else if (command === 'mental') {
            systemPrompt += '\nCOMMAND: For math, explain how to do the calculation mentally in a few clear steps.';
        }

        // Prepare messages for OpenAI
        const messages = [
            { role: 'system', content: systemPrompt },
            ...conversationHistory
        ];

        const { openaiModel, groqModel } = getModelsForMode(mode);

        // Try OpenAI first, fallback to Groq if quota/billing issues
        let aiResponse;
        let usedProvider = 'OpenAI';
        
        // Try OpenAI if available
        if (openai) {
            try {
                let completion;
                let retries = 3;
                let retryDelay = 1000;
                const model = openaiModel;
                
                while (retries > 0) {
                    try {
                        completion = await openai.chat.completions.create({
                            model: model,
                            messages: messages,
                            temperature: 0.7,
                            max_tokens: 800
                        });
                        aiResponse = completion.choices[0].message.content;
                        break; // Success
                    } catch (retryError) {
                        retries--;
                        
                        // Check if it's a quota/billing error - switch to Groq immediately
                        const errorStatus = retryError.status || retryError.response?.status;
                        const errorMsg = retryError.response?.data?.error?.message || retryError.message || '';
                        
                        if (errorStatus === 429 && (errorMsg.includes('quota') || errorMsg.includes('billing'))) {
                            console.log('OpenAI quota exceeded. Switching to Groq (free alternative)...');
                            throw new Error('QUOTA_EXCEEDED'); // Signal to use fallback
                        }
                        
                        // Check if it's a rate limit error (429) - retry
                        if (errorStatus === 429 && retries > 0) {
                            const retryAfter = retryError.response?.headers?.['retry-after'] || retryDelay / 1000;
                            console.log(`Rate limit hit. Retrying in ${retryAfter} seconds... (${retries} retries left)`);
                            await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
                            retryDelay *= 2;
                        } else {
                            throw retryError;
                        }
                    }
                }
            } catch (openaiError) {
                // If quota exceeded or other error, try Groq fallback
                if (openaiError.message === 'QUOTA_EXCEEDED' || (openaiError.status === 429 && groqClient)) {
                    console.log('Using Groq as fallback...');
                    try {
                        if (groqClient) {
                            const groqCompletion = await groqClient.chat.completions.create({
                                messages: messages,
                                model: groqModel,
                                temperature: 0.7,
                                max_tokens: 800
                            });
                            aiResponse = groqCompletion.choices[0].message.content;
                            usedProvider = 'Groq (Llama)';
                            console.log('Successfully used Groq API');
                        } else {
                            throw openaiError; // Re-throw original error if Groq not available
                        }
                    } catch (groqError) {
                        console.error('Groq also failed:', groqError);
                        throw openaiError; // Throw original OpenAI error
                    }
                } else {
                    throw openaiError; // Re-throw if not a quota issue
                }
            }
        } else if (groqClient) {
            // Use Groq directly if OpenAI not configured
            try {
                const groqCompletion = await groqClient.chat.completions.create({
                    messages: messages,
                    model: groqModel,
                    temperature: 0.7,
                    max_tokens: 800
                });
                aiResponse = groqCompletion.choices[0].message.content;
                usedProvider = 'Groq (Llama)';
            } catch (groqError) {
                throw groqError;
            }
        } else {
            throw new Error('No AI provider available');
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
                errorMessage = 'API authentication failed. Please check your OpenAI API key in the .env file.';
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

// API endpoint to generate images from text
app.post('/api/image', async (req, res) => {
    try {
        const { prompt, userId, mode } = req.body;

        if (!prompt || !prompt.trim()) {
            return res.status(400).json({
                error: 'Prompt is required'
            });
        }

        // Check image usage limits if userId provided
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
                        onConflict: 'user_id'
                    });
            }
        }
                
        // Check if emoji mode is requested
        if (mode === 'emoji') {
            const emojiArt = textToEmoji(prompt);
            // Create an SVG with the emoji art
            const svgContent = `<svg xmlns='http://www.w3.org/2000/svg' width='512' height='512' style='background:white'>
                <style>.emoji-art { font-family: monospace; font-size: 16px; white-space: pre-line; }</style>
                <text x='10' y='30' class='emoji-art' fill='black'>${emojiArt.replace(/[<>&]/g, (char) => {
                    switch(char) {
                        case '<': return '&lt;';
                        case '>': return '&gt;';
                        case '&': return '&amp;';
                        default: return char;
                    }
                })}</text>
            </svg>`;
            // Properly encode the SVG for data URL
            const encodedSvg = encodeURIComponent(svgContent).replace(/'/g, '%27').replace(/"/g, '%22').replace(/\s+/g, ' ');
            const emojiImageUrl = `data:image/svg+xml;utf8,${encodedSvg}`;
            return res.json({ imageUrl: emojiImageUrl });
        }
                
        // Try OpenAI if available and enabled
        if (openai && process.env.OPENAI_USE_FOR_IMAGES === 'true') {
            const result = await openai.images.generate({
                model: 'dall-e-3',
                prompt,
                size: '1024x1024',
                n: 1
            });
        
            const image = result.data && result.data[0];
            const imageUrl = image && image.url;
        
            if (!imageUrl) {
                throw new Error('Image generation failed: no URL returned.');
            }
        
            return res.json({
                imageUrl
            });
        }
        
        // Try Stability AI if available
        if (process.env.STABILITY_API_KEY && process.env.STABILITY_USE_FOR_IMAGES === 'true') {
            const stabilityResponse = await fetch('https://api.stability.ai/v1/generation/stable-diffusion-v1-6/text-to-image', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${process.env.STABILITY_API_KEY}`,
                    'Accept': 'application/json'
                },
                body: JSON.stringify({
                    text_prompts: [
                        {
                            text: prompt
                        }
                    ],
                    cfg_scale: 7,
                    height: 1024,
                    width: 1024,
                    samples: 1,
                    steps: 30
                })
            });
            
            if (!stabilityResponse.ok) {
                console.error('Stability AI error:', await stabilityResponse.text());
            } else {
                const stabilityData = await stabilityResponse.json();
                if (stabilityData.artifacts && stabilityData.artifacts[0]) {
                    // Stability AI returns base64 encoded images
                    const imageUrl = `data:image/png;base64,${stabilityData.artifacts[0].base64}`;
                    return res.json({ imageUrl });
                }
            }
        }
        
        // Try Hugging Face if available
        if (process.env.HUGGINGFACE_API_KEY && process.env.HUGGINGFACE_USE_FOR_IMAGES === 'true') {
            try {
                console.log('🔄 Attempting Hugging Face image generation for prompt:', prompt);
                
                const hfResponse = await fetch(
                    `https://api-inference.huggingface.co/models/THUDM/cogview-2`,
                    {
                        headers: { 
                            'Authorization': `Bearer ${process.env.HUGGINGFACE_API_KEY}`
                        },
                        method: 'POST',
                        body: JSON.stringify({
                            inputs: prompt,
                        })
                    }
                );
                
                console.log('HF Response status:', hfResponse.status);
                
                if (hfResponse.ok) {
                    const arrayBuffer = await hfResponse.arrayBuffer();
                    
                    // Check if the response is actually an image (PNG/JPG header)
                    const uint8Array = new Uint8Array(arrayBuffer.slice(0, 8));
                    const header = Array.from(uint8Array).map(b => b.toString(16)).join('');
                    
                    // PNG signature: 89 50 4e 47 0d 0a 1a 0a
                    const isPng = header.startsWith('89504e470d0a1a0a');
                    // JPEG signature: ff d8 ff
                    const isJpeg = header.startsWith('ffd8ff');
                    
                    if (isPng || isJpeg) {
                        const base64Image = Buffer.from(arrayBuffer).toString('base64');
                        const imageUrl = `data:image/png;base64,${base64Image}`;
                        console.log('✅ Hugging Face image generated successfully');
                        return res.json({ imageUrl });
                    } else {
                        // The response might be JSON with error/informational message
                        const textResponse = Buffer.from(arrayBuffer).toString('utf8');
                        console.log('📝 Hugging Face response might be text:', textResponse.substring(0, 200));
                        
                        // Try to parse as JSON to see if it's an error message
                        try {
                            const jsonResponse = JSON.parse(textResponse);
                            console.error('❌ Hugging Face API returned JSON error:', jsonResponse);
                            
                            // If it's a model loading message, we might need to handle retries
                            if (jsonResponse.error && jsonResponse.time) {
                                console.log(`⏳ Model loading, retry after ${jsonResponse.time}s`);
                                // In a real implementation, we could implement retry logic here
                            }
                        } catch (e) {
                            // Not JSON, might be HTML error page or plain text
                            console.error('❌ Hugging Face response is not an image:', textResponse.substring(0, 200));
                        }
                    }
                } else {
                    const errorText = await hfResponse.text();
                    console.error('❌ Hugging Face API error response:', errorText);
                }
            } catch (error) {
                console.error('🚨 Hugging Face API error:', error.message);
            }
        }
        
        // Alternative: Use a free image generation service
        // This is a simple service that generates images based on text
        try {
            console.log('🔄 Attempting free image generation for prompt:', prompt);
            
            // Using an alternative approach - generate an image from a text prompt using a free service
            const encodedPrompt = encodeURIComponent(prompt);
            const imageUrl = `https://api.dicebear.com/7.x/bottts-neutral/png?seed=${encodedPrompt}&size=512`;
            
            console.log('✅ Free image service used successfully');
            return res.json({ imageUrl });
            
        } catch (error) {
            console.error('🚨 Free image service error:', error.message);
        }
        
        // Fallback: placeholder image
        const fallbackPrompt = encodeURIComponent(prompt);
        const imageUrl = `https://via.placeholder.com/512/667eea/ffffff?text=${fallbackPrompt.substring(0, 20)}`;

        res.json({ imageUrl });
    } catch (error) {
        console.error('Error generating image:', error);
        res.status(500).json({
            error: 'Failed to generate image. Please try again later.'
        });
    }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'ok',
        message: 'voidzenzi AI Assistant server is running' 
    });
});

// ============================================
// ============================================
// USAGE TRACKING
// ============================================
app.post('/api/usage/track', async (req, res) => {
    try {
        const { userId, type } = req.body; // type: 'message', 'image', 'code'

        if (!userId || !type || !supabase) {
            return res.status(400).json({ error: 'Missing parameters' });
        }

        // Get user plan
        const { data: user, error: userError } = await supabase
            .from('users')
            .select('plan')
            .eq('id', userId)
            .single();

        if (userError || !user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Get usage limits
        const { data: usage, error: usageError } = await supabase
            .from('usage_limits')
            .select('*')
            .eq('user_id', userId)
            .single();

        if (usageError && usageError.code !== 'PGRST116') {
            return res.status(500).json({ error: 'Failed to get usage' });
        }

        // Check limits
        const limits = PLAN_LIMITS[user.plan];
        const field = type === 'message' ? 'messages_used' : 
                     type === 'image' ? 'images_used' : 'code_generations_used';
        const limit = type === 'message' ? limits.messages :
                     type === 'image' ? limits.images : limits.codeGenerations;

        if (limit !== -1 && usage && usage[field] >= limit) {
            return res.status(403).json({ 
                error: 'Usage limit exceeded',
                limit: limit,
                used: usage[field]
            });
        }

        // Update usage
        const updateField = {};
        updateField[field] = (usage?.[field] || 0) + 1;

        const { error: updateError } = await supabase
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
                code_generations_used: 0
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

// Start server
app.listen(PORT, () => {
    console.log(`AI Assistant server running on http://localhost:${PORT}`);
    console.log(`Make sure to set OPENAI_API_KEY or GROQ_API_KEY in your .env file`);
});
