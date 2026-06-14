const assert = require('assert');
const { computeNetBalances, computePairwiseBalances, simplifyDebts } = require('../src/utils/balances');
const { computeSplits } = require('../src/utils/splits');

// --- Split calculation tests ---
// Equal split 100 among 3 -> 33.34, 33.33, 33.33
let s = computeSplits(100, 'equal', [{ user_id: 1 }, { user_id: 2 }, { user_id: 3 }]);
assert.strictEqual(s.reduce((a, b) => a + b.amount, 0), 100);
console.log('equal split:', s);

// Unequal split
s = computeSplits(100, 'unequal', [
  { user_id: 1, value: 60 },
  { user_id: 2, value: 40 },
]);
assert.strictEqual(s[0].amount, 60);
assert.strictEqual(s[1].amount, 40);
console.log('unequal split:', s);

// Percentage split
s = computeSplits(100, 'percentage', [
  { user_id: 1, value: 50 },
  { user_id: 2, value: 25 },
  { user_id: 3, value: 25 },
]);
assert.strictEqual(s.reduce((a, b) => a + b.amount, 0), 100);
console.log('percentage split:', s);

// Share split
s = computeSplits(90, 'share', [
  { user_id: 1, value: 1 },
  { user_id: 2, value: 2 },
]);
assert.strictEqual(s[0].amount, 30);
assert.strictEqual(s[1].amount, 60);
console.log('share split:', s);

// --- Balance calculation tests ---
// Scenario: Alice(1) pays 100 for Alice, Bob(2), Charlie(3) equally (33.34/33.33/33.33)
const expenses = [
  {
    id: 1,
    amount: 100,
    paid_by: 1,
    splits: [
      { user_id: 1, amount: 33.34 },
      { user_id: 2, amount: 33.33 },
      { user_id: 3, amount: 33.33 },
    ],
  },
];
const net = computeNetBalances(expenses, []);
console.log('net balances:', net);
assert.strictEqual(net[1], 66.66); // owed by Bob + Charlie
assert.strictEqual(net[2], -33.33);
assert.strictEqual(net[3], -33.33);

const pairwise = computePairwiseBalances(expenses, []);
console.log('pairwise:', pairwise);

const suggestions = simplifyDebts(net);
console.log('simplified suggestions:', suggestions);
assert.strictEqual(suggestions.length, 2); // Bob->Alice, Charlie->Alice

// Scenario with settlement: Bob pays Alice 33.33, should zero out Bob's debt
const settlements = [{ paid_by: 2, paid_to: 1, amount: 33.33 }];
const net2 = computeNetBalances(expenses, settlements);
console.log('net balances after settlement:', net2);
assert.strictEqual(net2[2], 0);
assert.strictEqual(net2[1], 33.33); // still owed by Charlie

console.log('\nAll tests passed!');
