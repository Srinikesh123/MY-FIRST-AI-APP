const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs').promises;
const OpenAI = require('openai');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Disable caching for HTML files
app.use((req, res, next) => {
    if (req.path.endsWith('.html') || req.path === '/') {
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
    }
    next();
});

app.use(express.static('.'));

// In-memory storage for conversations and games
let conversations = {};
let games = [];

// Load existing games from file if it exists
async function loadGames() {
    try {
        const data = await fs.readFile('games.json', 'utf8');
        games = JSON.parse(data);
    } catch (error) {
        // If file doesn't exist, initialize with empty array
        games = [];
    }
}

// Save games to file
async function saveGames() {
    try {
        await fs.writeFile('games.json', JSON.stringify(games, null, 2));
    } catch (error) {
        console.error('Error saving games:', error);
    }
}

// Load games on startup
loadGames();

// API endpoint to get Supabase config (for frontend)
app.get('/api/config', (req, res) => {
    res.json({
        supabaseUrl: process.env.SUPABASE_URL,
        supabaseAnonKey: process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_KEY?.substring(0, 100)
    });
});

// ========== MAIN CHAT ENDPOINT ==========
app.post('/api/chat', async (req, res) => {
    try {
        const { message, history, simpleLanguage, mode, mood, errorFreeMode } = req.body;
        
        if (!message) {
            return res.status(400).json({ error: 'Message is required' });
        }
        
        console.log('Chat received:', message.substring(0, 50) + '...');
        
        // Check API keys
        if (!process.env.GROQ_API_KEY && !process.env.OPENAI_API_KEY) {
            return res.status(500).json({ 
                error: '⚠️ No AI API configured. Please add GROQ_API_KEY or OPENAI_API_KEY to .env file.' 
            });
        }
        
        // Build system prompt based on settings
        let systemPrompt = 'You are a helpful AI assistant.';
        
        if (simpleLanguage) {
            systemPrompt = 'You are a helpful AI assistant. Use simple, easy-to-understand language. Avoid jargon and technical terms.';
        }
        
        if (mood === 'friendly') systemPrompt += ' Be warm and friendly.';
        else if (mood === 'serious') systemPrompt += ' Be professional and direct.';
        else if (mood === 'funny') systemPrompt += ' Be witty and humorous.';
        else if (mood === 'calm') systemPrompt += ' Be calm and reassuring.';
        
        if (mode === 'detailed') systemPrompt += ' Provide thorough, detailed responses.';
        else if (mode === 'fast') systemPrompt += ' Keep responses concise and to the point.';
        
        // Build messages array
        const messages = [{ role: 'system', content: systemPrompt }];
        
        // Add history
        if (history && Array.isArray(history)) {
            history.slice(-10).forEach(h => {
                messages.push({ role: h.role, content: h.content });
            });
        }
        
        messages.push({ role: 'user', content: message });
        
        let response;
        
        // Try Groq first (free tier), then OpenAI
        if (process.env.GROQ_API_KEY) {
            const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model: 'llama-3.1-8b-instant',
                    messages: messages,
                    max_tokens: 2000,
                    temperature: 0.7
                })
            });
            
            if (!groqRes.ok) {
                const errText = await groqRes.text();
                console.error('Groq error:', errText);
                
                // Check for rate limit
                if (groqRes.status === 429 || errText.includes('rate_limit') || errText.includes('tokens')) {
                    return res.status(429).json({ 
                        error: '⏳ Out of tokens! Please wait a moment and try again. (Free tier limit reached)' 
                    });
                }
                throw new Error(`Groq API error: ${groqRes.status}`);
            }
            
            const data = await groqRes.json();
            response = data.choices[0].message.content;
        } else if (process.env.OPENAI_API_KEY) {
            const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
            const completion = await openai.chat.completions.create({
                model: 'gpt-3.5-turbo',
                messages: messages,
                max_tokens: 2000,
                temperature: 0.7
            });
            response = completion.choices[0].message.content;
        }
        
        res.json({ success: true, response: response });
        
    } catch (error) {
        console.error('Chat error:', error);
        
        // Handle specific errors
        if (error.message?.includes('429') || error.message?.includes('rate')) {
            return res.status(429).json({ error: '⏳ Rate limit reached. Please wait a moment and try again.' });
        }
        if (error.message?.includes('401') || error.message?.includes('invalid_api_key')) {
            return res.status(401).json({ error: '🔑 Invalid API key. Please check your .env file.' });
        }
        
        res.status(500).json({ error: `Failed to get AI response: ${error.message}` });
    }
});

