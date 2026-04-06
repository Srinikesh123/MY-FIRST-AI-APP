# Deployment Guide for AI Assistant App

This guide explains how to deploy your AI Assistant application as a monolithic application where Express serves both the API and static files.

## Prerequisites

- A GitHub repository with your code
- API keys for AI services (OpenAI, GROQ, etc.)
- Supabase project credentials
- Accounts on Vercel or Render

## Monolithic Deployment Approach

Your application is designed as a monolithic application where the Express server serves both:
- API endpoints (`/api/*`)
- Static files (HTML, CSS, JS) for the root path and other routes

This eliminates CORS issues and provides a unified domain for all functionality.

## Deployment to Vercel (Recommended for this approach)

### 1. Prepare Your Repository
- Push all your code to a GitHub repository
- Ensure `vercel.json` is in the root directory (configured for Node.js server)

### 2. Connect to Vercel
1. Go to https://vercel.com
2. Click "New Project" and import your GitHub repository
3. Select your AI Assistant repository
4. Vercel will detect it's a Node.js project based on your vercel.json
5. Make sure the Root Directory is set to the project root

### 3. Configure Environment Variables
Add the following environment variables in the Vercel dashboard:
- `NODE_ENV`: `production`
- `GROQ_API_KEY`: Your GROQ API key
- `OPENAI_API_KEY`: Your OpenAI API key (optional)
- `SUPABASE_URL`: Your Supabase project URL
- `SUPABASE_SERVICE_KEY`: Your Supabase service role key
- `JWT_SECRET`: A strong random secret for JWT tokens
- `HUGGINGFACE_API_KEY`: Your Hugging Face API key (for image generation)

### 4. Configure Supabase Authentication
After deployment, you need to update your Supabase project settings:
1. Go to your Supabase dashboard
2. Navigate to Authentication > URL Configuration
3. Add your Vercel domain (e.g., `https://my-first-ai-app-2026.vercel.app`) to:
   - **Redirect URLs**: `https://my-first-ai-app-2026.vercel.app/*`
   - **Additional URLs**: Add your domain to the list
4. Add your domain to **Site URL** field
5. Save the changes

### 5. Deploy
- Vercel will build and deploy your monolithic application automatically
- Note the URL of your deployed application (e.g., `https://your-app.vercel.app`)

## Deployment to Render (Alternative)

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
Add the same environment variables as listed above for Vercel.

### 4. Configure Supabase Authentication
Same as Vercel - update your Supabase project settings with your Render domain.

## Configuration

The Express server in `server.js` is already configured to:
- Serve static files from the root directory
- Handle API routes under `/api/*`
- Serve the main `index.html` for other routes (SPA-friendly)

## Security Best Practices

1. **Never commit API keys** to version control
2. **Use strong JWT secrets** in production
3. **Enable HTTPS** for your deployment
4. **Monitor usage** of your AI API keys
5. **Set up rate limiting** to prevent abuse

## Environment Variables Reference

### For Both Vercel and Render
- `NODE_ENV`: Set to `production` for production
- `GROQ_API_KEY`: API key for GROQ service (free tier available)
- `OPENAI_API_KEY`: API key for OpenAI (optional if using GROQ)
- `SUPABASE_URL`: URL of your Supabase project
- `SUPABASE_SERVICE_KEY`: Service role key for Supabase
- `JWT_SECRET`: Secret for signing JWT tokens (use a strong random string)
- `HUGGINGFACE_API_KEY`: API key for Hugging Face for image generation
- `PORT`: Port number for the server (provided by hosting platform)

## Troubleshooting

### Common Issues
1. **Supabase CORS errors**: Update your Supabase project settings to include your deployment domain
2. **API key errors**: Verify all API keys are correctly set in environment variables
3. **Database errors**: Check Supabase configuration and RLS policies
4. **Connection timeouts**: Ensure your server is running and accessible
5. **File not found errors**: Make sure all static files are in the correct location

### Health Check
Your deployed application should have a health check endpoint at `/health` that returns status information.

## Scaling

- **Vercel**: Automatically scales based on traffic
- **Render**: Allows you to scale instances based on traffic
- **Database**: Scale your Supabase project as needed
- **AI APIs**: Monitor usage quotas for OpenAI/GROQ/Hugging Face

## Maintenance

- Monitor your AI API usage regularly
- Update dependencies periodically
- Backup your Supabase data regularly
- Monitor application logs for errors
- Renew API keys periodically for security