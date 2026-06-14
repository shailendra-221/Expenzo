const express = require('express');
const pool = require('../db');
const { requireAuth } = require('../middleware/auth');
const { computeNetBalances } = require('../utils/balances');

const router = express.Router();
router.use(requireAuth);

// GET /api/me/summary
router.get('/summary', async (req, res) => {
  const userId = req.session.userId;

  const [groups] = await pool.query(
    `SELECT g.id, g.name FROM user_groups g
     JOIN group_members gm ON gm.group_id = g.id
     WHERE gm.user_id = ?`,
    [userId]
  );

  let totalOwedToYou = 0;
  let totalYouOwe = 0;
  const perGroup = [];

  for (const group of groups) {
    const [expenseRows] = await pool.query(
      'SELECT id, amount, paid_by FROM expenses WHERE group_id = ?',
      [group.id]
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
      [group.id]
    );

    const netBalances = computeNetBalances(expenses, settlementRows);
    const myBalance = netBalances[userId] || 0;

    if (myBalance > 0) totalOwedToYou += myBalance;
    else totalYouOwe += -myBalance;

    perGroup.push({ group_id: group.id, group_name: group.name, balance: myBalance });
  }

  res.json({
    totalOwedToYou: Math.round(totalOwedToYou * 100) / 100,
    totalYouOwe: Math.round(totalYouOwe * 100) / 100,
    net: Math.round((totalOwedToYou - totalYouOwe) * 100) / 100,
    perGroup,
  });
});

module.exports = router;