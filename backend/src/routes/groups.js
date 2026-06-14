const express = require('express');
const pool = require('../db');
const { requireAuth } = require('../middleware/auth');
const {
  computeNetBalances,
  computePairwiseBalances,
  simplifyDebts,
} = require('../utils/balances');

const router = express.Router();
router.use(requireAuth);

async function getMembership(groupId, userId) {
  const [rows] = await pool.query(
    'SELECT * FROM group_members WHERE group_id = ? AND user_id = ?',
    [groupId, userId]
  );
  return rows[0] || null;
}

// GET /api/groups
router.get('/', async (req, res) => {
  const [rows] = await pool.query(
    `SELECT g.id, g.name, g.description, g.created_by, g.created_at
     FROM user_groups g
     JOIN group_members gm ON gm.group_id = g.id
     WHERE gm.user_id = ?
     ORDER BY g.created_at DESC`,
    [req.session.userId]
  );
  res.json(rows);
});

// POST /api/groups
router.post('/', async (req, res) => {
  const { name, description } = req.body;
  if (!name) return res.status(400).json({ error: 'name is required' });

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [result] = await conn.query(
      'INSERT INTO user_groups (name, description, created_by) VALUES (?, ?, ?)',
      [name, description || null, req.session.userId]
    );
    const groupId = result.insertId;
    await conn.query(
      'INSERT INTO group_members (group_id, user_id, role) VALUES (?, ?, ?)',
      [groupId, req.session.userId, 'admin']
    );
    await conn.commit();
    res.status(201).json({ id: groupId, name, description: description || null });
  } catch (err) {
    await conn.rollback();
    console.error(err);
    res.status(500).json({ error: 'Failed to create group' });
  } finally {
    conn.release();
  }
});

// GET /api/groups/:id
router.get('/:id', async (req, res) => {
  const groupId = req.params.id;
  const membership = await getMembership(groupId, req.session.userId);
  if (!membership) return res.status(403).json({ error: 'Not a member of this group' });

  const [groupRows] = await pool.query('SELECT * FROM user_groups WHERE id = ?', [groupId]);
  if (groupRows.length === 0) return res.status(404).json({ error: 'Group not found' });

  const [members] = await pool.query(
    `SELECT u.id, u.name, u.email, gm.role
     FROM group_members gm
     JOIN users u ON u.id = gm.user_id
     WHERE gm.group_id = ?
     ORDER BY gm.joined_at ASC`,
    [groupId]
  );

  res.json({ ...groupRows[0], members, currentUserRole: membership.role });
});

// POST /api/groups/:id/members
router.post('/:id/members', async (req, res) => {
  const groupId = req.params.id;
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'email is required' });

  const membership = await getMembership(groupId, req.session.userId);
  if (!membership) return res.status(403).json({ error: 'Not a member of this group' });

  const [userRows] = await pool.query('SELECT id, name, email FROM users WHERE email = ?', [email]);
  if (userRows.length === 0) {
    return res.status(404).json({ error: 'No registered user with that email' });
  }
  const targetUser = userRows[0];

  const existing = await getMembership(groupId, targetUser.id);
  if (existing) {
    return res.status(409).json({ error: 'User is already a member of this group' });
  }

  await pool.query('INSERT INTO group_members (group_id, user_id, role) VALUES (?, ?, ?)', [
    groupId,
    targetUser.id,
    'member',
  ]);

  res.status(201).json({ id: targetUser.id, name: targetUser.name, email: targetUser.email, role: 'member' });
});

// DELETE /api/groups/:id/members/:userId
router.delete('/:id/members/:userId', async (req, res) => {
  const groupId = req.params.id;
  const targetUserId = Number(req.params.userId);

  const membership = await getMembership(groupId, req.session.userId);
  if (!membership) return res.status(403).json({ error: 'Not a member of this group' });
  if (membership.role !== 'admin') {
    return res.status(403).json({ error: 'Only the group admin can remove members' });
  }

  const [groupRows] = await pool.query('SELECT created_by FROM user_groups WHERE id = ?', [groupId]);
  if (groupRows.length === 0) return res.status(404).json({ error: 'Group not found' });
  if (groupRows[0].created_by === targetUserId) {
    return res.status(400).json({ error: 'Cannot remove the group creator' });
  }

  const target = await getMembership(groupId, targetUserId);
  if (!target) return res.status(404).json({ error: 'User is not a member of this group' });

  await pool.query('DELETE FROM group_members WHERE group_id = ? AND user_id = ?', [
    groupId,
    targetUserId,
  ]);

  res.json({ ok: true });
});

