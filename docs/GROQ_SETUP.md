# Quick Setup: Groq API (Free Alternative)

Since you're experiencing OpenAI quota issues, here's how to set up Groq (FREE) as a fallback:

## Step 1: Get Your Free Groq API Key

1. Go to: https://console.groq.com/
2. Sign up for a free account (no credit card required!)
3. Navigate to API Keys: https://console.groq.com/keys
4. Click "Create API Key"
5. Copy your API key

## Step 2: Add to .env File

Open your `.env` file and add:

```
GROQ_API_KEY=your_groq_api_key_here
```

## Step 3: Restart Server

The server will now:
- Try OpenAI first
- **Automatically switch to Groq** if OpenAI quota is exceeded
- Use Groq directly if OpenAI is not configured

## Benefits of Groq

✅ **100% FREE** - No credit card needed
✅ **Very Fast** - Uses optimized hardware
✅ **Open Source Models** - Uses Llama models (same as ChatGPT alternatives)
✅ **No Quota Limits** - Generous free tier
✅ **Automatic Fallback** - Works seamlessly when OpenAI has issues

## Models Available

- `llama-3.1-8b-instant` (default - fastest, good quality)
- `llama-3.1-70b-versatile` (more capable, slightly slower)
- `mixtral-8x7b-32768` (excellent for longer contexts)

The server is already configured to use Groq automatically when OpenAI fails!

