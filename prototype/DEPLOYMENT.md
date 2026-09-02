# Deployment Guide

This guide walks through deploying the Weather Analytics Platform to production using Vercel (frontend) and Render (backend + database).

## Prerequisites

- GitHub account with this repository pushed
- Vercel account (sign up at vercel.com)
- Render account (sign up at render.com)

## Part 1: Deploy Backend to Render

### Option A: Using render.yaml (Blueprint - Recommended)

1. **Push your code to GitHub** (if not already done)

2. **Go to Render Dashboard**
   - Visit https://dashboard.render.com/
   - Click "New +" → "Blueprint"

3. **Connect Repository**
   - Connect your GitHub account
   - Select the `SIH26069` repository
   - Render will detect `render.yaml` automatically

4. **Review and Deploy**
   - Review the services (PostgreSQL + FastAPI)
   - Click "Apply"
   - Wait for both services to deploy (~5-10 minutes)

5. **Get your API URL**
   - Once deployed, go to "weather-analytics-api" service
   - Copy the URL (format: `https://weather-analytics-api.onrender.com`)
   - Save this for frontend deployment

### Option B: Manual Setup

#### 1. Deploy PostgreSQL Database

1. Go to Render Dashboard → New + → PostgreSQL
2. Configure:
   - **Name**: `weather-analytics-db`
   - **Database**: `weather_analytics`
   - **Region**: Singapore (or closest to your users)
   - **Plan**: Free
3. Click "Create Database"
4. Wait for provisioning (~2-3 minutes)
5. Copy the **Internal Database URL** (starts with `postgresql://`)

#### 2. Deploy Backend API

1. Go to Render Dashboard → New + → Web Service
2. Connect your GitHub repository
3. Configure:
   - **Name**: `weather-analytics-api`
   - **Region**: Singapore
   - **Branch**: `main`
   - **Root Directory**: `prototype`
   - **Runtime**: Python 3
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `uvicorn backend.main:app --host 0.0.0.0 --port $PORT`
   - **Plan**: Free

4. Add Environment Variables:
   ```
   DATABASE_URL=<paste Internal Database URL from step 1>
   DEBUG=false
   SQL_ECHO=false
   RELOAD=false
   USE_MOCK_MODELS=true
   CONFIDENCE_THRESHOLD_HIGH=0.85
   CONFIDENCE_THRESHOLD_MEDIUM=0.60
   WS_PING_INTERVAL=20
   CORS_ORIGINS=*
   ```
   (We'll update CORS_ORIGINS after deploying frontend)

5. Click "Create Web Service"
6. Wait for deployment (~3-5 minutes)
7. Copy your API URL: `https://weather-analytics-api.onrender.com`

## Part 2: Deploy Frontend to Vercel

### 1. Push to GitHub
Ensure your latest code is pushed to GitHub.

### 2. Import to Vercel

1. Go to https://vercel.com/new
2. Import your `SIH26069` repository
3. Configure:
   - **Framework Preset**: Vite
   - **Root Directory**: `prototype/frontend`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
   - **Install Command**: `npm install`

### 3. Add Environment Variable

Click "Environment Variables" and add:
```
VITE_API_BASE=https://weather-analytics-api.onrender.com
```
(Replace with your actual Render API URL from Part 1)

### 4. Deploy

1. Click "Deploy"
2. Wait for build (~2-3 minutes)
3. Copy your frontend URL: `https://your-project.vercel.app`

## Part 3: Update CORS Settings

Now that both are deployed, lock down CORS:

1. Go back to Render Dashboard → weather-analytics-api → Environment
2. Update `CORS_ORIGINS`:
   ```
   CORS_ORIGINS=https://your-project.vercel.app
   ```
   (Replace with your actual Vercel URL)
3. Click "Save Changes"
4. Service will automatically redeploy

## Part 4: Verify Deployment

### Test Backend
```bash
curl https://weather-analytics-api.onrender.com/health
# Should return: {"status":"ok"}

curl https://weather-analytics-api.onrender.com/
# Should return service info with endpoints
```

### Test Frontend
1. Visit your Vercel URL: `https://your-project.vercel.app`
2. Check that the dashboard loads
3. Verify real-time event stream is working
4. Check map and analytics tabs

### Test WebSocket Connection
Open browser console on your frontend and check for:
- `WebSocket connection established`
- No CORS errors
- Events streaming in real-time

## Troubleshooting

### Backend Issues

**Database connection failed**
- Check DATABASE_URL format: `postgresql+asyncpg://user:pass@host/db`
- Verify database is running in Render dashboard
- Check backend logs for specific error

**CORS errors**
- Ensure CORS_ORIGINS matches your Vercel domain exactly
- Include `https://` prefix
- No trailing slash
- Redeploy after changing

**App won't start**
- Check logs in Render dashboard
- Verify all environment variables are set
- Check Python version (should use 3.11+)

### Frontend Issues

**API calls failing**
- Verify VITE_API_BASE is set correctly in Vercel
- Check Network tab for exact error
- Ensure backend is running

**Build failed**
- Check build logs in Vercel
- Verify all dependencies in package.json
- Try building locally: `cd frontend && npm run build`

**WebSocket not connecting**
- Check browser console for errors
- Verify backend WebSocket endpoint is accessible
- Check that /ws/stream path is correct

## Free Tier Limits

### Render Free Tier
- PostgreSQL: 1GB storage, 97 hours/month runtime
- Web Service: Spins down after 15 minutes of inactivity
- First request after spin-down takes ~30 seconds

### Vercel Free Tier
- 100GB bandwidth/month
- Unlimited deployments
- Automatic SSL

## Production Considerations

When moving beyond prototype:

1. **Upgrade plans** for 24/7 uptime (Render spins down on free tier)
2. **Enable real ML models** by setting `USE_MOCK_MODELS=false`
3. **Add authentication** for admin endpoints
4. **Set up monitoring** (Render metrics, Sentry, etc.)
5. **Configure custom domain** in both Vercel and Render
6. **Add rate limiting** for API endpoints
7. **Enable database backups** in Render
8. **Set up CI/CD** for automatic deployments on push

## URLs Reference

After deployment, save these URLs:

```
Frontend: https://your-project.vercel.app
Backend API: https://weather-analytics-api.onrender.com
API Docs: https://weather-analytics-api.onrender.com/docs
WebSocket: wss://weather-analytics-api.onrender.com/ws/stream
```

## Next Steps

- [ ] Add custom domain
- [ ] Set up error monitoring (Sentry)
- [ ] Enable real ML models
- [ ] Add user authentication
- [ ] Set up automated tests in CI/CD
- [ ] Configure database backups
