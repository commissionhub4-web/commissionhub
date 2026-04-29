# Vercel Deploy

Deploy this frontend from the `CommissionHub_ui` folder.

## Vercel Settings

- Root Directory: `CommissionHub_ui`
- Framework Preset: Vite
- Install Command: handled by `vercel.json`
- Build Command: handled by `vercel.json`
- Output Directory: handled by `vercel.json`

This folder also includes `.nvmrc`, `.node-version`, `.npmrc`, `.vercelignore`, and a Docker/nginx fallback config for non-Vercel static hosting.

## Required Variables

Set this in Vercel:

```env
VITE_API_BASE_URL=https://your-railway-backend.up.railway.app/api
```

Replace the value with your real Railway backend URL after Railway deploys.
