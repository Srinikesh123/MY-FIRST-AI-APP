# Deployment Guide for AI Assistant App

This guide explains how to deploy your AI Assistant application to Render (backend) and Vercel (frontend).

## Prerequisites

- A GitHub repository with your code
- API keys for AI services (OpenAI, GROQ, etc.)
- Supabase project credentials
- Accounts on Render and Vercel

## Backend Deployment to Render

### 1. Prepare Your Repository
- Push all your code to a GitHub repository
- Ensure `render.yaml` is in the root directory

### 2. Connect to Render
1. Go to https://dashboard.render.com
2. Click "New +" and select "Web Service"
3. Connect to your GitHub repository
4. Select your AI Assistant repository
5. Render will automatically detect it's a Node.js project

### 3. Configure Environment Variables
Add the following environment variables in the Render dashboard:
- `NODE_ENV`: `production`
- `GROQ_API_KEY`: Your GROQ API key
- `OPENAI_API_KEY`: Your OpenAI API key (optional)
- `SUPABASE_URL`: Your Supabase project URL
- `SUPABASE_SERVICE_KEY`: Your Supabase service role key
- `JWT_SECRET`: A strong random secret for JWT tokens
- `HUGGINGFACE_API_KEY`: Your Hugging Face API key (for image generation)

### 4. Deploy
- Click "Create Web Service"
- Render will build and deploy your backend automatically
- Note the URL of your deployed backend (e.g., `https://your-app.onrender.com`)

## Frontend Deployment to Vercel

### 1. Prepare Your Frontend
The frontend will need to know the backend URL. Update the API URL in your frontend code if necessary.

### 2. Deploy to Vercel
1. Go to https://vercel.com
2. Click "New Project" and import your GitHub repository
3. Choose the repository containing your AI Assistant
4. Vercel will detect it's a static site and configure automatically
5. In the settings, make sure the Root Directory is set to the project root
6. Add any necessary environment variables if your frontend needs them

### 3. Configure Environment Variables (if needed)
Most likely your frontend doesn't need environment variables since it's static, but if needed:
- `NEXT_PUBLIC_API_URL`: The URL of your Render backend

## Configuration

### Update API Endpoint
In your frontend code, make sure the API calls point to your deployed backend:

```javascript
// In app.js or wherever API calls are made
const API_BASE_URL = process.env.API_BASE_URL || 'https://your-app.onrender.com';
// or whatever your Render backend URL is
```

## Security Best Practices

1. **Never commit API keys** to version control
2. **Use strong JWT secrets** in production
3. **Enable HTTPS** for both frontend and backend
4. **Monitor usage** of your AI API keys
5. **Set up rate limiting** to prevent abuse

## Environment Variables Reference

### Backend (Render)
- `NODE_ENV`: Set to `production` for production
- `GROQ_API_KEY`: API key for GROQ service (free tier available)
- `OPENAI_API_KEY`: API key for OpenAI (optional if using GROQ)
- `SUPABASE_URL`: URL of your Supabase project
- `SUPABASE_SERVICE_KEY`: Service role key for Supabase
- `JWT_SECRET`: Secret for signing JWT tokens (use a strong random string)
- `HUGGINGFACE_API_KEY`: API key for Hugging Face for image generation

### Frontend (Vercel)
- `NEXT_PUBLIC_API_URL`: The URL of your deployed backend service

## Troubleshooting

### Common Issues
1. **CORS errors**: Make sure your backend allows requests from your frontend domain
2. **API key errors**: Verify all API keys are correctly set in environment variables
3. **Database errors**: Check Supabase configuration and RLS policies
4. **Connection timeouts**: Ensure your backend is running and accessible

### Health Check
Your deployed backend should have a health check endpoint at `/health` that returns status information.

## Scaling

- **Backend**: Render allows you to scale instances based on traffic
- **Frontend**: Vercel automatically handles scaling for static sites
- **Database**: Scale your Supabase project as needed
- **AI APIs**: Monitor usage quotas for OpenAI/GROQ/Hugging Face

## Maintenance

- Monitor your AI API usage regularly
- Update dependencies periodically
- Backup your Supabase data regularly
- Monitor application logs for errors
- Renew API keys periodically for security