# CropO Owner Dashboard

Read-only web frontend for business owners to log in, search farmers, and view plots/crops.

## Stack

- React + Vite + TypeScript
- React Router
- Fetch-based API client

## Setup

```bash
npm install
```

Copy `.env.example` to `.env` if needed:

```
VITE_API_BASE_URL=http://127.0.0.1:8001
```

Docker Django is on host **8001**. Ensure the backend allows your frontend origin (e.g. `http://localhost:5173`).

## Run

```bash
npm run dev
```

## Demo owner credentials (local)

- Phone: `9111111111`
- Password: `farm@123`
- Role: `owner`

Uses **only** `POST /api/farmers/owner/login/` — never the farmer login endpoint.

## Routes

| Route | Purpose |
|-------|---------|
| `/login` | Owner login |
| `/farmers` | Searchable farmer list |
| `/farmers/:id` | Farmer detail (plots + crops) |
| `/` | Redirect based on auth |

## Scope

Read-only. No farmer registration, payments, transport, warehouse, chat, or write actions.
