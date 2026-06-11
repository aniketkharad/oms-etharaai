# Stockroom — Inventory & Order Management System

A production-ready, fully containerized full-stack application for managing
products, customers, orders, and inventory levels.

| Layer | Technology |
|---|---|
| Frontend | React 18 (Vite), served by nginx |
| Backend | Python 3.12, FastAPI, SQLAlchemy 2.0 |
| Database | PostgreSQL 16 |
| Containers | Docker + Docker Compose |

## Features

- **Products** — create, list, view, update, delete; unique SKU enforced (HTTP 409 on duplicates)
- **Customers** — create, list, view, delete; unique email enforced
- **Orders** — create with multiple line items, list, expandable details, cancel
- **Business rules** (all enforced server-side):
  - Stock can never go negative (API validation + DB `CHECK` constraint)
  - Orders are rejected with a precise message when stock is insufficient
  - Placing an order atomically reduces stock (row-level locking prevents
    concurrent oversells); cancelling restores it
  - Order totals are computed by the backend — client values are never trusted
  - All request data validated by Pydantic; proper HTTP status codes throughout
    (`201`, `204`, `404`, `409`, `422`)
- **Dashboard** — total products / customers / orders + low-stock list
- Interactive API documentation at `/docs` (Swagger UI)

## Project structure

```
.
├── docker-compose.yml
├── .env.example            # copy to .env and edit
├── backend/
│   ├── Dockerfile           # python:3.12-slim, non-root user
│   ├── requirements.txt
│   └── app/
│       ├── main.py          # app factory, CORS, /stats, /health
│       ├── config.py        # env-driven settings
│       ├── database.py      # engine + session
│       ├── models.py        # ORM models + DB constraints
│       ├── schemas.py       # Pydantic validation
│       └── routers/
│           ├── products.py
│           ├── customers.py
│           └── orders.py    # transactional order logic
└── frontend/
    ├── Dockerfile           # node:20-alpine build → nginx:alpine
    ├── nginx.conf
    └── src/
        ├── api.js           # API client
        ├── App.jsx
        ├── components/      # Modal, Toast
        └── pages/           # Dashboard, Products, Customers, Orders
```

## Run locally with Docker Compose

```bash
cp .env.example .env        # then edit POSTGRES_PASSWORD etc.
docker compose up --build
```

- Frontend: http://localhost:3000
- Backend API + Swagger docs: http://localhost:8000/docs
- PostgreSQL data persists in the named volume `pgdata`.

## Run locally without Docker (development)

```bash
# Backend
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
export DATABASE_URL=postgresql+psycopg2://user:pass@localhost:5432/inventory
uvicorn app.main:app --reload

# Frontend (separate terminal)
cd frontend
npm install
echo "VITE_API_URL=http://localhost:8000" > .env
npm run dev                  # http://localhost:5173
```

## Push the backend image to Docker Hub

```bash
docker login
docker build -t <your-dockerhub-username>/inventory-backend:latest ./backend
docker push <your-dockerhub-username>/inventory-backend:latest
```

## Deployment

### Backend — Render (Docker)

1. Push this repository to GitHub.
2. On https://render.com → **New → PostgreSQL** (free plan). Copy its
   **Internal Database URL**.
3. **New → Web Service** → connect the GitHub repo → set **Root Directory**
   to `backend` → Runtime: **Docker** (Render auto-detects the Dockerfile).
4. Add environment variables:
   - `DATABASE_URL` = the Internal Database URL from step 2
     (the app accepts Render's `postgres://...` format as-is)
   - `CORS_ORIGINS` = your Vercel URL, e.g. `https://your-app.vercel.app`
5. Deploy. Verify `https://<service>.onrender.com/health` returns
   `{"status":"healthy"}`.

### Frontend — Vercel

1. On https://vercel.com → **Add New → Project** → import the same repo.
2. Set **Root Directory** to `frontend`. Framework preset: **Vite**.
3. Add environment variable `VITE_API_URL` = your Render backend URL
   (no trailing slash), e.g. `https://<service>.onrender.com`.
4. Deploy, then go back to Render and make sure `CORS_ORIGINS` contains the
   final Vercel domain. Redeploy the backend if you changed it.

## Environment variables

| Variable | Used by | Purpose |
|---|---|---|
| `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB` | db | Database bootstrap |
| `DATABASE_URL` | backend | SQLAlchemy connection string |
| `CORS_ORIGINS` | backend | Comma-separated allowed origins |
| `VITE_API_URL` | frontend (build time) | Backend base URL |

No credentials are hardcoded anywhere — everything flows through `.env`
locally and platform environment variables in production.

## API summary

| Method | Path | Notes |
|---|---|---|
| POST | `/products` | 201; 409 on duplicate SKU |
| GET | `/products`, `/products/{id}` | |
| PUT | `/products/{id}` | partial update supported |
| DELETE | `/products/{id}` | 409 if referenced by orders |
| POST | `/customers` | 201; 409 on duplicate email |
| GET | `/customers`, `/customers/{id}` | |
| DELETE | `/customers/{id}` | cascades to their orders |
| POST | `/orders` | validates stock, locks rows, computes total, reduces stock |
| GET | `/orders`, `/orders/{id}` | includes line items |
| DELETE | `/orders/{id}` | cancels and restores stock |
| GET | `/stats` | dashboard summary |
| GET | `/health` | health check |