// ========== IMAGE GENERATION ENDPOINT ==========
app.post('/api/image', async (req, res) => {
    try {
        const { prompt, mode } = req.body;
        
        if (!prompt) {
            return res.status(400).json({ error: 'Prompt is required' });
        }
        
        console.log('Image generation:', prompt.substring(0, 50) + '...', 'mode:', mode);
        
        // Emoji mode - generate SVG emoji art
        if (mode === 'emoji') {
            const emojiSvg = generateEmojiArt(prompt);
            return res.json({ success: true, imageUrl: emojiSvg });
        }
        
        // Check for image API
        if (!process.env.HUGGINGFACE_API_KEY && !process.env.OPENAI_API_KEY) {
            // Fallback to emoji if no image API
            const emojiSvg = generateEmojiArt(prompt);
            return res.json({ success: true, imageUrl: emojiSvg, fallback: true });
        }
        
        // Try Hugging Face first (free)
        if (process.env.HUGGINGFACE_API_KEY) {
            try {
                const hfRes = await fetch('https://api-inference.huggingface.co/models/stabilityai/stable-diffusion-xl-base-1.0', {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${process.env.HUGGINGFACE_API_KEY}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ inputs: prompt })
                });
                
                if (hfRes.ok) {
                    const buffer = await hfRes.arrayBuffer();
                    const base64 = Buffer.from(buffer).toString('base64');
                    return res.json({ success: true, imageUrl: `data:image/png;base64,${base64}` });
                }
            } catch (hfError) {
                console.error('HuggingFace error:', hfError);
            }
        }
        
        // Fallback to emoji art
        const emojiSvg = generateEmojiArt(prompt);
        res.json({ success: true, imageUrl: emojiSvg, fallback: true });
        
    } catch (error) {
        console.error('Image error:', error);
        res.status(500).json({ error: `Failed to generate image: ${error.message}` });
    }
});

