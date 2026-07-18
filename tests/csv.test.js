import test from 'node:test';
import assert from 'node:assert/strict';
import { parseCsv, transactionsToCsv } from '../src/lib/csv.js';

test('CSV export and import preserve useful transaction data', () => {
  const source = [{ date: '2026-07-18', type: 'expense', amount: 120.5, description: 'Gas, negocio', category: 'Servicios', personal: false, notes: 'Tanque "grande"' }];
  const parsed = parseCsv(transactionsToCsv(source));
  assert.equal(parsed.length, 1);
  assert.equal(parsed[0].description, 'Gas, negocio');
  assert.equal(parsed[0].amount, 120.5);
  assert.equal(parsed[0].notes, 'Tanque "grande"');
});

test('CSV import accepts common Spanish headers', () => {
  const parsed = parseCsv('fecha,tipo,monto,concepto,categoria,personal\n2026-07-01,ingreso,500,Venta,Ventas,no');
  assert.equal(parsed[0].type, 'income');
  assert.equal(parsed[0].amount, 500);
});
