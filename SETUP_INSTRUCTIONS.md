# Setup Instructions for AI Assistant

## 🔧 Fixing Login & Database Issues

### Step 1: Disable Email Confirmation in Supabase

1. Go to your Supabase Dashboard: https://supabase.com/dashboard
2. Select your project
3. Go to **Authentication** → **Providers** → **Email**
4. **Turn OFF** "Confirm email" toggle
5. Save changes

This will allow users to login immediately after registration without email verification.

### Step 2: Create the Database Table

1. In Supabase Dashboard, go to **SQL Editor**
2. Click **New Query**
3. Open the file `SUPABASE_SETUP.sql` in this folder
4. Copy and paste all the SQL code into the SQL Editor
5. Click **Run** (or press Ctrl+Enter)
6. You should see "Success. No rows returned"

This creates the `chat_messages` table and sets up security policies.

### Step 3: Verify Everything Works

1. **Test Registration:**
   - Go to `login.html`
   - Click "Register" tab
   - Fill in name, email, password
   - Try dragging an emoji onto the profile picture preview (drag and drop!)
   - Click Register
   - You should be redirected to the chat page

2. **Test Login:**
   - Logout (if needed)
   - Go to `login.html`
   - Enter your email and password
   - Click Login
   - You should be redirected to the chat page

3. **Test Database Saving:**
   - Open browser console (F12)
   - Send a message in the chat
   - Check console for "Message saved to Supabase" log
   - If you see an error about table not existing, go back to Step 2

## 🐛 Troubleshooting

### "Invalid login credentials"
- Make sure email confirmation is disabled (Step 1)
- Double-check your email and password
- Try registering a new account

### "Chat messages not saving"
- Make sure you ran the SQL from `SUPABASE_SETUP.sql` (Step 2)
- Check browser console (F12) for error messages
- Verify you're logged in (check console for "User authenticated")

### "Email not confirmed"
- This means email confirmation is still enabled
- Go to Step 1 and disable it

## ✨ New Features Added

- **Drag & Drop Emojis:** You can now drag emoji avatars onto the profile picture preview during registration!
- **Better Error Messages:** More helpful error messages to guide you through setup
- **Debug Logging:** Console logs help identify connection issues

## 📝 Notes

- All chat messages are stored per user in Supabase
- Each chat session has a unique session ID
- Messages are automatically saved when sent
- Check browser console (F12) for detailed logs





