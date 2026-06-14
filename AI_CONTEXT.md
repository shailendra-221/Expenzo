# AI_CONTEXT.md — Splitwise Clone

This document is the **single source of truth** for this project. It is maintained
continuously throughout development. Another developer (or AI agent) should be able
to read this file alone and rebuild a functionally similar app.

---

## 1. Product Understanding

### What is Splitwise (researched behaviour)
Splitwise lets groups of people track shared expenses and who owes whom. Core loop:
1. A user creates a **group** (e.g. "Goa Trip") and adds members.
2. Members **add expenses** to the group — who paid, total amount, and how it's split
   among participants (equally, by exact amounts, by percentage, or by shares).
3. The app continuously computes a **net balance** between every pair of users —
   "Alice owes Bob ₹500", "Bob owes Charlie ₹200", etc.
4. Splitwise **simplifies debts**: instead of showing every pairwise IOU, it nets
   everything down to the minimum number of payments needed to settle the group.
5. Users can **record a settlement/payment** ("Alice paid Bob ₹500") which adjusts
   balances without re-touching the original expenses.
6. Each expense has its own detail view; in this clone, that view also has a **chat**
   thread (real-time) for participants to discuss the expense.

### Key product decisions for this clone
- All expenses are **group-scoped**. No 1-on-1/non-group expenses (out of scope).
- Groups are invite-based; invited users **must already have an account** (no
  pending/ghost users).
- **Any member** of a group can add an expense (not just admins).
- Only the **group creator (admin)** can remove members.
- Settlements are **manual, no real payment gateway** — just a record that says
  "X paid Y ₹amount" which is treated as an expense-like transaction for balance math.
- Balance calculation uses a **debt-simplification algorithm** (graph netting +
  greedy min-cash-flow) to minimize the number of suggested payments.

---

## 2. Personas
- **Group member**: registers, joins groups via invite, adds/edits/deletes expenses,
  chats on expenses, views balances, settles up.
- **Group admin** (= creator of the group): everything a member can do, plus invite
  and remove members.

---

## 3. MVP Scope (in-scope for the 2–3 day build)

1. **Auth**
   - Signup (name, email, password) and Login using email+password.
   - Sessions via cookies (express-session, server-side session store).
   - Logout.

2. **Groups**
   - Create group (name, optional description).
   - View list of groups the logged-in user belongs to.
   - Group detail page: members list, balances, expenses list, settle-up.
   - Invite member by email — only works if that email already has an account.
     Invited user is added directly to the group (no pending-invite state, to keep
     scope tight — see "Out of scope" for the alternative considered).
   - Remove member — only the group creator can do this.

3. **Expenses**
   - Create expense within a group: description, amount, paid_by (defaults to current
     user but can pick any member), date, and split type.
   - Split types:
     - **Equal**: amount divided evenly among selected participants (remainder cents
       distributed to first participants to make totals exact).
     - **Unequal (exact amounts)**: user enters exact ₹ amount per participant; must
       sum to total.
     - **Percentage**: user enters % per participant; must sum to 100%.
     - **Shares**: user enters integer shares per participant; amount computed
       proportional to shares.
   - Edit expense (re-opens the split form, recalculates shares).
   - Delete expense (removes its splits too).
   - Expense detail page shows: who paid, full split breakdown, and a **chat thread**.

4. **Chat (per expense, real-time)**
   - Socket.io. Each expense detail page joins a room `expense_<id>`.
   - Messages: sender, text, timestamp. Persisted to DB, broadcast live to anyone
     viewing that expense.

