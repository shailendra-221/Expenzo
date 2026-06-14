# BUILD_PLAN.md — Splitwise Clone

## 1. Product Research
Splitwise's core loop was reverse-engineered as: groups → expenses with flexible
splits → continuously-derived pairwise balances → debt simplification → manual
settlements. The "expense detail" view in real Splitwise supports comments, which
maps to this project's "expense chat" requirement.

**Workflows identified:**
- Onboarding: signup → create/join group via invite.
- Expense lifecycle: create (choose split type) → view/edit/delete → discuss via
  chat.
- Money lifecycle: balances auto-update from expenses → user views simplified
  "who should pay whom" → records a settlement → balances update again.

**Assumptions made (confirmed via interview, see AI_CONTEXT.md §1, §3, §4):**
- All expenses are group-scoped (no 1:1 expenses).
- Invitees must be existing users.
- Any member can add expenses; only the creator can remove members.
- Settlements are manual records, no payment gateway.
- Debt simplification uses a greedy min-transactions algorithm.

## 2. Architecture
- **Stack**: React+Vite frontend, Node/Express+Socket.io backend, MySQL DB
  (raw SQL via mysql2, no ORM).
- **DB schema**: users, groups, group_members, expenses, expense_splits,
  settlements, expense_messages (+ sessions table for express-mysql-session).
  Full schema in AI_CONTEXT.md §6.
- **API**: REST under `/api`, documented in AI_CONTEXT.md §7. Real-time chat via
  Socket.io rooms per expense.
- **Frontend structure**: pages for Login/Signup/Dashboard/GroupDetail/
  ExpenseForm/ExpenseDetail, shared components for split editing, balances,
  settle-up modal, chat. Detailed in AI_CONTEXT.md §8.
- **Deployment**: Backend on Render, MySQL on a free external host, frontend on
  Vercel. Details in AI_CONTEXT.md §9.

## 3. AI Collaboration Process
- Followed the assignment's required initial prompt: AI acted as a junior engineer
  and interviewed before building anything.
- Five rounds of questions covered: stack choice, auth/signup/chat tech, group
  invite/expense permissions/expense scope, settlement & balance complexity &
  member-removal rules, deployment target & split-type/edit-delete behaviour.
- Each answer was folded directly into AI_CONTEXT.md (single cumulative doc,
  v0.1 as of interview completion).
- AI_CONTEXT.md will continue to be updated in its Change Log section (§12) as
  implementation proceeds — schema tweaks, API additions, deployment specifics,
  and any deviations will be logged there with version bumps.

## 4. Trade-offs
See AI_CONTEXT.md §11 for the full list. Summary:
- Simplified invite model (no pending invites for unregistered emails).
- Single currency, no notifications, no payment gateway — all to fit 2-3 day scope.
- Greedy (not provably-optimal) debt simplification — standard, good enough.
- With more time: add pending invites, email notifications, multi-currency,
  receipt uploads, recurring expenses, and a proper test suite (frontend + e2e).
