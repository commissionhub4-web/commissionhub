# Railway Deploy

Deploy this backend from the `CommissionHub_backend` folder.

## Railway Settings

- Root Directory: `CommissionHub_backend`
- Build: Nixpacks
- Build Command: leave blank
- Start Command: `.venv/bin/python -m uvicorn app.main:app --host 0.0.0.0 --port $PORT`
- Healthcheck Path: `/api/db-health`

This folder also includes a `Dockerfile`, `.dockerignore`, `runtime.txt`, `.python-version`, `start.sh`, and `Procfile` for hosts that prefer those formats.

If Railway is configured from the monorepo root instead of `CommissionHub_backend`, set:

- Build Command: leave blank, or `cd CommissionHub_backend && python -m venv .venv && .venv/bin/python -m pip install --upgrade pip setuptools wheel && .venv/bin/python -m pip install --no-cache-dir -r requirements.txt`
- Start Command: `cd CommissionHub_backend && .venv/bin/python -m uvicorn app.main:app --host 0.0.0.0 --port $PORT`

Do not set Build Command to `CommissionHub_backend/`; Railway will try to execute that folder and fail with `Permission denied`.

## Required Variables

Set these in Railway:

```env
APP_ENV=production
DATABASE_PUBLIC_URL=${{Postgres.DATABASE_PUBLIC_URL}}
DATABASE_STARTUP_MAX_ATTEMPTS=6
DATABASE_STARTUP_RETRY_DELAY_SECONDS=2
CORS_ORIGINS=https://commissionhub-blue.vercel.app
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USERNAME=your_gmail@gmail.com
SMTP_PASSWORD=your_gmail_app_password
SMTP_FROM_EMAIL=your_gmail@gmail.com
```

If you add preview or custom domains later, append them to `CORS_ORIGINS` as a comma-separated list.
