import test from 'node:test';
import assert from 'node:assert/strict';
import { healthScore, localInsights, summarize } from '../src/lib/finance.js';

const transactions = [
  { type: 'income', amount: 1000, date: '2026-07-01', category: 'Ventas' },
  { type: 'expense', amount: 250, date: '2026-07-02', category: 'Insumos', personal: false },
  { type: 'expense', amount: 100, date: '2026-07-03', category: 'Casa', personal: true },
  { type: 'income', amount: 999, date: '2026-06-01', category: 'Ventas' },
];

test('summarize only includes the selected month', () => {
  const result = summarize(transactions, '2026-07');
  assert.equal(result.income, 1000);
  assert.equal(result.expense, 350);
  assert.equal(result.personal, 100);
  assert.equal(result.businessExpense, 250);
  assert.equal(result.balance, 650);
});

test('local insights flag mixed personal expenses', () => {
  const result = summarize(transactions, '2026-07');
  assert.ok(localInsights(result).some((item) => item.title.includes('casa')));
});

test('health score stays between zero and one hundred', () => {
  const result = summarize(transactions, '2026-07');
  assert.ok(healthScore(result) >= 0 && healthScore(result) <= 100);
});
