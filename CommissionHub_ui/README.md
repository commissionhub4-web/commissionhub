# CommissionHub

CommissionHub is a React + TypeScript application for automated commission operations with:

- Billing and commissionable bill computation
- Employee/project lifecycle controls (pause, soft delete, restore, optional hard delete)
- Month-aware assignment safety (past months preserved, future assignments restricted)
- Reporting by employee, project, and department
- HR support screens for lifecycle, asset allocation, and payroll-impact inputs
- Export options (Excel-friendly CSV and Print/PDF workflow)
- Lightweight API server with required lifecycle endpoints and audit logs

## Tech Stack

- Frontend: Vite, React, TypeScript, Tailwind, shadcn/ui
- Charts: Recharts
- Testing: Vitest
- Backend API: FastAPI (`backend/app`) with PostgreSQL

## Run Locally

```bash
npm install
npm run dev
```

Set frontend API target (optional if using default `http://localhost:8000/api`):

```bash
echo "VITE_API_BASE_URL=http://localhost:8000/api" > .env.local
```

Run FastAPI backend (separate terminal):

```bash
npm run api:fastapi
```

## Quality Commands

```bash
npm run lint
npm run build
npm run test
```

## Core Formula

Commissionable bill:

$$
	ext{Commissionable Bill} = \text{Total Bill} - \text{Deduction} + (\text{Additions} - \text{Deletions})
$$

Employee commission:

$$
	ext{Employee Commission} = \text{Commissionable Bill} \times \frac{\text{Contribution \%}}{100}
$$

## API Endpoints

Employee lifecycle:

- `POST /api/employees/:id/pause`
- `POST /api/employees/:id/unpause`
- `POST /api/employees/:id/delete` (soft delete)
- `POST /api/employees/:id/restore`
- `POST /api/employees/:id/hard-delete` (admin only)

Project lifecycle:

- `POST /api/projects/:id/pause`
- `POST /api/projects/:id/unpause`
- `POST /api/projects/:id/delete` (soft delete)
- `POST /api/projects/:id/restore`
- `POST /api/projects/:id/hard-delete` (admin only)

Other:

- `GET /api/employees?includeInactive=true|false`
- `GET /api/projects?includeInactive=true|false`
- `GET /api/commissions/eligible?month=YYYY-MM`
- `GET /api/audit-logs`

## Notes

- Status-safe eligibility checks ensure inactive records are excluded from future assignment lists.
- Historical records are preserved by status-date checks and soft-delete model.
- API persistence is PostgreSQL-backed via SQLAlchemy models.
