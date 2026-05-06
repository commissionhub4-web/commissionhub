# CommissionHub

CommissionHub is a full-stack commission operations platform for managing employees, projects, billing, commission allocations, lifecycle controls, approvals, reports, and audit history.

The application is split into two deployable services:

- `CommissionHub_backend`: FastAPI, SQLAlchemy, PostgreSQL
- `CommissionHub_ui`: Vite, React, TypeScript, Tailwind CSS

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Architecture](#architecture)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Business Logic](#business-logic)
- [Environment Variables](#environment-variables)
- [Local Development](#local-development)
- [Quality Checks](#quality-checks)
- [Deployment](#deployment)
- [API Reference](#api-reference)
- [Operational Notes](#operational-notes)
- [Troubleshooting](#troubleshooting)

## Overview

CommissionHub helps teams keep commission workflows accurate, auditable, and safe across the full employee and project lifecycle. It supports month-aware billing, commission contribution limits, employee and project status changes, approval flows, password reset email delivery, and reporting views for finance and operations teams.

The backend owns persistence, validation, lifecycle rules, and reporting endpoints. The frontend provides the operational workspace for dashboards, billing, commissions, employees, projects, reports, and admin user management.

## Features

- Employee management with active, paused, leave, resigned, terminated, and deleted states
- Project lifecycle management with pause, restore, soft delete, and hard delete flows
- Monthly billing entries by project
- Commission allocation by employee, department, project role, and contribution percentage
- Contribution cap safety checks to prevent allocations above 100 percent per billing entry
- Month-aware eligibility rules so future assignments exclude inactive records while history remains intact
- Admin approval and rejection workflow for new users
- Password reset code delivery through SMTP
- Dashboard and reports for employee, project, and department monthly performance
- Audit logs for sensitive lifecycle actions
- PostgreSQL-backed persistence with automatic table creation on startup
- Separate deployment configuration for Railway backend and Vercel frontend

## Architecture

```text
Browser
  |
  | HTTPS
  v
Vercel Frontend
  |
  | VITE_API_BASE_URL
  v
Railway FastAPI Backend
  |
  | DATABASE_PUBLIC_URL
  v
PostgreSQL
```

The frontend calls the backend through the API base URL configured by `VITE_API_BASE_URL`. The backend reads database, CORS, and SMTP settings from environment variables.

## Tech Stack

| Layer | Technology |
| --- | --- |
| Frontend | React 18, TypeScript, Vite |
| Styling | Tailwind CSS, shadcn-style components, Radix UI |
| Data Fetching | Fetch API, React Context |
| Charts | Recharts |
| Testing | Vitest |
| Backend | FastAPI, Uvicorn |
| Data Layer | SQLAlchemy 2.x |
| Database | PostgreSQL |
| Settings | Pydantic Settings, python-dotenv |
| Deployment | Railway, Vercel, Docker-ready configs |

## Project Structure

```text
CommissionHub/
├── CommissionHub_backend/
│   ├── app/
│   │   ├── api/                  # FastAPI route modules
│   │   ├── config.py             # Environment-based settings
│   │   ├── database.py           # SQLAlchemy engine and sessions
│   │   ├── email_service.py      # SMTP email helpers
│   │   ├── main.py               # FastAPI application entrypoint
│   │   ├── models.py             # SQLAlchemy models
│   │   ├── schemas.py            # Pydantic request and response schemas
│   │   └── services.py           # Business logic helpers
│   ├── .env.example
│   ├── .env.production.example
│   ├── railway.json
│   ├── nixpacks.toml
│   ├── Procfile
│   ├── Dockerfile
│   ├── requirements.txt
│   └── RAILWAY_DEPLOY.md
├── CommissionHub_ui/
│   ├── src/
│   │   ├── components/           # Layout, charts, and reusable UI
│   │   ├── contexts/             # App and auth state
│   │   ├── hooks/                # Shared React hooks
│   │   ├── lib/                  # API client and utilities
│   │   └── pages/                # Route-level screens
│   ├── .env.example
│   ├── .env.production.example
│   ├── vercel.json
│   ├── Dockerfile
│   ├── nginx.conf
│   ├── package.json
│   └── VERCEL_DEPLOY.md
└── README.md
```

## Business Logic

CommissionHub calculates commissionable bill and employee commission from billing values and allocation percentages.

Commissionable bill:

```text
commissionable_bill = total_bill - deduction + (additions - deletions)
```

Employee commission:

```text
employee_commission = commissionable_bill * (contribution_percent / 100)
```

Important safeguards:

- A billing entry is unique by project and month.
- Total contribution percentages for a billing entry cannot exceed 100 percent.
- Inactive employees and projects are excluded from future assignment lists.
- Historical records remain available for reporting and audit context.
- Sensitive status changes are recorded in audit logs.

## Environment Variables

### Backend

Create `CommissionHub_backend/.env` from `CommissionHub_backend/.env.example`.

```env
APP_NAME=CommissionHub API
APP_ENV=development
DATABASE_PUBLIC_URL=postgresql+psycopg://postgres:postgres@localhost:5432/commissionhub
DATABASE_STARTUP_MAX_ATTEMPTS=6
DATABASE_STARTUP_RETRY_DELAY_SECONDS=2
CORS_ORIGINS=http://localhost:5173,http://localhost:8080

SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USERNAME=your_gmail@gmail.com
SMTP_PASSWORD=your_gmail_app_password
SMTP_FROM_EMAIL=your_gmail@gmail.com
```

Notes:

- `DATABASE_PUBLIC_URL` can use `postgresql+psycopg://`, `postgresql://`, or Railway's standard public Postgres URL format.
- `CORS_ORIGINS` is a comma-separated list of allowed frontend origins.
- Gmail SMTP requires an app password, not the normal account password.

### Frontend

Create `CommissionHub_ui/.env.local` for local development.

```env
VITE_API_BASE_URL=http://localhost:8000/api
```

For production on Vercel:

```env
VITE_API_BASE_URL=https://your-railway-backend.up.railway.app/api
```

## Local Development

### Prerequisites

- Python 3.11+
- Node.js 20 recommended
- npm 9+
- PostgreSQL 14+

### Backend Setup

```bash
cd CommissionHub_backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
```

Create the local database:

```bash
createdb commissionhub
```

Run the API:

```bash
uvicorn app.main:app --reload --port 8000
```

Backend URLs:

- API health: `http://localhost:8000/api/health`
- Database health: `http://localhost:8000/api/db-health`
- API docs: `http://localhost:8000/docs`
- OpenAPI schema: `http://localhost:8000/openapi.json`

### Frontend Setup

```bash
cd CommissionHub_ui
npm install
cp .env.example .env.local
npm run dev
```

Frontend URL:

- App: `http://localhost:8080`

## Quality Checks

Backend:

```bash
cd CommissionHub_backend
source venv/bin/activate
python -m compileall app
```

Frontend:

```bash
cd CommissionHub_ui
npm run lint
npm run test
npm run build
```

## Deployment

Deployment configuration files are intentionally stored inside each app folder so Railway and Vercel can be pointed at the correct root directory.

### Backend on Railway

Use `CommissionHub_backend` as the Railway root directory.

If Railway is configured from the monorepo root instead, this repository also includes root-level fallback files:

- `railway.json`
- `nixpacks.toml`
- `Procfile`

Those fallback files explicitly build and start `CommissionHub_backend`.

Railway build settings:

- Build Command: leave blank, or use `cd CommissionHub_backend && python -m venv .venv && .venv/bin/python -m pip install --upgrade pip setuptools wheel && .venv/bin/python -m pip install --no-cache-dir -r requirements.txt`
- Start Command: `cd CommissionHub_backend && .venv/bin/python -m uvicorn app.main:app --host 0.0.0.0 --port $PORT`

Do not set Build Command to `CommissionHub_backend/`; that is a folder path, not an executable command.

Included backend deploy files:

- `railway.json`
- `nixpacks.toml`
- `Procfile`
- `runtime.txt`
- `.python-version`
- `.railwayignore`
- `Dockerfile`
- `.dockerignore`
- `.env.production.example`

Required Railway variables:

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

Railway start command:

```bash
cd CommissionHub_backend && .venv/bin/python -m uvicorn app.main:app --host 0.0.0.0 --port $PORT
```

See `CommissionHub_backend/RAILWAY_DEPLOY.md` for the focused backend deployment checklist.

### Frontend on Vercel

Use `CommissionHub_ui` as the Vercel root directory.

Included frontend deploy files:

- `vercel.json`
- `.vercelignore`
- `.nvmrc`
- `.node-version`
- `.npmrc`
- `.env.production.example`
- `Dockerfile`
- `.dockerignore`
- `nginx.conf`

Required Vercel variable:

```env
VITE_API_BASE_URL=https://your-railway-backend.up.railway.app/api
```

Vercel build settings:

```text
Framework Preset: Vite
Install Command: npm ci
Build Command: npm run build
Output Directory: dist
```

See `CommissionHub_ui/VERCEL_DEPLOY.md` for the focused frontend deployment checklist.

## API Reference

All API routes are prefixed with `/api`.

### Health

- `GET /api/health`
- `GET /api/db-health`

### Auth

- `POST /api/auth/signup`
- `POST /api/auth/login`
- `POST /api/auth/send-reset-code`
- `GET /api/auth/users`
- `POST /api/auth/users/{user_id}/approve`
- `POST /api/auth/users/{user_id}/reject`

### Employees

- `GET /api/employees?include_inactive=true|false`
- `GET /api/employees/departments`
- `POST /api/employees`
- `PUT /api/employees/{employee_id}`
- `POST /api/employees/{employee_id}/pause`
- `POST /api/employees/{employee_id}/unpause`
- `POST /api/employees/{employee_id}/delete`
- `POST /api/employees/{employee_id}/restore`
- `POST /api/employees/{employee_id}/status`
- `POST /api/employees/{employee_id}/hard-delete`

### Projects

- `GET /api/projects?include_inactive=true|false`
- `POST /api/projects`
- `PUT /api/projects/{project_id}`
- `POST /api/projects/{project_id}/pause`
- `POST /api/projects/{project_id}/unpause`
- `POST /api/projects/{project_id}/delete`
- `POST /api/projects/{project_id}/restore`
- `POST /api/projects/{project_id}/hard-delete`

### Billing

- `GET /api/billing`
- `GET /api/billing/context?project_id=<uuid>&month=YYYY-MM`
- `POST /api/billing`
- `PUT /api/billing/{billing_id}`

### Commissions

- `GET /api/commissions`
- `POST /api/commissions`
- `GET /api/commissions/eligible?month=YYYY-MM`

### Reports

- `GET /api/reports/employee-monthly?month=YYYY-MM`
- `GET /api/reports/project-monthly?month=YYYY-MM`
- `GET /api/reports/department-monthly?month=YYYY-MM`

### Audit

- `GET /api/audit-logs`

## Operational Notes

- Database tables are created automatically during backend startup.
- Startup also applies lightweight compatibility changes for existing tables.
- The backend readiness endpoint is `/api/health`; it returns `503` if startup database initialization did not complete.
- The Railway healthcheck endpoint should be `/api/db-health`; it returns `503` with a safe masked database URL if PostgreSQL is unreachable.
- The frontend is a single-page application, so `vercel.json` rewrites all routes to `index.html`.
- Production CORS must include the exact Vercel app origin.
- Vite environment variables must start with `VITE_` to be available in the browser.
- Do not commit real `.env` files or credentials.

## Troubleshooting

### Frontend cannot reach backend

Check:

- `VITE_API_BASE_URL` points to the backend URL and ends with `/api`.
- Railway backend is deployed and `/api/db-health` returns `{"ok": true}`.
- Backend `CORS_ORIGINS` includes the exact frontend origin.

### Railway deploy starts but database fails

Check:

- A Railway PostgreSQL service is attached.
- `DATABASE_PUBLIC_URL` is set in the backend service.
- The backend service root directory is `CommissionHub_backend`.

### Password reset email does not send

Check:

- SMTP variables are set in Railway.
- Gmail account has 2-Step Verification enabled.
- `SMTP_PASSWORD` is a Gmail app password.

### Vercel build works but refresh on nested pages fails

Check:

- `CommissionHub_ui/vercel.json` is present.
- The rewrite from `/(.*)` to `/index.html` is deployed.

## License

Private project. All rights reserved.
# commissionhub
# commissionhub
