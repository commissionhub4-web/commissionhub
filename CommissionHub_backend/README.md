# CommissionHub FastAPI Backend

FastAPI + PostgreSQL backend for lifecycle-safe commission management.

## Features

- Authentication endpoints for login page:
  - signup, login, admin approval/rejection
  - password reset code email delivery via Gmail SMTP
  - persisted `auth_users` table in PostgreSQL

- Employee/project lifecycle endpoints:
  - pause, unpause, soft-delete, restore, hard-delete (admin + confirm)
- Audit log recording for lifecycle actions
- Billing and commission endpoints
- Unified project+month billing context endpoint for merged billing/commission screen
- Commission safety checks:
  - only eligible (active-for-month) employees/projects can receive future commissions
  - contribution cap per billing entry (`<= 100%`)
- Eligibility endpoint for `YYYY-MM` month-based assignment lists
- Monthly report endpoints:
  - employee-wise
  - project-wise
  - department-wise

## Setup

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
```

Create a PostgreSQL database first, for example:

```bash
createdb commissionhub
```

## Run

```bash
cd backend
source .venv/bin/activate
uvicorn app.main:app --reload --port 8000
```

API docs:

- `http://localhost:8000/docs`
- `http://localhost:8000/api/db-health`

## Gmail Password Reset Email Setup

Add these values in `.env`:

```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USERNAME=your_gmail@gmail.com
SMTP_PASSWORD=your_gmail_app_password
SMTP_FROM_EMAIL=your_gmail@gmail.com
```

For Gmail, use an **App Password** (not your normal Gmail password):

1. Enable 2-Step Verification on your Google account.
2. Create an App Password in Google Account Security.
3. Put that app password in `SMTP_PASSWORD`.

## Endpoints

- `GET /api/health`
- `GET /api/db-health`
- `POST /api/auth/signup`
- `POST /api/auth/login`
- `POST /api/auth/send-reset-code`
- `GET /api/auth/users`
- `POST /api/auth/users/{id}/approve`
- `POST /api/auth/users/{id}/reject`
- `GET /api/employees?include_inactive=true|false`
- `GET /api/employees/departments`
- `POST /api/employees`
- `PUT /api/employees/{id}`
- `POST /api/employees/{id}/pause`
- `POST /api/employees/{id}/unpause`
- `POST /api/employees/{id}/delete`
- `POST /api/employees/{id}/restore` (admin only)
- `POST /api/employees/{id}/status`
- `POST /api/employees/{id}/hard-delete`
- Same lifecycle endpoints for `/api/projects/...`
- `GET /api/billing`
- `GET /api/billing/context?project_id=<uuid>&month=YYYY-MM`
- `POST /api/billing` (create or update per project+month)
- `PUT /api/billing/{id}` (edit a specific billing entry)
- `GET /api/commissions`
- `POST /api/commissions`
- `GET /api/commissions/eligible?month=YYYY-MM`
- `GET /api/reports/employee-monthly?month=YYYY-MM`
- `GET /api/reports/project-monthly?month=YYYY-MM`
- `GET /api/reports/department-monthly?month=YYYY-MM`
- `GET /api/audit-logs`

## Notes

- Tables are auto-created on startup (`Base.metadata.create_all`).
- Hard delete requires payload:
  - `is_admin: true`
  - `confirm: true`
