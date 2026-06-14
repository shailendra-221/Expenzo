const express = require('express');
const pool = require('../db');
const { requireAuth } = require('../middleware/auth');
const { computeSplits } = require('../utils/splits');

const router = express.Router();
router.use(requireAuth);

async function getMembership(groupId, userId) {
  const [rows] = await pool.query(
    'SELECT * FROM group_members WHERE group_id = ? AND user_id = ?',
    [groupId, userId]
  );
  return rows[0] || null;
}

async function loadExpenseWithSplits(expenseId) {
  const [expRows] = await pool.query(
    `SELECT e.*, p.name AS paid_by_name, c.name AS created_by_name
     FROM expenses e
     JOIN users p ON p.id = e.paid_by
     JOIN users c ON c.id = e.created_by
     WHERE e.id = ?`,
    [expenseId]
  );
  if (expRows.length === 0) return null;
  const expense = expRows[0];

  const [splitRows] = await pool.query(
    `SELECT es.user_id, es.amount, es.percentage, es.shares, u.name
     FROM expense_splits es
     JOIN users u ON u.id = es.user_id
     WHERE es.expense_id = ?`,
    [expenseId]
  );
  expense.splits = splitRows;
  return expense;
}

// GET /api/groups/:groupId/expenses - list expenses in group
router.get('/groups/:groupId/expenses', async (req, res) => {
  const { groupId } = req.params;
  const membership = await getMembership(groupId, req.session.userId);
  if (!membership) return res.status(403).json({ error: 'Not a member of this group' });

  const [rows] = await pool.query(
    `SELECT e.id, e.description, e.amount, e.split_type, e.expense_date, e.created_at,
            e.paid_by, u.name AS paid_by_name
     FROM expenses e
     JOIN users u ON u.id = e.paid_by
     WHERE e.group_id = ?
     ORDER BY e.expense_date DESC, e.created_at DESC`,
    [groupId]
  );
  res.json(rows);
});