5. **Balances**
   - **Pairwise net balance** per group computed from all expense-splits +
     settlements: for every pair (A,B), net = sum(amounts B owes A) − sum(amounts
     A owes B).
   - **Debt simplification**: given net balances of all members, run a greedy
     algorithm (sort debtors/creditors, match largest debtor to largest creditor
     repeatedly) to produce a minimal list of suggested payments ("A should pay B
     ₹X").
   - **Individual balance summary** (across all groups): "You are owed ₹X overall",
     "You owe ₹Y overall", per-group breakdown.

6. **Settlements**
   - "Settle up" button on group page → modal lets user pick "I paid <person>" or
     "<person> paid me", enter amount (pre-filled with suggested simplified amount,
     editable), and record it.
   - A settlement is stored as its own record (not an expense) but is included in
     balance calculations as a transfer from payer→payee that reduces what payer
     owes payee (or increases what payee owes payer).

---

## 4. Out of Scope (explicitly, to manage 2–3 day timeline)
- Non-group / 1-on-1 expenses.
- Pending invites for non-registered emails (Splitwise sends email invites to
  unregistered users — we require the invitee to already have an account).
- Receipt image uploads / OCR.
- Push notifications / email notifications.
- Multiple currencies (single currency, ₹ INR, hardcoded).
- Recurring expenses.
- Expense categories with icons (a simple free-text "category" field may exist but
  no icon library).
- Real payment gateway integration for settlements.
- Password reset / email verification flows.
- Role changes (admin transfer) — creator is permanently the only admin.

---

## 5. Tech Stack

- **Frontend**: React 18 + Vite, React Router, Axios, Socket.io-client. Plain CSS
  (no heavy UI framework, to keep build time low) — clean, minimal custom styling.
- **Backend**: Node.js + Express, Socket.io for real-time chat.
- **Database**: MySQL (relational, satisfies the "relational DB only" requirement).
  Using `mysql2` driver with connection pool, raw parameterized SQL (no ORM, so the
  schema/queries are fully transparent for the evaluation/quiz).
- **Auth**: `bcrypt` for password hashing, `express-session` for session cookies.
  In production, sessions stored via `express-mysql-session` (sessions table in the
  same MySQL DB) so it works on Render's ephemeral filesystem.
- **Deployment**:
  - Frontend → Vercel (static build of the Vite app).
  - Backend + MySQL → Render (Web Service for Express+Socket.io, and a Render
    managed MySQL... — note: Render's free tier does not offer managed MySQL, so we
    use a free external MySQL host, e.g. Aiven/Railway MySQL/Clever Cloud, and point
    the Render backend at it via env vars). This will be finalized in the deployment
    plan section as we build.
- **Repo structure**: monorepo with `/backend` and `/frontend` folders, single
  GitHub repo.

---

## 6. Database Schema (MySQL)

```sql
-- USERS
CREATE TABLE users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(150) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- GROUPS
CREATE TABLE groups (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  description VARCHAR(255),
  created_by INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (created_by) REFERENCES users(id)
);

-- GROUP MEMBERS (join table)
CREATE TABLE group_members (
  id INT AUTO_INCREMENT PRIMARY KEY,
  group_id INT NOT NULL,
  user_id INT NOT NULL,
  role ENUM('admin','member') DEFAULT 'member',
  joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE KEY uniq_group_user (group_id, user_id)
);

-- EXPENSES
CREATE TABLE expenses (
  id INT AUTO_INCREMENT PRIMARY KEY,
  group_id INT NOT NULL,
  description VARCHAR(255) NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  paid_by INT NOT NULL,             -- user_id who paid
  split_type ENUM('equal','unequal','percentage','share') NOT NULL,
  expense_date DATE NOT NULL,
  created_by INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE,
  FOREIGN KEY (paid_by) REFERENCES users(id),
  FOREIGN KEY (created_by) REFERENCES users(id)
);

-- EXPENSE SPLITS (who owes how much for each expense)
CREATE TABLE expense_splits (
  id INT AUTO_INCREMENT PRIMARY KEY,
  expense_id INT NOT NULL,
  user_id INT NOT NULL,
  amount DECIMAL(10,2) NOT NULL,     -- this user's share of the expense (₹)
  percentage DECIMAL(5,2) NULL,      -- only for split_type='percentage'
  shares INT NULL,                   -- only for split_type='share'
  FOREIGN KEY (expense_id) REFERENCES expenses(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- SETTLEMENTS (manual "settle up" records)
CREATE TABLE settlements (
  id INT AUTO_INCREMENT PRIMARY KEY,
  group_id INT NOT NULL,
  paid_by INT NOT NULL,    -- who handed over money
  paid_to INT NOT NULL,    -- who received it
  amount DECIMAL(10,2) NOT NULL,
  settled_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE,
  FOREIGN KEY (paid_by) REFERENCES users(id),
  FOREIGN KEY (paid_to) REFERENCES users(id)
);

-- EXPENSE CHAT MESSAGES
CREATE TABLE expense_messages (
  id INT AUTO_INCREMENT PRIMARY KEY,
  expense_id INT NOT NULL,
  user_id INT NOT NULL,
  message TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (expense_id) REFERENCES expenses(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- SESSIONS (used by express-mysql-session)
-- table auto-created by express-mysql-session, named `sessions`
```

### Balance computation logic (no stored balance table)
Balances are computed on-the-fly from `expense_splits` + `expenses` + `settlements`:

- For each expense: the payer is owed `split.amount` by every other participant
  in that split (the payer's own split row represents their own share, which they
  effectively "paid to themselves" — net contribution = amount_paid − own_share).
- For each settlement: `paid_by` reduces what they owe `paid_to` by `amount`
  (equivalently increases `paid_by`'s net balance by `amount` and decreases
  `paid_to`'s net balance by `amount` against each other).
- Net balance between two users A and B in a group =
  `sum(amounts B's share in expenses paid by A)` + `sum(settlements A→B)`
  − `sum(amounts A's share in expenses paid by B)` − `sum(settlements B→A)`.
- Positive net(A,B) = B owes A that amount.

### Debt Simplification Algorithm
1. Compute each member's overall net position in the group:
   `net[user] = sum over all other users of net(user, other)`.
   (Equivalently: total they're owed minus total they owe, group-wide.)
2. Split users into creditors (net > 0) and debtors (net < 0).
3. Sort creditors descending by amount, debtors ascending (most negative first).
4. Greedily match the largest debtor with the largest creditor: transfer
   `min(|debtor|, creditor)`, record as a suggested payment (debtor → creditor),
   reduce both by that amount, repeat until all are ~0.
This minimizes the number of transactions needed to settle the whole group.

---

## 7. API Design (REST + Socket.io)

Base URL: `/api`

### Auth
- `POST /api/auth/signup` — { name, email, password } → creates user, starts session
- `POST /api/auth/login` — { email, password } → starts session
- `POST /api/auth/logout` — destroys session
- `GET /api/auth/me` — returns current logged-in user (or 401)

### Groups
- `GET /api/groups` — list groups for current user
- `POST /api/groups` — { name, description } → create group (creator = admin)
- `GET /api/groups/:id` — group details + members
- `POST /api/groups/:id/members` — { email } → add existing user by email
- `DELETE /api/groups/:id/members/:userId` — remove member (admin only)
- `GET /api/groups/:id/balances` — pairwise net balances + simplified payment suggestions

### Expenses
- `GET /api/groups/:id/expenses` — list expenses in group
- `POST /api/groups/:id/expenses` — create expense { description, amount, paid_by,
  expense_date, split_type, splits: [{user_id, amount|percentage|shares}] }
- `GET /api/expenses/:id` — expense detail incl. splits
- `PUT /api/expenses/:id` — edit expense (same shape as create)
- `DELETE /api/expenses/:id` — delete expense

### Settlements
- `POST /api/groups/:id/settlements` — { paid_by, paid_to, amount }
- `GET /api/groups/:id/settlements` — list settlement history

### Chat
- `GET /api/expenses/:id/messages` — message history
- Socket.io events:
  - client emits `join_expense` with `{ expenseId }`
  - client emits `send_message` with `{ expenseId, message }` → server persists,
    then broadcasts `new_message` to room `expense_<id>`

### Summary
- `GET /api/me/summary` — overall "you owe / you are owed" across all groups, plus
  per-group breakdown

---

## 8. Frontend Structure

```
/src
  /api          -> axios instance + API call wrappers
  /context      -> AuthContext (current user, login/logout)
  /pages
    Login.jsx
    Signup.jsx
    Dashboard.jsx        (groups list + overall summary)
    GroupDetail.jsx       (members, balances, expenses list, settle-up modal)
    ExpenseForm.jsx       (create/edit expense, split-type UI)
    ExpenseDetail.jsx     (split breakdown + chat)
  /components
    Navbar.jsx
    GroupCard.jsx
    ExpenseListItem.jsx
    SplitEditor.jsx       (shared UI for equal/unequal/%/share inputs)
    BalanceSummary.jsx
    SettleUpModal.jsx
    ChatBox.jsx
  App.jsx (routes), main.jsx
```

### Routes
- `/login`, `/signup`
- `/` — Dashboard (protected)
- `/groups/:id` — Group detail (protected)
- `/groups/:id/expenses/new` — new expense
- `/expenses/:id` — expense detail (split + chat)
- `/expenses/:id/edit` — edit expense

---

## 9. Deployment Plan
- Backend (Express + Socket.io) → Render Web Service. Env vars: `DB_HOST`,
  `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `SESSION_SECRET`, `CLIENT_URL` (for CORS).
- MySQL → free external MySQL (e.g. Aiven free tier / Railway MySQL plugin) since
  Render free tier has no managed MySQL. Connection string via env vars.
- Frontend → Vercel. Env var `VITE_API_URL` pointing at the Render backend URL.
- CORS configured on backend to allow the Vercel domain, with credentials enabled
  for session cookies (`SameSite=None; Secure` cookies in production).

---

## 10. Testing Plan
- Manual test script covering: signup → login → create group → invite member
  → add expenses with each of the 4 split types → verify balances → simplify debts
  → settle up → verify balances update → chat on an expense (two browser sessions)
  → edit/delete expense → verify balances recompute → remove member (admin only).
- Backend: a few Jest tests for the balance-calculation and debt-simplification
  pure functions (these are the riskiest logic, so unit tests focus here).

---

## 11. Trade-offs / Known Limitations
- No pending-invite flow — invitee must already be a registered user.
- Single currency (INR), hardcoded.
- No email notifications/verification/password reset.
- Sessions require a DB-backed session store in production (added dependency
  `express-mysql-session`).
- Debt simplification is greedy (not globally optimal in pathological cases, but
  standard and matches Splitwise's documented behavior closely enough for MVP).
- No receipt uploads, no recurring expenses, no multi-currency.

---

## 12. Change Log
- v0.1 — Initial context captured from interview (this version). Scope, schema,
  API, and architecture defined. Implementation starting next.
