# Railway Deploy

Deploy this backend from the `CommissionHub_backend` folder.

## Railway Settings

- Root Directory: `CommissionHub_backend`
- Build: Nixpacks
- Start Command: handled by `railway.json` or `nixpacks.toml`
- Healthcheck Path: `/api/health`

This folder also includes a `Dockerfile`, `.dockerignore`, `runtime.txt`, `.python-version`, and `Procfile` for hosts that prefer those formats.

## Required Variables

Set these in Railway:

```env
APP_ENV=production
DATABASE_URL=${{Postgres.DATABASE_URL}}
CORS_ORIGINS=https://your-vercel-app.vercel.app
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USERNAME=your_gmail@gmail.com
SMTP_PASSWORD=your_gmail_app_password
SMTP_FROM_EMAIL=your_gmail@gmail.com
```

After deploying the frontend on Vercel, replace `CORS_ORIGINS` with the real Vercel URL.