// Helper: Generate emoji-based SVG art
function generateEmojiArt(prompt) {
    const promptLower = prompt.toLowerCase();
    
    // Map keywords to emojis
    const emojiMap = {
        'cat': '🐱', 'dog': '🐕', 'sun': '☀️', 'moon': '🌙', 'star': '⭐',
        'heart': '❤️', 'love': '💕', 'happy': '😊', 'sad': '😢', 'tree': '🌳',
        'flower': '🌸', 'ocean': '🌊', 'mountain': '⛰️', 'fire': '🔥', 'water': '💧',
        'car': '🚗', 'house': '🏠', 'food': '🍕', 'music': '🎵', 'book': '📚',
        'game': '🎮', 'sport': '⚽', 'art': '🎨', 'code': '💻', 'robot': '🤖',
        'space': '🚀', 'planet': '🪐', 'rain': '🌧️', 'snow': '❄️', 'rainbow': '🌈'
    };
    
    // Find matching emojis
    let emojis = [];
    for (const [key, emoji] of Object.entries(emojiMap)) {
        if (promptLower.includes(key)) emojis.push(emoji);
    }
    
    // Default emojis if none found
    if (emojis.length === 0) emojis = ['✨', '🎨', '💫', '🌟'];
    
    // Generate SVG
    const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD', '#98D8C8'];
    const bgColor = colors[Math.floor(Math.random() * colors.length)];
    
    let emojiElements = '';
    for (let i = 0; i < 15; i++) {
        const emoji = emojis[i % emojis.length];
        const x = 20 + Math.random() * 260;
        const y = 20 + Math.random() * 260;
        const size = 20 + Math.random() * 30;
        const rotation = Math.random() * 360;
        emojiElements += `<text x="${x}" y="${y}" font-size="${size}" transform="rotate(${rotation} ${x} ${y})">${emoji}</text>`;
    }
    
    // Main emoji in center
    const mainEmoji = emojis[0];
    emojiElements += `<text x="150" y="170" font-size="80" text-anchor="middle">${mainEmoji}</text>`;
    
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="300" viewBox="0 0 300 300">
        <defs><linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style="stop-color:${bgColor};stop-opacity:1" />
            <stop offset="100%" style="stop-color:${colors[(colors.indexOf(bgColor) + 1) % colors.length]};stop-opacity:1" />
        </linearGradient></defs>
        <rect width="300" height="300" fill="url(#bg)" rx="15"/>
        ${emojiElements}
    </svg>`;
    
    return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

// API endpoint for the coding agent
app.post('/api/coding-agent', async (req, res) => {
    try {
        const { prompt, currentProject, currentFile, mode, history } = req.body;
        
        if (!prompt) {
            return res.status(400).json({ error: 'Prompt is required' });
        }
        
        console.log('Coding agent received prompt:', prompt, 'mode:', mode);
        
        // Check if at least one API is configured
        if (!process.env.OPENAI_API_KEY && !process.env.GROQ_API_KEY) {
            return res.status(500).json({ 
                error: 'No AI API key configured. Please set either OPENAI_API_KEY or GROQ_API_KEY in your .env file.' 
            });
        }
        
        // ELITE Senior Engineer System Prompt
        const systemPrompt = `You are a LEGENDARY Senior Software Engineer with 20+ years experience at top tech companies. You write ELITE-LEVEL code that wins awards and sets industry standards.

## YOUR LEGENDARY EXPERTISE
- Advanced System Design & Architecture
- Enterprise-Level Clean Code & SOLID Principles  
- Cutting-Edge Performance Optimization
- Military-Grade Security Best Practices
- Latest Modern Tech Stacks
- DevOps & Advanced CI/CD

## LEGENDARY ITERATIVE DEVELOPMENT MASTERY

### Core Principle: NEVER START FROM SCRATCH
When a project already exists, you MUST:
1. ANALYZE existing code thoroughly
2. UNDERSTAND current functionality
3. MODIFY and ENHANCE incrementally
4. PRESERVE working features
5. BUILD upon existing foundation

### Handling User Requests:

**"Make me a page saying feeling bored well congrats"** → Create an AMAZING animated page with:
- Stunning CSS animations and transitions
- Interactive elements that respond to user
- Modern design with gradients, shadows, and effects
- Smooth scrolling and micro-interactions
- Advanced CSS techniques (keyframes, transforms, filters)
- Professional typography and layout

**"Make it better"** → Enhance existing page (add advanced animations)
**"Change color to blue"** → Modify CSS only
**"Add animation"** → Enhance with JavaScript/CSS animations
**"Make it responsive"** → Add media queries to existing CSS

### Modification Patterns:

**Adding to existing CSS:**
\`\`\`css
/* ADDING to existing styles.css */
.animated-element { /* enhancement */ }
\`\`\`

**Updating HTML content:**
\`\`\`html
<!-- MODIFYING existing index.html -->
<div class="animated-feeling">feeling bored well congrats</div>
\`\`\`

**Extending JavaScript:**
\`\`\`javascript
// EXTENDING existing script.js
function enhancedAnimation() { /* new functionality */ }
\`\`\`

## LEGENDARY CODE QUALITY STANDARDS (NON-NEGOTIABLE)

### Architecture
- Proper separation of concerns (MVC, MVVM, Clean Architecture)
- Dependency injection where appropriate
- Interface-based design for testability
- Error boundaries and graceful degradation

### Code Style
- Descriptive variable/function names (no single letters except loops)
- Functions do ONE thing (max 20-30 lines)
- DRY - Don't Repeat Yourself
- KISS - Keep It Simple
- Comments explain WHY, not WHAT

### Error Handling
- Try-catch with specific error types
- User-friendly error messages
- Logging for debugging
- Fallback behaviors

### Security
- Input validation & sanitization
- XSS prevention (escape HTML)
- CSRF protection
- Environment variables for secrets
- SQL injection prevention (parameterized queries)

### Performance
- Lazy loading & code splitting
- Debounce/throttle where needed
- Efficient DOM manipulation
- Caching strategies
- Optimized assets

## OUTPUT FORMAT

For EACH file, use EXACTLY this format:

**📄 filename.ext**
\`\`\`language
// Full production code here
\`\`\`

## TECH STACK DECISIONS

**Animated Web App with Advanced Features:**
- HTML5 + CSS3 + Vanilla JS (advanced animations)
- Modern CSS features: Flexbox, Grid, Custom Properties, Animations
- CSS Keyframes for complex animations
- JavaScript for interactive elements
- Modern ES6+ features

**Interactive Web App:**
- React 18 + Vite (fast, modern)
- Tailwind CSS or CSS Modules
- React Router for navigation
- Zustand or Context for state

**Full-Stack App:**
- Next.js 14 (App Router)
- TypeScript for type safety
- Prisma + PostgreSQL
- NextAuth.js for auth

**API/Backend:**
- Node.js + Express + TypeScript
- Zod for validation
- JWT authentication
- Rate limiting & CORS

**Real-time App:**
- Socket.io or WebSockets
- Redis for pub/sub
- Event-driven architecture

## COMPLETE FILE REQUIREMENTS

Every file MUST include:
1. All imports at top
2. Type definitions (if TypeScript)
3. Constants/config separated
4. Main logic with error handling
5. Exports at bottom
6. NO placeholder comments like "// add more here"
7. NO incomplete implementations
8. NO "TODO" comments - implement it NOW

## EXAMPLE QUALITY

BAD (never do this):
\`\`\`js
function handleClick() {
  // handle click
}
\`\`\`

GOOD (always do this):
\`\`\`js
/**
 * Handles form submission with validation and error handling
 * @param {Event} event - Form submit event
 */
async function handleFormSubmit(event) {
  event.preventDefault();
  
  const formData = new FormData(event.target);
  const data = Object.fromEntries(formData);
  
  // Validate required fields
  if (!data.email || !isValidEmail(data.email)) {
    showError('Please enter a valid email address');
    return;
  }
  
  try {
    setLoading(true);
    const response = await fetch('/api/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    
    if (!response.ok) {
      throw new Error(\`Server error: \${response.status}\`);
    }
    
    const result = await response.json();
    showSuccess('Form submitted successfully!');
    event.target.reset();
    
  } catch (error) {
    console.error('Form submission failed:', error);
    showError('Something went wrong. Please try again.');
  } finally {
    setLoading(false);
  }
}
\`\`\`

## RESPONSE STRUCTURE

1. **Quick Overview** (2-3 sentences max)
2. **Tech Stack** (with brief reasoning)
3. **File Structure** (tree view)
4. **ALL CODE FILES** (complete, production-ready)
5. **Setup Commands** (copy-paste ready)
6. **How to Run** (step by step)

## ABSOLUTE LEGENDARY RULES
- NEVER say "you could add..." - ADD IT NOW
- NEVER use placeholder text - use real content
- NEVER skip error handling
- NEVER write incomplete functions
- ALWAYS include CSS (STUNNING, not ugly)
- ALWAYS make it mobile responsive
- ALWAYS add loading states
- ALWAYS handle edge cases
- ALWAYS include ADVANCED ANIMATIONS
- ALWAYS make it INTERACTIVE
- Code must RUN without modification
- Code must be PROFESSIONAL GRADE
- Code must be AWARD-WINNING QUALITY`;

        // Prepare the user message with current project context
        let userMessage = `Current project context:

${JSON.stringify(currentProject, null, 2)}

User request: ${prompt}`;
        
        if (!currentProject || Object.keys(currentProject.files || {}).length === 0) {
            userMessage = `Create a new project based on this request: ${prompt}`;
        }

        // Try OpenAI first, then fall back to Groq
        let response;
        let providerUsed;

        if (process.env.OPENAI_API_KEY) {
            const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
            
            const completion = await openai.chat.completions.create({
                model: "gpt-3.5-turbo",
                messages: [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: userMessage }
                ],
                max_tokens: 4000,
                temperature: 0.7
            });

            response = completion.choices[0].message.content;
            providerUsed = 'openai';
        } else if (process.env.GROQ_API_KEY) {
            // Using fetch for Groq API
            const groqResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model: "llama-3.3-70b-versatile",
                    messages: [
                        { role: "system", content: systemPrompt },
                        { role: "user", content: userMessage }
                    ],
                    max_tokens: 8000,
                    temperature: 0.3
                })
            });

            if (!groqResponse.ok) {
                const errText = await groqResponse.text();
                console.error('Groq coding agent error:', errText);
                
                // Check for rate limit / quota
                if (groqResponse.status === 429 || errText.includes('rate_limit') || errText.includes('tokens') || errText.includes('quota')) {
                    return res.status(429).json({ 
                        error: '⏳ Out of tokens! You\'ve reached the free tier limit. Please wait 1-2 minutes and try again, or upgrade for unlimited access.' 
                    });
                }
                throw new Error(`Groq API error: ${groqResponse.status}`);
            }

            const groqData = await groqResponse.json();
            response = groqData.choices[0].message.content;
            providerUsed = 'groq';
        }

        // Parse the response to extract code blocks and file suggestions
        const parsedResponse = parseCodeBlocks(response);

        res.json({
            success: true,
            response: response,
            files: parsedResponse.files,
            provider: providerUsed
        });

    } catch (error) {
        console.error('Error in coding agent:', error);
        res.status(500).json({ 
            error: `Server error in coding agent: ${error.message}` 
        });
    }
});

