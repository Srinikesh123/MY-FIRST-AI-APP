# Vercel Deployment Checklist - FINAL

## Pre-Push Checklist

### 1. Critical File Update (MANUAL REQUIRED)
- [ ] **Update app.js manually** following instructions in `UPDATE_INSTRUCTIONS.md`
- [ ] **Verify** the change was made correctly (check line 5-6 in app.js)
- [ ] **Save** the updated app.js file

### 2. Verify Configuration Files
- [ ] `vercel.json` exists and is properly configured for Node.js deployment
- [ ] `package.json` has correct dependencies
- [ ] `server.js` has the catch-all route for SPA behavior
- [ ] Environment variables are set in Vercel dashboard

## Push to GitHub & Deploy to Vercel

### 3. Commit Changes
```bash
git add .
git commit -m "Fix API URL for production deployment"
git push origin main
```

### 4. Vercel Deployment
- [ ] Go to https://vercel.com
- [ ] Your project should auto-deploy after the push
- [ ] Wait for build to complete successfully
- [ ] Note the deployment URL (should be `https://my-first-ai-app-2026.vercel.app/`)

## Post-Deployment Setup

### 5. Configure Supabase for Production
- [ ] Go to your Supabase dashboard
- [ ] Navigate to Authentication > URL Configuration
- [ ] Add your Vercel domain (`https://my-first-ai-app-2026.vercel.app`) to:
  - **Redirect URLs**: `https://my-first-ai-app-2026.vercel.app/*`
  - **Site URL**: `https://my-first-ai-app-2026.vercel.app`
- [ ] Save the changes

## Final Testing

### 6. Test the Application
- [ ] Visit `https://my-first-ai-app-2026.vercel.app/`
- [ ] Verify no CORS errors in browser console
- [ ] Test chat functionality
- [ ] Test mode switching (typing `/` to show dropdown)
- [ ] Test all 4 modes: normal, detailed, picture, code
- [ ] Verify API calls go to the correct domain

## Troubleshooting

### If Issues Persist:
1. **Check browser console** for error messages
2. **Verify app.js** was updated correctly
3. **Confirm Supabase configuration** includes your Vercel domain
4. **Check Vercel logs** for deployment errors
5. **Ensure environment variables** are set in Vercel dashboard

## Success Criteria
- [ ] Application loads without CORS errors
- [ ] API calls work (no more localhost references)
- [ ] All modes function correctly
- [ ] Supabase authentication works
- [ ] Full functionality available at `https://my-first-ai-app-2026.vercel.app/`