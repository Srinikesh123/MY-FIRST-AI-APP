# API URL Patch for Production Deployment

## Issue
The frontend is hardcoded to connect to `http://localhost:3000` even when deployed to Vercel, causing CORS errors.

## Solution
Update the API URL in `app.js` to work dynamically in both development and production.

## Manual Update Required

### Location
File: `app.js`
Line: ~5
Current code:
```javascript
this.apiUrl = 'http://localhost:3000/api';
```

### Change to
```javascript
// Use dynamic API URL for production deployment
this.apiUrl = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' 
    ? 'http://localhost:3000/api' 
    : `${window.location.origin}/api`;
```

### Why This Fix Is Needed
- When running locally, it will continue to use `http://localhost:3000/api`
- When deployed to Vercel/Render, it will use the current domain (e.g., `https://my-first-ai-app-2026.vercel.app/api`)
- This eliminates CORS issues and ensures API calls go to the correct domain

### How to Apply
1. Open `app.js` in a text editor
2. Find line 5 (the line with `this.apiUrl = 'http://localhost:3000/api';`)
3. Replace it with the dynamic version above
4. Save the file

## Alternative Method: Using sed command (Linux/Mac/WSL)
If you're using Linux, Mac, or WSL, you can run this command in your terminal:
```bash
sed -i '5s|this.apiUrl = '\''http://localhost:3000/api'\'';|this.apiUrl = window.location.hostname === '\''localhost'\'' || window.location.hostname === '\''127.0.0.1'\'' \? '\''http://localhost:3000/api'\'' \: `\${window.location.origin}/api`;|' app.js
```

## Alternative Method: Using PowerShell (Windows)
If you're using Windows PowerShell, you can run these commands:
```powershell
$content = Get-Content app.js
$content[4] = "// Use dynamic API URL for production deployment"
$content[5] = "this.apiUrl = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' ? 'http://localhost:3000/api' : `${window.location.origin}/api`;"
$content | Set-Content app.js
```

This will fix the CORS errors you're experiencing when accessing the deployed application.