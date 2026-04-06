# 🔧 Fix: Infinite Recursion in RLS Policies

## Problem
You're seeing this error:
```
infinite recursion detected in policy for relation "users"
```

## Root Cause
The RLS (Row Level Security) policies for the `users` table are checking if a user is an admin by querying the `users` table itself. This creates an infinite loop:
1. Policy checks: "Is this user an admin?"
2. Policy queries `users` table to check `is_admin`
3. Query triggers the same policy check again
4. Infinite recursion! 🔄

## Solution
We need to create a **SECURITY DEFINER function** that bypasses RLS to check admin status, then use that function in the policies.

## Steps to Fix

### Step 1: Open Supabase SQL Editor
1. Go to: https://supabase.com/dashboard
2. Select your project
3. Click **SQL Editor** (left sidebar)
4. Click **New Query**

### Step 2: Run the Fix SQL
1. Open the file `FIX_RLS_INFINITE_RECURSION.sql` in this project
2. Copy **ALL** the SQL code
3. Paste it into the Supabase SQL Editor
4. Click **Run** (or press Ctrl+Enter)

### Step 3: Verify the Fix
After running the SQL:
1. Refresh your application
2. Try loading the admin panel again
3. The infinite recursion error should be gone! ✅

## What the Fix Does

1. **Creates `is_admin()` function**: A SECURITY DEFINER function that can check admin status without triggering RLS
2. **Updates admin policies**: Replaces the recursive queries with calls to `is_admin()`
3. **Fixes multiple tables**: Updates policies in `users`, `usage_limits`, and `game_results` tables

## Additional Notes

### Coin Saving Issue
The coin saving issue is likely related to the same RLS problem. After fixing the RLS policies, coin updates should work properly. The system uses:
- **Server API** (`/api/games/award-coins`) - Uses service key, bypasses RLS ✅
- **Database trigger** (`award_game_rewards()`) - Uses SECURITY DEFINER, bypasses RLS ✅

### CORS Errors
The CORS errors you're seeing are likely network-related (browser blocking requests). These should resolve once the RLS issue is fixed and the app can properly authenticate.

## Testing After Fix

1. ✅ Admin panel should load users without errors
2. ✅ User profile should load without errors  
3. ✅ Coins should save properly after games
4. ✅ All user queries should work normally

## Need Help?

If you still see errors after running the fix:
1. Check the Supabase SQL Editor for any error messages
2. Verify your user has `is_admin = true` set in the database
3. Check the browser console for any remaining errors

