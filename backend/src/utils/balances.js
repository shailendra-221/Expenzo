/**
 * Pure functions for balance calculation and debt simplification.
 * No DB access here, easy to unit test.
 */

// Round to 2 decimals, avoiding floating point artifacts
function round2(n) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/**
 * Given expenses (with splits) and settlements for a group, compute the
 * net balance for every user: positive = group owes them, negative = they owe group.
 *
 * @param {Array} expenses - [{ id, amount, paid_by, splits: [{user_id, amount}] }]
 * @param {Array} settlements - [{ paid_by, paid_to, amount }]
 * @returns {Object} map of user_id -> net balance (number)
 */
function computeNetBalances(expenses, settlements) {
  const net = {}; // user_id -> balance

  const ensure = (uid) => {
    if (!(uid in net)) net[uid] = 0;
  };

  for (const exp of expenses) {
    const payer = exp.paid_by;
    ensure(payer);
    for (const split of exp.splits) {
      ensure(split.user_id);
      const share = Number(split.amount);
      if (split.user_id === payer) {
        // payer's own share: no transfer with self, but still counts toward
        // what they "consumed" — already covered since they paid full amount
        continue;
      }
      // split.user_id owes `share` to payer
      net[split.user_id] -= share;
      net[payer] += share;
    }
  }

  for (const s of settlements) {
    ensure(s.paid_by);
    ensure(s.paid_to);
    const amt = Number(s.amount);
    // paid_by gave money to paid_to => paid_by's debt decreases (net increases),
    // paid_to's credit decreases (net decreases)
    net[s.paid_by] += amt;
    net[s.paid_to] -= amt;
  }

  for (const uid of Object.keys(net)) {
    net[uid] = round2(net[uid]);
  }
  return net;
}

/**
 * Compute pairwise net balances between every pair of users.
 * Returns array of { from, to, amount } where `from` owes `to` amount (amount > 0).
 * This is the *raw* (non-simplified) pairwise view.
 */
function computePairwiseBalances(expenses, settlements) {
  const pair = {}; // key `${a}_${b}` (a<b) -> net amount, positive means b owes a

  const key = (a, b) => (a < b ? `${a}_${b}` : `${b}_${a}`);

  const adjust = (a, b, amount) => {
    // amount: b owes a `amount`
    const k = key(a, b);
    if (!(k in pair)) pair[k] = { a: Math.min(a, b), b: Math.max(a, b), net: 0 };
    const entry = pair[k];
    // net is defined as: positive => entry.b owes entry.a
    if (a === entry.a) {
      entry.net += amount;
    } else {
      entry.net -= amount;
    }
  };

  for (const exp of expenses) {
    const payer = exp.paid_by;
    for (const split of exp.splits) {
      if (split.user_id === payer) continue;
      const share = Number(split.amount);
      // split.user_id owes payer `share`
      adjust(payer, split.user_id, share);
    }
  }

  for (const s of settlements) {
    const amt = Number(s.amount);
    // paid_by paid paid_to amt => reduces what paid_by owed paid_to (or increases
    // what paid_to owes paid_by)
    adjust(s.paid_by, s.paid_to, amt);
  }

  const result = [];
  for (const k of Object.keys(pair)) {
    const { a, b, net } = pair[k];
    const rounded = round2(net);
    if (rounded > 0) {
      // b owes a
      result.push({ from: b, to: a, amount: rounded });
    } else if (rounded < 0) {
      // a owes b
      result.push({ from: a, to: b, amount: round2(-rounded) });
    }
  }
  return result;
}

/**
 * Greedy debt simplification: given net balances (user_id -> amount, positive =
 * owed money / creditor, negative = owes money / debtor), produce a minimal list
 * of suggested payments { from, to, amount } where `from` is a debtor and `to` a
 * creditor.
 */
function simplifyDebts(netBalances) {
  const EPS = 0.01;
  const creditors = [];
  const debtors = [];

  for (const [uid, amount] of Object.entries(netBalances)) {
    if (amount > EPS) creditors.push({ id: Number(uid), amount });
    else if (amount < -EPS) debtors.push({ id: Number(uid), amount: -amount });
  }

  creditors.sort((a, b) => b.amount - a.amount);
  debtors.sort((a, b) => b.amount - a.amount);

  const payments = [];
  let i = 0;
  let j = 0;

  while (i < debtors.length && j < creditors.length) {
    const debtor = debtors[i];
    const creditor = creditors[j];
    const amount = round2(Math.min(debtor.amount, creditor.amount));

    if (amount > EPS) {
      payments.push({ from: debtor.id, to: creditor.id, amount });
    }

    debtor.amount = round2(debtor.amount - amount);
    creditor.amount = round2(creditor.amount - amount);

    if (debtor.amount <= EPS) i++;
    if (creditor.amount <= EPS) j++;
  }

  return payments;
}

module.exports = {
  round2,
  computeNetBalances,
  computePairwiseBalances,
  simplifyDebts,
};