// GET /api/groups/:id/balances
router.get('/:id/balances', async (req, res) => {
  const groupId = req.params.id;
  const membership = await getMembership(groupId, req.session.userId);
  if (!membership) return res.status(403).json({ error: 'Not a member of this group' });

  const [expenseRows] = await pool.query(
    'SELECT id, amount, paid_by FROM expenses WHERE group_id = ?',
    [groupId]
  );
  const expenseIds = expenseRows.map((e) => e.id);

  let splitsByExpense = {};
  if (expenseIds.length > 0) {
    const [splitRows] = await pool.query(
      `SELECT expense_id, user_id, amount FROM expense_splits WHERE expense_id IN (?)`,
      [expenseIds]
    );
    for (const s of splitRows) {
      if (!splitsByExpense[s.expense_id]) splitsByExpense[s.expense_id] = [];
      splitsByExpense[s.expense_id].push({ user_id: s.user_id, amount: s.amount });
    }
  }

  const expenses = expenseRows.map((e) => ({
    id: e.id,
    amount: e.amount,
    paid_by: e.paid_by,
    splits: splitsByExpense[e.id] || [],
  }));

  const [settlementRows] = await pool.query(
    'SELECT paid_by, paid_to, amount FROM settlements WHERE group_id = ?',
    [groupId]
  );

  const netBalances = computeNetBalances(expenses, settlementRows);
  const pairwise = computePairwiseBalances(expenses, settlementRows);
  const suggestions = simplifyDebts(netBalances);

  const [members] = await pool.query(
    `SELECT u.id, u.name FROM group_members gm
     JOIN users u ON u.id = gm.user_id
     WHERE gm.group_id = ?`,
    [groupId]
  );
  const nameMap = {};
  members.forEach((m) => (nameMap[m.id] = m.name));

  res.json({
    netBalances: Object.entries(netBalances).map(([userId, amount]) => ({
      user_id: Number(userId),
      name: nameMap[Number(userId)],
      amount,
    })),
    pairwise: pairwise.map((p) => ({
      ...p,
      fromName: nameMap[p.from],
      toName: nameMap[p.to],
    })),
    suggestions: suggestions.map((s) => ({
      ...s,
      fromName: nameMap[s.from],
      toName: nameMap[s.to],
    })),
  });
});

// GET /api/groups/:id/settlements
router.get('/:id/settlements', async (req, res) => {
  const groupId = req.params.id;
  const membership = await getMembership(groupId, req.session.userId);
  if (!membership) return res.status(403).json({ error: 'Not a member of this group' });

  const [rows] = await pool.query(
    `SELECT s.id, s.amount, s.settled_at,
            pb.id AS paid_by_id, pb.name AS paid_by_name,
            pt.id AS paid_to_id, pt.name AS paid_to_name
     FROM settlements s
     JOIN users pb ON pb.id = s.paid_by
     JOIN users pt ON pt.id = s.paid_to
     WHERE s.group_id = ?
     ORDER BY s.settled_at DESC`,
    [groupId]
  );
  res.json(rows);
});

// POST /api/groups/:id/settlements
router.post('/:id/settlements', async (req, res) => {
  const groupId = req.params.id;
  const { paid_by, paid_to, amount } = req.body;

  const membership = await getMembership(groupId, req.session.userId);
  if (!membership) return res.status(403).json({ error: 'Not a member of this group' });

  if (!paid_by || !paid_to || !amount || Number(amount) <= 0) {
    return res.status(400).json({ error: 'paid_by, paid_to, and a positive amount are required' });
  }
  if (paid_by === paid_to) {
    return res.status(400).json({ error: 'paid_by and paid_to must differ' });
  }

  const payerMembership = await getMembership(groupId, paid_by);
  const payeeMembership = await getMembership(groupId, paid_to);
  if (!payerMembership || !payeeMembership) {
    return res.status(400).json({ error: 'Both users must be members of this group' });
  }

  const [result] = await pool.query(
    'INSERT INTO settlements (group_id, paid_by, paid_to, amount) VALUES (?, ?, ?, ?)',
    [groupId, paid_by, paid_to, amount]
  );

  res.status(201).json({ id: result.insertId, group_id: Number(groupId), paid_by, paid_to, amount });
});

module.exports = router;