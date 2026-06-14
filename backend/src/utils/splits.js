const { round2 } = require('./balances');

/**
 * Given a total amount, split type, and raw input values per participant,
 * compute the final per-participant amount (in currency units, 2dp), ensuring
 * the sum exactly equals `amount` (remainder cents distributed to the first
 * participants in the list to handle rounding).
 *
 * @param {number} amount - total expense amount
 * @param {string} splitType - 'equal' | 'unequal' | 'percentage' | 'share'
 * @param {Array} participants - [{ user_id, value }]
 *   - for 'equal': value is ignored
 *   - for 'unequal': value = exact amount (must sum to `amount`, validated by caller)
 *   - for 'percentage': value = percentage (must sum to 100, validated by caller)
 *   - for 'share': value = integer shares
 * @returns {Array} [{ user_id, amount, percentage, shares }]
 */
function computeSplits(amount, splitType, participants) {
  const total = round2(amount);
  const n = participants.length;
  if (n === 0) throw new Error('At least one participant required');

  switch (splitType) {
    case 'equal': {
      const base = Math.floor((total * 100) / n) / 100;
      let remainder = round2(total - base * n);
      return participants.map((p, idx) => {
        let amt = base;
        if (remainder > 0) {
          amt = round2(amt + 0.01);
          remainder = round2(remainder - 0.01);
        }
        return { user_id: p.user_id, amount: round2(amt), percentage: null, shares: null };
      });
    }

    case 'unequal': {
      const sum = round2(participants.reduce((s, p) => s + Number(p.value), 0));
      if (Math.abs(sum - total) > 0.01) {
        throw new Error(
          `Unequal split amounts (${sum}) must sum to total (${total})`
        );
      }
      return participants.map((p) => ({
        user_id: p.user_id,
        amount: round2(Number(p.value)),
        percentage: null,
        shares: null,
      }));
    }

    case 'percentage': {
      const sumPct = round2(participants.reduce((s, p) => s + Number(p.value), 0));
      if (Math.abs(sumPct - 100) > 0.01) {
        throw new Error(`Percentages must sum to 100 (got ${sumPct})`);
      }
      // compute amounts, fix rounding by adjusting last participant
      let amounts = participants.map((p) => round2((total * Number(p.value)) / 100));
      let diff = round2(total - amounts.reduce((s, a) => s + a, 0));
      if (diff !== 0) {
        amounts[amounts.length - 1] = round2(amounts[amounts.length - 1] + diff);
      }
      return participants.map((p, idx) => ({
        user_id: p.user_id,
        amount: amounts[idx],
        percentage: round2(Number(p.value)),
        shares: null,
      }));
    }

    case 'share': {
      const totalShares = participants.reduce((s, p) => s + Number(p.value), 0);
      if (totalShares <= 0) throw new Error('Total shares must be > 0');
      let amounts = participants.map((p) =>
        round2((total * Number(p.value)) / totalShares)
      );
      let diff = round2(total - amounts.reduce((s, a) => s + a, 0));
      if (diff !== 0) {
        amounts[amounts.length - 1] = round2(amounts[amounts.length - 1] + diff);
      }
      return participants.map((p, idx) => ({
        user_id: p.user_id,
        amount: amounts[idx],
        percentage: null,
        shares: Number(p.value),
      }));
    }

    default:
      throw new Error(`Unknown split type: ${splitType}`);
  }
}

module.exports = { computeSplits };
