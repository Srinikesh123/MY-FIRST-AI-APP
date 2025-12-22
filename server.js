const express = require('express');
const cors = require('cors');
const OpenAI = require('openai');
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

// Store conversation history per session (simple in-memory store)
const conversations = new Map();

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
        const { message, sessionId, simpleLanguage, mode, command, mood, errorFreeMode } = req.body;

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
                    sessionId,
                    provider: 'offline'
                });
            }

            return res.status(500).json({ 
                error: 'No AI API key configured. Please set either OPENAI_API_KEY or GROQ_API_KEY in your .env file.' 
            });
        }

        // Get or create conversation history for this session
        if (!conversations.has(sessionId)) {
            conversations.set(sessionId, []);
        }
        const conversationHistory = conversations.get(sessionId);

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

        // Keep conversation history manageable (last 20 messages)
        if (conversationHistory.length > 20) {
            conversationHistory.splice(0, conversationHistory.length - 20);
        }

        // Return the exact response from the AI
        res.json({ 
            response: aiResponse,
            sessionId: sessionId,
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

// API endpoint to generate images from text
app.post('/api/image', async (req, res) => {
    try {
        const { prompt } = req.body;

        if (!prompt || !prompt.trim()) {
            return res.status(400).json({
                error: 'Prompt is required'
            });
        }

        // If OpenAI is available and you want to use it, do so.
        // Otherwise, fall back to a free, no-key AI image service (Pollinations).
        if (openai && process.env.OPENAI_USE_FOR_IMAGES === 'true') {
            const model = process.env.OPENAI_IMAGE_MODEL || 'gpt-image-1';

            const result = await openai.images.generate({
                model,
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

        // Free fallback: Pollinations (no API key needed, public AI image service)
        const encodedPrompt = encodeURIComponent(prompt);
        const imageUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}`;

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
        message: 'AI Assistant server is running' 
    });
});

// Start server
app.listen(PORT, () => {
    console.log(`AI Assistant server running on http://localhost:${PORT}`);
    console.log(`Make sure to set OPENAI_API_KEY or GROQ_API_KEY in your .env file`);
});
