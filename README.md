# NexusPro — Enterprise Project Management Platform

Full-stack PM tool: React 18 frontend + Express REST API, deployable to Render in minutes.

---

## Tech Stack

| Layer      | Tech                                      |
|------------|-------------------------------------------|
| Frontend   | React 18, Vite, Tailwind CSS v3           |
| State      | TanStack React Query v5                   |
| Charts     | Recharts                                  |
| Routing    | React Router v6                           |
| Backend    | Node.js 20, Express 4                     |
| Validation | express-validator                         |
| Data       | In-memory store (swap for Postgres/Mongo) |

---

## Project Structure

```
nexuspro/
├── package.json          ← root runner (Render uses this)
├── render.yaml           ← Render blueprint (auto-configures deploy)
├── .node-version         ← pins Node 20 for Render
├── backend/
│   ├── server.js         ← Express entry point
│   ├── data/seed.js      ← in-memory data store
│   ├── middleware/
│   └── routes/           ← projects, tasks, users, risks, analytics
└── frontend/
    ├── vite.config.js
    ├── tailwind.config.js
    └── src/
        ├── lib/api.js    ← axios client (baseURL: '/api')
        ├── components/   ← shared UI kit, Sidebar, Topbar
        └── pages/        ← Dashboard, Projects, Tasks, Team, Risks, Analytics, Settings
```

---

## Local Development

```bash
# 1. Install everything
npm run install:all

# 2. Start both servers together
npm run dev
```

- Frontend → http://localhost:5173
- API      → http://localhost:3001/api
- Health   → http://localhost:3001/api/health

---

## Deploy to GitHub + Render

### Step 1 — Create a GitHub repo

Go to https://github.com/new
- Name: `nexuspro`
- Visibility: **Public**
- Do NOT tick "Add README"

### Step 2 — Push the code

Open a terminal inside the `nexuspro/` folder:

```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/nexuspro.git
git push -u origin main
```

### Step 3 — Deploy on Render (Blueprint — easiest)

1. Go to https://render.com and sign up with GitHub
2. Click **New → Blueprint**
3. Select the `nexuspro` repo
4. Render reads `render.yaml` and pre-fills every setting automatically
5. Click **Apply** — first build takes ~4 minutes
6. Once status shows **Live**, your app is at `https://nexuspro.onrender.com`

### Step 3 (alternative) — Deploy on Render (Manual)

If Blueprint doesn't appear, use **New → Web Service** instead:

| Field          | Value                          |
|----------------|--------------------------------|
| Name           | `nexuspro`                     |
| Region         | Frankfurt                      |
| Branch         | `main`                         |
| Runtime        | Node                           |
| Build Command  | `npm install && npm run build` |
| Start Command  | `node backend/server.js`       |
| Instance Type  | Free                           |

Then add these **Environment Variables**:

| Key        | Value        |
|------------|--------------|
| NODE_ENV   | production   |
| PORT       | 3001         |

Click **Create Web Service**.

### Every future deploy

Push to `main` — Render redeploys automatically:

```bash
git add .
git commit -m "your change"
git push
```

---

## Free Tier Note

Render free services sleep after 15 min of inactivity (cold start ~30s on first hit).
To keep it awake free: add your URL to https://uptimerobot.com with a 10-minute ping.

---

## API Reference

| Method | Endpoint                  | Description                         |
|--------|---------------------------|-------------------------------------|
| GET    | /api/health               | Health check                        |
| GET    | /api/projects             | List (filter: rag, status, search)  |
| POST   | /api/projects             | Create project                      |
| PATCH  | /api/projects/:id         | Update project                      |
| GET    | /api/projects/:id/stats   | Task counts + budget utilisation    |
| GET    | /api/tasks/board          | Kanban columns grouped by status    |
| POST   | /api/tasks                | Create task                         |
| PATCH  | /api/tasks/:id            | Move / update task                  |
| DELETE | /api/tasks/:id            | Delete task                         |
| GET    | /api/users                | List team members                   |
| GET    | /api/risks                | List risks with calculated score    |
| POST   | /api/risks                | Log new risk                        |
| GET    | /api/analytics/overview   | Portfolio KPI summary               |
| GET    | /api/analytics/activity   | Activity feed                       |
| GET    | /api/analytics/workload   | Per-user utilisation                |

---

## Connecting a Real Database

Replace the in-memory arrays in `backend/data/seed.js` with a database client:

```bash
npm install --prefix backend pg knex
```

Add `DATABASE_URL` to Render's environment variables.
Render also offers a free managed PostgreSQL — add one under **New → PostgreSQL**.