// Helper function to parse code blocks from AI response
function parseCodeBlocks(text) {
    const files = {};
    const codeBlockRegex = /```(\w+)?\s*\n?(.*?)\n?```/gs;
    let match;
    
    while ((match = codeBlockRegex.exec(text)) !== null) {
        const language = match[1] || '';
        const content = match[2];
        
        // Look for filename hints in the surrounding text
        const prevText = text.substring(0, match.index);
        const filenameMatch = prevText.match(/(?:create|modify|update|file)[:\s`"]*([^\n`"<>|*?]+)(?:\.[a-zA-Z0-9]+)?/i);
        
        if (filenameMatch) {
            let filename = filenameMatch[1].trim();
            if (!filename.includes('.')) {
                // Add extension based on language if not present
                const extMap = {
                    'html': '.html',
                    'css': '.css',
                    'javascript': '.js',
                    'js': '.js',
                    'json': '.json',
                    'sql': '.sql',
                    'python': '.py',
                    'php': '.php',
                    'java': '.java',
                    'cpp': '.cpp',
                    'c': '.c',
                    'ts': '.ts',
                    'tsx': '.tsx',
                    'jsx': '.jsx',
                    'md': '.md',
                    'txt': '.txt'
                };
                filename += extMap[language.toLowerCase()] || '.txt';
            }
            files[filename] = content.trim();
        }
    }
    
    return { files };
}

// Endpoint to get all games
app.get('/api/games', (req, res) => {
    res.json(games);
});

// Endpoint to add/update a game
app.post('/api/games', async (req, res) => {
    const game = req.body;
    if (!game.id) {
        return res.status(400).json({ error: 'Game ID is required' });
    }
    
    const existingIndex = games.findIndex(g => g.id === game.id);
    if (existingIndex > -1) {
        games[existingIndex] = { ...games[existingIndex], ...game };
    } else {
        games.push(game);
    }
    
    await saveGames();
    res.json({ success: true, game });
});

// Endpoint to get a specific game
app.get('/api/games/:id', (req, res) => {
    const game = games.find(g => g.id === req.params.id);
    if (!game) {
        return res.status(404).json({ error: 'Game not found' });
    }
    res.json(game);
});

// Endpoint to delete a game
app.delete('/api/games/:id', async (req, res) => {
    const gameId = req.params.id;
    const initialLength = games.length;
    games = games.filter(g => g.id !== gameId);
    
    if (games.length === initialLength) {
        return res.status(404).json({ error: 'Game not found' });
    }
    
    await saveGames();
    res.json({ success: true });
});

// Endpoint to get conversation
app.get('/api/conversation/:id', (req, res) => {
    const conversation = conversations[req.params.id];
    res.json(conversation || { messages: [], settings: {} });
});

// Endpoint to save conversation
app.post('/api/conversation/:id', (req, res) => {
    const { id } = req.params;
    conversations[id] = req.body;
    res.json({ success: true });
});

// Endpoint to delete conversation
app.delete('/api/conversation/:id', (req, res) => {
    delete conversations[req.params.id];
    res.json({ success: true });
});

// Endpoint to get all conversations (metadata only)
app.get('/api/conversations', (req, res) => {
    const metadata = Object.entries(conversations).map(([id, conv]) => ({
        id,
        title: conv.title || 'Untitled Conversation',
        lastUpdated: conv.lastUpdated || Date.now()
    }));
    res.json(metadata);
});

// Serve admin panel
app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'admin.html'));
});

// Serve login page
app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, 'login.html'));
});

// Serve diagnostics page
app.get('/diagnostics', (req, res) => {
    res.sendFile(path.join(__dirname, 'diagnostics.html'));
});

// Serve games page
app.get('/games', (req, res) => {
    res.sendFile(path.join(__dirname, 'games.html'));
});

// Serve the main page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Handle 404 for undefined routes
app.use((req, res) => {
    res.status(404).sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});