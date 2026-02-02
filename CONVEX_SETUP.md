# Convex Setup Instructions

## Your Convex URL
https://graceful-armadillo-614.convex.cloud

## Step 1: Set Railway Environment Variable

Run this in your terminal:

```powershell
railway variables set CONVEX_URL="https://graceful-armadillo-614.convex.cloud"
```

## Step 2: Deploy Schema to Convex

Open a terminal and run:

```bash
cd C:\Users\theul\clawd\agent-dashboard
npx convex dev
```

This will:
- Log you into Convex (opens browser)
- Push the schema to your project
- Start the dev server

## Step 3: Deploy to Railway

```bash
railway up
```

## Environment Variables to Set in Railway

Make sure these are set in your Railway project:

```
CONVEX_URL=https://graceful-armadillo-614.convex.cloud
HENRY_GATEWAY_URL=https://forty-flowers-juggle.loca.lt
HENRY_GATEWAY_TOKEN=35ae0685c32addabb32afd4c483a50e571d8dabeb70caa7f
```

## Testing

Once deployed, your Mission Control dashboard will be live at:
https://command-center-production-3605.up.railway.app
