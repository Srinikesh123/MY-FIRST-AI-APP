# Deployment Checklist for AI Assistant App

## Pre-Deployment Tasks

### Security
- [ ] Update JWT_SECRET in `.env` to a strong random string
- [ ] Remove any exposed API keys from `.env` file
- [ ] Review code for any hardcoded sensitive information
- [ ] Ensure database connection is secure

### Mode System Verification
- [ ] Verify mode-system.js is properly included in index.html
- [ ] Test all 4 modes: `/normal`, `/detailed`, `/picture`, `/code`
- [ ] Confirm dropdown appears when typing `/`
- [ ] Verify keyboard navigation (arrows, enter, escape)
- [ ] Apply patch from PATCH_INSTRUCTIONS.md to app.js
- [ ] Test mode switching functionality end-to-end

### Backend Configuration
- [ ] Verify server.js handles all mode types
- [ ] Test API endpoints are working
- [ ] Confirm database connections work properly
- [ ] Validate image generation functionality
- [ ] Test chat functionality with different modes

### Frontend Configuration
- [ ] Confirm all HTML files are properly linked
- [ ] Verify CSS styling is correct
- [ ] Test responsive design on different screen sizes
- [ ] Check all JavaScript files load without errors
- [ ] Validate form submissions work properly

## Deployment to Render (Full-Stack)

### Repository Preparation
- [ ] Push all code to GitHub repository
- [ ] Ensure render.yaml exists in root directory
- [ ] Verify package.json has correct start script
- [ ] Test locally with `npm start`

### Render Setup
- [ ] Create Render account
- [ ] Connect to GitHub repository
- [ ] Select correct repository
- [ ] Configure build command: `npm install`
- [ ] Configure start command: `npm start`

### Environment Variables on Render
- [ ] `NODE_ENV`: `production`
- [ ] `GROQ_API_KEY`: Your GROQ API key
- [ ] `OPENAI_API_KEY`: Your OpenAI API key (optional)
- [ ] `SUPABASE_URL`: Your Supabase project URL
- [ ] `SUPABASE_SERVICE_KEY`: Your Supabase service role key
- [ ] `JWT_SECRET`: A strong random secret for JWT tokens
- [ ] `HUGGINGFACE_API_KEY`: Your Hugging Face API key (for image generation)
- [ ] `PORT`: Port for the server (typically 10000 on Render)

### Full-Stack Verification
- [ ] Confirm backend deploys without errors
- [ ] Verify health check endpoint works (`/health`)
- [ ] Test API endpoints with deployed URL
- [ ] Confirm static files (HTML, CSS, JS) are served properly
- [ ] Test frontend loads correctly at root URL
- [ ] Confirm database connectivity
- [ ] Validate all modes work on deployed backend
- [ ] Test complete application functionality end-to-end

## Post-Deployment Testing

### Mode System Testing
- [ ] Test `/normal` mode functionality
- [ ] Test `/detailed` mode functionality
- [ ] Test `/picture` mode functionality
- [ ] Test `/code` mode functionality
- [ ] Verify dropdown appearance and navigation
- [ ] Confirm mode indicator displays correctly

### Full Application Testing
- [ ] Complete end-to-end chat functionality
- [ ] Test image generation (if applicable)
- [ ] Verify user authentication (if implemented)
- [ ] Test error handling and recovery
- [ ] Validate responsive design on mobile

### Performance Testing
- [ ] Check page load speeds
- [ ] Verify API response times
- [ ] Test concurrent user sessions
- [ ] Monitor resource usage

## Security Verification

### Backend Security
- [ ] Verify API keys are not exposed
- [ ] Confirm JWT tokens are properly secured
- [ ] Check database access controls
- [ ] Validate input sanitization

### Frontend Security
- [ ] Confirm no sensitive data in client-side code
- [ ] Verify secure API communication (HTTPS)
- [ ] Check for XSS vulnerabilities
- [ ] Validate CSRF protection

## Monitoring & Maintenance

### Logging Setup
- [ ] Configure error logging
- [ ] Set up performance monitoring
- [ ] Monitor API usage
- [ ] Track user engagement metrics

### Backup Strategy
- [ ] Database backup schedule
- [ ] Code repository backup
- [ ] Configuration backup
- [ ] API key backup (securely stored)

### Maintenance Schedule
- [ ] Regular dependency updates
- [ ] Security patching
- [ ] Performance optimization
- [ ] Database maintenance

## Go-Live Checklist

### Final Verification
- [ ] All features working in production
- [ ] Security measures in place
- [ ] Monitoring configured
- [ ] Rollback plan ready
- [ ] Documentation updated

### Launch
- [ ] Update DNS records (if applicable)
- [ ] Announce to users
- [ ] Monitor initial usage
- [ ] Collect feedback
- [ ] Iterate based on user feedback

## Rollback Plan
- [ ] Document rollback procedures
- [ ] Have previous version ready
- [ ] Database migration rollback steps
- [ ] Communication plan for users

---

**Deployed URL:**
- Application (Render): ________________

**API Endpoint:**
- Backend URL: ________________