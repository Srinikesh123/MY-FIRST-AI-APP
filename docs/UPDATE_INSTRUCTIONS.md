# Critical Update Instructions for Production Deployment

## Issue
Your application is experiencing CORS errors because the frontend is hardcoded to connect to `http://localhost:3000` even when deployed to Vercel.

## Manual Fix Required (Step-by-Step)

### 1. Open `app.js` in a text editor
- Use any text editor (VS Code, Notepad++, Sublime Text, etc.)
- Navigate to your project folder
- Open the `app.js` file

### 2. Locate the problematic line
- Look for line 5 in the file
- Find this exact line:
```javascript
this.apiUrl = 'http://localhost:3000/api';
```

### 3. Replace the line
**DELETE** this line:
```javascript
this.apiUrl = 'http://localhost:3000/api';
```

**REPLACE WITH** these two lines:
```javascript
// Use dynamic API URL for production deployment
this.apiUrl = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' ? 'http://localhost:3000/api' : `${window.location.origin}/api`;
```

### 4. Save the file
- Save the changes to `app.js`
- Make sure to preserve the indentation (should be 8 spaces)

## Expected Result
After making the change, the section in your `app.js` file should look like this:
```javascript
class AIAssistant {
    constructor() {
        // Use dynamic API URL for production deployment
        this.apiUrl = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' ? 'http://localhost:3000/api' : `${window.location.origin}/api`;
        this.supabase = window.__supabaseClient || null;
```

## Why This Fix Works
- **Development**: When running locally (`localhost` or `127.0.0.1`), it uses `http://localhost:3000/api`
- **Production**: When deployed to Vercel/Render, it uses the current domain (e.g., `https://my-first-ai-app-2026.vercel.app/api`)
- **No CORS**: API calls go to the same domain, eliminating CORS issues

## Additional Required Configuration

### Update Supabase Settings
After deploying to Vercel:
1. Go to your Supabase dashboard
2. Navigate to Authentication > URL Configuration
3. Add your Vercel domain to:
   - **Redirect URLs**: `https://my-first-ai-app-2026.vercel.app/*`
   - **Site URL**: `https://my-first-ai-app-2026.vercel.app`

## Deploy Again
- After making this change, commit and push to GitHub
- Vercel will automatically rebuild and deploy the fixed application
- Access your app at `https://my-first-ai-app-2026.vercel.app/`
- All API calls will now work correctly