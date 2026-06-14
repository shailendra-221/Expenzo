# SplitClone — Splitwise-inspired Expense Splitter

Built as part of an internship assignment. AI used: **Claude (Anthropic)** via claude.ai.

---

## Live Demo

- **Frontend (Vercel):** (https://expenzos.vercel.app/)
- **Backend (Render):** (https://expenzo-4ote.onrender.com)

---

## Tech Stack

| Layer      | Tech                                       |
|------------|--------------------------------------------|
| Frontend   | React 18 + Vite, React Router, Axios, Socket.io-client |
| Backend    | Node.js + Express, Socket.io               |
| Database   | MySQL (raw SQL via mysql2, no ORM)         |
| Auth       | express-session + bcrypt + express-mysql-session |
| Deploy     | Vercel (frontend) + Render (backend) + Aiven/Railway (MySQL) |

---

## Local Setup

### Prerequisites
- Node.js 18+
- MySQL 8.x (local or a free cloud MySQL instance)

### 1. Clone the repo
```bash
git clone <your-repo-url>
cd splitwise-clone
```

### 2. Set up the database
```bash
mysql -u root -p < backend/schema.sql
```

### 3. Configure backend
```bash
cd backend
cp .env.example .env
# Edit .env and fill in your DB credentials and SESSION_SECRET
npm install
npm start
# Backend runs on http://localhost:4000
```

### 4. Configure frontend
```bash
cd frontend
cp .env.example .env
# .env already has VITE_API_URL=http://localhost:4000 for local dev
npm install
npm run dev
# Frontend runs on http://localhost:5173
```

---

## Deployment

### MySQL
Use a free external MySQL provider:
- [Aiven](https://aiven.io) (free tier) — recommended
- [Railway](https://railway.app) (MySQL plugin)
- [Clever Cloud](https://clever-cloud.com)

Create a database, run `schema.sql` on it, note your host/user/password/db/port.

### Backend → Render
1. Push repo to GitHub.
2. Go to [render.com](https://render.com) → New Web Service → connect repo.
3. **Root directory:** `backend`
4. **Build command:** `npm install`
5. **Start command:** `node src/server.js`
6. Add these environment variables:
   ```
   NODE_ENV=production
   DB_HOST=<your mysql host>
   DB_PORT=<port>
   DB_USER=<user>
   DB_PASSWORD=<password>
   DB_NAME=splitwise_clone
   SESSION_SECRET=<random long string>
   CLIENT_URL=https://<your-vercel-app>.vercel.app
   ```

### Frontend → Vercel
1. Go to [vercel.com](https://vercel.com) → New Project → import repo.
2. **Framework Preset:** Vite
3. **Root directory:** `frontend`
4. **Build command:** `npm run build`
5. **Output directory:** `dist`
6. Add environment variable:
   ```
   VITE_API_URL=https://<your-render-service>.onrender.com
   ```

> **Important:** After deploying both, update `CLIENT_URL` on Render to your actual Vercel URL, and `VITE_API_URL` on Vercel to your actual Render URL. Redeploy both.

---

## Features

- Signup / Login / Logout (session-based auth)
- Create groups, invite members by email, remove members (admin only)
- Add, edit, delete expenses
- 4 split types: **equal, unequal (exact), percentage, shares**
- Real-time chat per expense via Socket.io
- Group balances (pairwise) + **debt simplification** (minimize transactions)
- Individual balance summary across all groups
- Record settlements / settle up

---

## Project Structure

```
splitwise-clone/
├── backend/
│   ├── src/
│   │   ├── server.js          # Express + Socket.io entry
│   │   ├── db.js              # MySQL pool
│   │   ├── middleware/auth.js
│   │   ├── routes/
│   │   │   ├── auth.js
│   │   │   ├── groups.js
│   │   │   ├── expenses.js
│   │   │   └── summary.js
│   │   └── utils/
│   │       ├── balances.js    # Pure balance + debt-simplification logic
│   │       └── splits.js      # Split calculation (4 types)
│   ├── schema.sql
│   ├── tests/balances.test.js
│   └── .env.example
├── frontend/
│   ├── src/
│   │   ├── api/client.js
│   │   ├── context/AuthContext.jsx
│   │   ├── components/
│   │   │   ├── Navbar.jsx
│   │   │   ├── ChatBox.jsx
│   │   │   ├── SplitEditor.jsx
│   │   │   └── SettleUpModal.jsx
│   │   └── pages/
│   │       ├── Login.jsx
│   │       ├── Signup.jsx
│   │       ├── Dashboard.jsx
│   │       ├── GroupDetail.jsx
│   │       ├── ExpenseForm.jsx
│   │       └── ExpenseDetail.jsx
│   └── .env.example
├── AI_CONTEXT.md
├── BUILD_PLAN.md
└── README.md
```

---

## AI Collaboration

This project was built using **Claude** (claude.ai) as the primary development collaborator, following the "junior engineer interview-first" approach described in the assignment.

The full context of all decisions, prompts, answers, architecture, schema, and reasoning is documented in [`AI_CONTEXT.md`](./AI_CONTEXT.md), which is maintained as the single source of truth throughout the build.
