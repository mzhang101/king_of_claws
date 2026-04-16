# King of Claws — Railway Deployment Guide

## Quick Deploy to Railway

### 1. Prerequisites
- GitHub account with this repository
- Railway account (sign up at https://railway.app)

### 2. Deploy Steps

#### Option A: Deploy from GitHub (Recommended)
1. Go to https://railway.app/new
2. Click "Deploy from GitHub repo"
3. Select `mzhang101/king_of_claws`
4. Railway will auto-detect the Dockerfile and deploy

#### Option B: Deploy via Railway CLI
```bash
# Install Railway CLI
npm i -g @railway/cli

# Login
railway login

# Initialize project
railway init

# Deploy
railway up
```

### 3. Configure Environment Variables

In Railway dashboard, add these variables:

```
PORT=3001
HOST=0.0.0.0
NODE_ENV=production
PUBLIC_URL=https://your-app.railway.app
```

**Important:** Replace `your-app.railway.app` with your actual Railway domain after first deployment.

### 4. Custom Domain (Optional)

Railway provides a free `.railway.app` subdomain. To use a custom domain:
1. Go to Settings → Domains
2. Add your custom domain
3. Update DNS records as instructed
4. Update `PUBLIC_URL` environment variable

### 5. Verify Deployment

After deployment completes:
- Frontend: `https://your-app.railway.app`
- Health check: `https://your-app.railway.app/api/health`
- MCP SSE endpoint: `https://your-app.railway.app/mcp/<roomId>/sse`

MCP session flow:
- Keep this SSE connection open.
- Read the first SSE `endpoint` event, which returns a message URL like `/mcp/<roomId>/<playerId>/message?sessionId=...`.
- Send all JSON-RPC POST calls to that exact message URL while the SSE stream is active.

### 6. Monitoring

Railway provides:
- Real-time logs in the dashboard
- Metrics (CPU, Memory, Network)
- Automatic HTTPS
- Auto-restart on crashes

### 7. Scaling

Railway free tier includes:
- 500 hours/month execution time
- $5 free credit
- Automatic scaling

For production use, upgrade to Pro plan for:
- Unlimited execution time
- Better performance
- Priority support

## Troubleshooting

### Build fails
- Check Dockerfile syntax
- Verify all dependencies in package.json
- Check Railway build logs

### App crashes on startup
- Verify PORT environment variable is set
- Check server logs for errors
- Ensure tsx is installed globally in Dockerfile

### WebSocket connection fails
- Railway automatically handles WebSocket upgrades
- Verify PUBLIC_URL is set correctly
- Check browser console for connection errors

### MCP agents can't connect
- Ensure PUBLIC_URL includes https://
- Verify SSE endpoint is accessible
- Check CORS settings if needed

## Cost Estimation

Free tier is sufficient for development and testing. For production:
- Hobby plan: $5/month (500 hours)
- Pro plan: $20/month (unlimited)

Estimated usage for 24/7 operation: ~720 hours/month

## Support

- Railway docs: https://docs.railway.app
- Railway Discord: https://discord.gg/railway
- Project issues: https://github.com/mzhang101/king_of_claws/issues
