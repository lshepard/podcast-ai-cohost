# Railway Deployment Guide

This guide will help you deploy the Podcast AI Co-Host application to Railway with ephemeral environments.

## Overview

The application consists of two services:
- **Backend**: Python FastAPI (port 8000)
- **Frontend**: React (port 3000)

Both services are configured to run on Railway using the included `railway.toml` files.

## Prerequisites

1. A [Railway account](https://railway.app/)
2. Railway CLI installed (optional, but recommended):
   ```bash
   npm install -g @railway/cli
   ```
3. API keys for:
   - OpenAI
   - ElevenLabs
   - AssemblyAI
   - Llama Parse (optional)

## Deployment Steps

### Option 1: Deploy via Railway Dashboard (Recommended)

#### 1. Create a New Project

1. Go to [Railway Dashboard](https://railway.app/new)
2. Click "New Project"
3. Select "Deploy from GitHub repo"
4. Authorize Railway to access your GitHub repository
5. Select your `podcast-ai-cohost` repository

#### 2. Deploy the Backend Service

1. Click "Add Service" → "GitHub Repo"
2. Configure the service:
   - **Name**: `podcast-backend`
   - **Root Directory**: `backend`
   - Railway will automatically detect the `Dockerfile`

3. Add environment variables (Settings → Variables):
   ```
   OPENAI_API_KEY=your_openai_api_key
   ELEVENLABS_API_KEY=your_elevenlabs_api_key
   ASSEMBLYAI_API_KEY=your_assemblyai_api_key
   LLAMA_PARSE_API_KEY=your_llama_parse_api_key
   LLM_MODEL=gpt-4o
   ELEVENLABS_VOICE_ID=your_voice_id
   BASIC_AUTH_USERNAME=admin
   BASIC_AUTH_PASSWORD=your_secure_password
   ```
   Note: Railway automatically sets the PORT variable, so you don't need to configure it.

4. Deploy the service

#### 3. Deploy the Frontend Service

1. Click "Add Service" → "GitHub Repo" (in the same project)
2. Configure the service:
   - **Name**: `podcast-frontend`
   - **Root Directory**: `frontend`
   - Railway will automatically detect the `Dockerfile`

3. Add environment variables:
   ```
   REACT_APP_API_URL=https://${{podcast-backend.RAILWAY_PUBLIC_DOMAIN}}/api
   REACT_APP_AUTH_USERNAME=admin
   REACT_APP_AUTH_PASSWORD=your_secure_password
   ```

4. Deploy the service

#### 4. Generate Domains

1. Go to each service's Settings
2. Click "Generate Domain" under "Networking"
3. Your services will be accessible at:
   - Backend: `https://podcast-backend-production.up.railway.app`
   - Frontend: `https://podcast-frontend-production.up.railway.app`

### Option 2: Deploy via Railway CLI

#### 1. Login to Railway

```bash
railway login
```

#### 2. Initialize Project

```bash
# In the project root directory
railway init
```

#### 3. Deploy Backend

```bash
cd backend
railway up
railway variables set OPENAI_API_KEY="your_key"
railway variables set ELEVENLABS_API_KEY="your_key"
railway variables set ASSEMBLYAI_API_KEY="your_key"
railway variables set LLAMA_PARSE_API_KEY="your_key"
railway variables set LLM_MODEL="gpt-4o"
railway variables set ELEVENLABS_VOICE_ID="your_voice_id"
railway variables set BASIC_AUTH_USERNAME="admin"
railway variables set BASIC_AUTH_PASSWORD="your_password"
```

#### 4. Deploy Frontend

```bash
cd ../frontend
railway up
railway variables set REACT_APP_API_URL="https://your-backend-url.railway.app/api"
railway variables set REACT_APP_AUTH_USERNAME="admin"
railway variables set REACT_APP_AUTH_PASSWORD="your_password"
```

## Ephemeral Environments (PR Deployments)

Railway automatically creates ephemeral environments for each Pull Request:

### 1. Enable PR Deployments

1. Go to Project Settings → Deployments
2. Enable "PR Deployments"
3. Configure triggers (e.g., deploy on PR creation)

### 2. How It Works

- When you create a PR, Railway automatically deploys both services
- Each PR gets its own isolated environment with unique URLs
- Environment variables are inherited from the production environment
- Environments are automatically deleted when PRs are merged/closed

### 3. Access PR Deployments

1. Go to your PR on GitHub
2. Click the Railway deployment link in the checks
3. Access the deployed frontend and backend URLs

## Environment Variables Reference

### Backend Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `OPENAI_API_KEY` | OpenAI API key for GPT models | Yes |
| `ELEVENLABS_API_KEY` | ElevenLabs API key for TTS | Yes |
| `ASSEMBLYAI_API_KEY` | AssemblyAI API key for transcription | Yes |
| `LLAMA_PARSE_API_KEY` | Llama Parse API key | No |
| `LLM_MODEL` | OpenAI model to use (default: gpt-4o) | No |
| `ELEVENLABS_VOICE_ID` | Voice ID for ElevenLabs TTS | Yes |
| `BASIC_AUTH_USERNAME` | Admin username | Yes |
| `BASIC_AUTH_PASSWORD` | Admin password | Yes |
| `PORT` | Port for the backend (auto-set by Railway) | No |

### Frontend Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `REACT_APP_API_URL` | Backend API URL | Yes |
| `REACT_APP_AUTH_USERNAME` | Admin username (must match backend) | Yes |
| `REACT_APP_AUTH_PASSWORD` | Admin password (must match backend) | Yes |

## Monitoring and Logs

### View Logs

1. Go to Railway Dashboard → Your Service
2. Click "Deployments" tab
3. Click on the active deployment
4. View real-time logs

### Health Checks

Railway automatically monitors the health endpoints:
- Backend: `/health`
- Frontend: `/` (main page)

If health checks fail, Railway will restart the service automatically.

## Storage and Persistence

### Data Persistence

By default, the application stores data in `/app/data/episodes` inside the container. This data will be lost when the container restarts.

For persistent storage:

1. Add a Railway Volume:
   ```bash
   # Via CLI
   railway volumes create podcast-data --mount /app/data
   ```

2. Or via Dashboard:
   - Go to Service Settings → Volumes
   - Create a new volume
   - Mount path: `/app/data`

## Custom Domains

To use your own domain:

1. Go to Service Settings → Networking
2. Click "Custom Domain"
3. Enter your domain (e.g., `podcast.yourdomain.com`)
4. Add the provided CNAME record to your DNS provider
5. Wait for DNS propagation (5-60 minutes)

## Troubleshooting

### Backend Not Starting

- Check environment variables are set correctly
- View logs for Python errors
- Verify API keys are valid
- Ensure PORT variable is using `${{PORT}}`

### Frontend Can't Connect to Backend

- Verify `REACT_APP_API_URL` points to the correct backend domain
- Check CORS settings in backend allow the frontend domain
- Ensure both services are running

### Database Issues

- SQLite database is ephemeral by default
- Add a Railway volume for persistence
- Consider using Railway's PostgreSQL plugin for production

## Cost Optimization

Railway offers:
- **Hobby Plan**: $5/month + usage
- **Usage-based pricing**: ~$0.000231/GB-hour

Tips to reduce costs:
1. Use smaller Docker images (already optimized with alpine/slim)
2. Set up auto-sleep for non-production environments
3. Use PR deployments only when needed
4. Monitor resource usage in Railway dashboard

## CI/CD Integration

Railway automatically:
- Deploys on push to `main` branch
- Creates PR deployments for pull requests
- Runs health checks after deployment
- Rolls back on deployment failures

## Support

For Railway-specific issues:
- [Railway Documentation](https://docs.railway.app/)
- [Railway Discord](https://discord.gg/railway)
- [Railway Status Page](https://status.railway.app/)

For application issues:
- Check the main README.md
- Review application logs
- Verify environment variables
