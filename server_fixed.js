const express = require('express');
const cors = require('cors');
const OpenAI = require('openai');
const { createClient } = require('@supabase/supabase-js');
const path = require('path');
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

// Helper to choose model based on mode
function getModelsForMode(mode) {
    const selected = mode || 'fast';

    // Defaults can be overridden via .env
    const openaiModels = {
        fast: process.env.OPENAI_MODEL_FAST || 'gpt-3.5-turbo',
        detailed: process.env.OPENAI_MODEL_DETAILED || process.env.OPENAI_MODEL || 'gpt-4o-mini',
        coding: process.env.OPENAI_MODEL_CODING || process.env.OPENAI_MODEL || 'gpt-4o-mini'
    };

    // Updated to use currently supported Groq models (using latest available models)
    const groqModels = {
        fast: process.env.GROQ_MODEL_FAST || 'llama-3.1-8b-instant', // Using latest Llama 3.1 as reliable option
        detailed: process.env.GROQ_MODEL_DETAILED || process.env.GROQ_MODEL || 'llama-3.1-8b-instant',
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
        return 'Hi! I'm your AI assistant. How can I help you today?';
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
                    return `Let's solve it step by step.\nExpression: ${text}\nAnswer: ${result}`;
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

        // Check for special "Who am I?" questions using user context
        if (userSystemPrompt && (message.toLowerCase().includes('who am i') || message.toLowerCase().includes('what is my name'))) {
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
            systemPrompt += '\nIMPORTANT: The user is in code mode. Use GPT Codex for coding assistance, provide detailed code examples, and focus on programming solutions.';
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
            systemPrompt += '\nIf you are not sure or do not know, say exactly: "I don't know yet, but here's what I can explain." and then give your best partial explanation.';
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
            systemPrompt += '\nCOMMAND: For math, explain how to do calculation mentally in a few clear steps.';
        }

        // Prepare messages for OpenAI
        const messages = [
            { role: 'system', content: systemPrompt },
            ...conversationHistory
        ];

        const { openaiModel, groqModel } = getModelsForMode(mode);

        // According to requirements: When both OpenAI and Groq APIs are available, always use OpenAI (ChatGPT) as the primary AI provider
        let aiResponse;
        let usedProvider = 'OpenAI';
        
        // Try OpenAI first as primary (per requirement: "When both OpenAI and Groq APIs are available, always use OpenAI (ChatGPT) as the primary AI provider")
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
                            usedProvider = 'Groq (ChatGPT)';
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
            // Use Groq if OpenAI not available
            try {
                const groqCompletion = await groqClient.chat.completions.create({
                    messages: messages,
                    model: groqModel,
                    temperature: 0.7,
                    max_tokens: 800
                });
                aiResponse = groqCompletion.choices[0].message.content;
                usedProvider = 'Groq (ChatGPT)';
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

        // Return exact response from AI
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
                errorMessage = 'API authentication failed. Please check your OpenAI API key in .env file.';
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
        
        res.status(statusCode).json({ error: errorMessage });
    }
});

// Include all other existing endpoints from the original server.js file
// (This is a simplified version - you'll need to copy the rest of the endpoints)

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