// POST /api/groups/:groupId/expenses - create expense
router.post('/groups/:groupId/expenses', async (req, res) => {
  const { groupId } = req.params;
  const { description, amount, paid_by, expense_date, split_type, splits } = req.body;

  const membership = await getMembership(groupId, req.session.userId);
  if (!membership) return res.status(403).json({ error: 'Not a member of this group' });

  if (!description || !amount || !paid_by || !expense_date || !split_type || !Array.isArray(splits)) {
    return res.status(400).json({
      error: 'description, amount, paid_by, expense_date, split_type, and splits[] are required',
    });
  }

  const payerMembership = await getMembership(groupId, paid_by);
  if (!payerMembership) return res.status(400).json({ error: 'paid_by must be a group member' });

  for (const s of splits) {
    const m = await getMembership(groupId, s.user_id);
    if (!m) return res.status(400).json({ error: `User ${s.user_id} is not a member of this group` });
  }

  let computedSplits;
  try {
    computedSplits = computeSplits(
      amount,
      split_type,
      splits.map((s) => ({ user_id: s.user_id, value: s.value }))
    );
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [result] = await conn.query(
      `INSERT INTO expenses (group_id, description, amount, paid_by, split_type, expense_date, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [groupId, description, amount, paid_by, split_type, expense_date, req.session.userId]
    );
    const expenseId = result.insertId;

    for (const cs of computedSplits) {
      await conn.query(
        `INSERT INTO expense_splits (expense_id, user_id, amount, percentage, shares)
         VALUES (?, ?, ?, ?, ?)`,
        [expenseId, cs.user_id, cs.amount, cs.percentage, cs.shares]
      );
    }

    await conn.commit();
    const expense = await loadExpenseWithSplits(expenseId);
    res.status(201).json(expense);
  } catch (err) {
    await conn.rollback();
    console.error(err);
    res.status(500).json({ error: 'Failed to create expense' });
  } finally {
    conn.release();
  }
});

// GET /api/expenses/:id - expense detail incl. splits
router.get('/expenses/:id', async (req, res) => {
  const expense = await loadExpenseWithSplits(req.params.id);
  if (!expense) return res.status(404).json({ error: 'Expense not found' });

  const membership = await getMembership(expense.group_id, req.session.userId);
  if (!membership) return res.status(403).json({ error: 'Not a member of this group' });

  res.json(expense);
});

// PUT /api/expenses/:id - edit expense
router.put('/expenses/:id', async (req, res) => {
  const expenseId = req.params.id;
  const { description, amount, paid_by, expense_date, split_type, splits } = req.body;

  const existing = await loadExpenseWithSplits(expenseId);
  if (!existing) return res.status(404).json({ error: 'Expense not found' });

  const membership = await getMembership(existing.group_id, req.session.userId);
  if (!membership) return res.status(403).json({ error: 'Not a member of this group' });

  if (!description || !amount || !paid_by || !expense_date || !split_type || !Array.isArray(splits)) {
    return res.status(400).json({
      error: 'description, amount, paid_by, expense_date, split_type, and splits[] are required',
    });
  }

  const payerMembership = await getMembership(existing.group_id, paid_by);
  if (!payerMembership) return res.status(400).json({ error: 'paid_by must be a group member' });

  for (const s of splits) {
    const m = await getMembership(existing.group_id, s.user_id);
    if (!m) return res.status(400).json({ error: `User ${s.user_id} is not a member of this group` });
  }

  let computedSplits;
  try {
    computedSplits = computeSplits(
      amount,
      split_type,
      splits.map((s) => ({ user_id: s.user_id, value: s.value }))
    );
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await conn.query(
      `UPDATE expenses SET description = ?, amount = ?, paid_by = ?, split_type = ?, expense_date = ?
       WHERE id = ?`,
      [description, amount, paid_by, split_type, expense_date, expenseId]
    );
    await conn.query('DELETE FROM expense_splits WHERE expense_id = ?', [expenseId]);
    for (const cs of computedSplits) {
      await conn.query(
        `INSERT INTO expense_splits (expense_id, user_id, amount, percentage, shares)
         VALUES (?, ?, ?, ?, ?)`,
        [expenseId, cs.user_id, cs.amount, cs.percentage, cs.shares]
      );
    }
    await conn.commit();
    const expense = await loadExpenseWithSplits(expenseId);
    res.json(expense);
  } catch (err) {
    await conn.rollback();
    console.error(err);
    res.status(500).json({ error: 'Failed to update expense' });
  } finally {
    conn.release();
  }
});

// DELETE /api/expenses/:id
router.delete('/expenses/:id', async (req, res) => {
  const expenseId = req.params.id;
  const existing = await loadExpenseWithSplits(expenseId);
  if (!existing) return res.status(404).json({ error: 'Expense not found' });

  const membership = await getMembership(existing.group_id, req.session.userId);
  if (!membership) return res.status(403).json({ error: 'Not a member of this group' });

  await pool.query('DELETE FROM expenses WHERE id = ?', [expenseId]);
  res.json({ ok: true });
});

// GET /api/expenses/:id/messages - chat history
router.get('/expenses/:id/messages', async (req, res) => {
  const expenseId = req.params.id;
  const [expRows] = await pool.query('SELECT group_id FROM expenses WHERE id = ?', [expenseId]);
  if (expRows.length === 0) return res.status(404).json({ error: 'Expense not found' });

  const membership = await getMembership(expRows[0].group_id, req.session.userId);
  if (!membership) return res.status(403).json({ error: 'Not a member of this group' });

  const [rows] = await pool.query(
    `SELECT m.id, m.message, m.created_at, u.id AS user_id, u.name AS user_name
     FROM expense_messages m
     JOIN users u ON u.id = m.user_id
     WHERE m.expense_id = ?
     ORDER BY m.created_at ASC`,
    [expenseId]
  );
  res.json(rows);
});

module.exports = router;
