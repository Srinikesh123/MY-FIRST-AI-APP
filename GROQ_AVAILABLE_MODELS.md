# Groq Available Models (Updated March 2026)
# These are the actual models available through your GROQ_API_KEY

## Current Configuration:
GROQ_MODEL=llama-3.1-8b-instant

## All Available Models Through Groq:

### Llama Models (Recommended):
- llama-3.1-8b-instant      # Fast, efficient (current default)
- llama-3.1-70b-versatile    # More capable, larger model
- llama-3.2-1b-preview       # Very fast, basic tasks
- llama-3.2-3b-preview       # Fast, moderate capability

### Mixtral Models:
- mixtral-8x7b-32768         # Good for complex reasoning

### Gemma Models:
- gemma2-9b-it              # Google's model, good performance

## Recommended Configurations:

### For Fast Responses:
GROQ_MODEL=llama-3.1-8b-instant

### For Better Quality:
GROQ_MODEL=llama-3.1-70b-versatile

### For Budget/Speed:
GROQ_MODEL=llama-3.2-1b-preview

### Mode-specific (Optional):
GROQ_MODEL_FAST=llama-3.1-8b-instant
GROQ_MODEL_DETAILED=llama-3.1-70b-versatile
GROQ_MODEL_CODING=llama-3.1-70b-versatile

## Important Notes:
- Groq does NOT provide OpenAI GPT models (gpt-3.5-turbo, gpt-4, etc.)
- All models use your existing GROQ_API_KEY
- Llama models provide excellent performance for most tasks
- The "instant" models are optimized for speed
