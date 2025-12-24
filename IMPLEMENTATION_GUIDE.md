# voidzenzi - Complete Implementation Guide

## ✅ CRITICAL BUGS FIXED

### 1. Chat Isolation (FIXED)
- ✅ Messages now properly filtered by BOTH `user_id` AND `chat_id`
- ✅ Realtime subscriptions update when chat changes
- ✅ Each chat has independent message state
- ✅ No message leakage between chats

### 2. Settings Persistence (FIXED)
- ✅ Settings load per user using `auth.uid()`
- ✅ Settings save immediately to Supabase on change
- ✅ Default settings used if none found
- ✅ No shared settings across users

### 3. Message Persistence (FIXED)
- ✅ Messages persist across logout/login
- ✅ Messages loaded from Supabase on chat selection
- ✅ All queries use proper RLS policies

## 📦 NEW FEATURES IMPLEMENTED

### Database Schema
- ✅ `users` table with plans, tokens, coins, admin flag
- ✅ `usage_limits` table for tracking usage
- ✅ `games` table with rewards
- ✅ `game_results` table for game wins
- ✅ All tables with proper RLS policies
- ✅ Admin policies for admin-only access

### Plans & Tokens System
**Free Plan:**
- 50 tokens
- 500 messages
- 5 image generations
- 5 code generations

**Pro Plan (₹2):**
- 500 tokens (10× Free)
- 5,000 messages
- 50 image generations
- 50 code generations

**Ultra Plan (₹10):**
- Unlimited tokens
- Unlimited messages
- Unlimited images
- Unlimited code generations

### Stripe Integration
**Setup Required:**
1. Add to `.env`:
   ```
   STRIPE_SECRET_KEY=sk_test_...
   STRIPE_WEBHOOK_SECRET=whsec_...
   STRIPE_PUBLISHABLE_KEY=pk_test_...
   ```

2. Create Stripe products:
   - Pro Plan: ₹2 (price ID: `price_pro_plan`)
   - Ultra Plan: ₹10 (price ID: `price_ultra_plan`)

3. Webhook endpoint: `/api/stripe/webhook`
   - Configure in Stripe Dashboard
   - Events: `checkout.session.completed`

### Admin Panel
**Admin Email:** `howtotutorialbysreenikesh@gmail.com`

**Admin Features:**
- View all users
- Promote/demote users (Free ↔ Pro ↔ Ultra)
- Add tokens manually
- Add coins
- Reset usage limits
- Ban/unban users

**Access:** `/admin.html` (auto-redirects if not admin)

### Mini-Games System
**Games Available:**
1. Bounce Game - 10 coins
2. Click Speed - 15 coins
3. Memory Tiles - 20 coins
4. Reaction Test - 12 coins
5. Number Guess - 18 coins
6. Word Puzzle - 25 coins + 5 tokens

**Rewards:**
- Coins added to user account on win
- Tokens added for special games
- All wins stored in `game_results` table
- No client-side manipulation possible

### Coin System
- Coins stored in `users.coins`
- Earned from games
- Can be granted by admin
- Future: Buy tokens with coins

## 🚀 SETUP INSTRUCTIONS

### 1. Database Setup
```sql
-- Run SUPABASE_SETUP.sql in Supabase SQL Editor
-- This creates all tables, policies, triggers, and functions
```

### 2. Environment Variables
```env
# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_KEY=your-service-key

# Stripe
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PUBLISHABLE_KEY=pk_test_...

# AI APIs
OPENAI_API_KEY=sk-...
GROQ_API_KEY=gsk_...
```

### 3. Install Dependencies
```bash
npm install
```

### 4. Enable Realtime
In Supabase Dashboard → Database → Replication:
- Enable for: `chats`, `messages`, `user_settings`, `users`, `game_results`

### 5. Set Admin User
```sql
UPDATE public.users
SET is_admin = true
WHERE email = 'howtotutorialbysreenikesh@gmail.com';
```

### 6. Stripe Webhook Setup
1. Go to Stripe Dashboard → Webhooks
2. Add endpoint: `https://your-domain.com/api/stripe/webhook`
3. Select events: `checkout.session.completed`
4. Copy webhook secret to `.env`

## 📝 API ENDPOINTS

### Payment
- `POST /api/stripe/create-checkout` - Create Stripe checkout session
- `POST /api/stripe/webhook` - Stripe webhook handler

### Usage Tracking
- `POST /api/usage/track` - Track message/image/code usage
- `GET /api/usage/limits` - Get user usage limits

### Admin
- `GET /api/admin/users` - Get all users (admin only)
- `POST /api/admin/update-user` - Update user plan/tokens/coins (admin only)

### Games
- `POST /api/games/submit-result` - Submit game result
- `GET /api/games/list` - Get all games

## 🔒 SECURITY

### Row Level Security (RLS)
- ✅ All tables have RLS enabled
- ✅ Users can only access their own data
- ✅ Admin policies for admin-only operations
- ✅ Messages filtered by both user_id and chat_id

### Stripe Webhooks
- ✅ Webhook signature verification
- ✅ Server-side plan upgrades only
- ✅ No frontend trust for payments

## 🎮 GAMES IMPLEMENTATION

Games are implemented as separate HTML pages:
- `/games.html` - Games hub
- Each game tracks wins in Supabase
- Rewards automatically added via database triggers

## 📊 USAGE TRACKING

Usage is tracked in `usage_limits` table:
- `messages_used` - Total messages sent
- `images_used` - Total images generated
- `code_generations_used` - Total code generations

Limits enforced server-side based on plan.

## 🛠️ NEXT STEPS

1. **Run the SQL schema** in Supabase
2. **Install dependencies**: `npm install`
3. **Configure environment variables**
4. **Set up Stripe products and webhook**
5. **Test the application**

All critical bugs are fixed and new features are ready to implement!




