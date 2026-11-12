import { describe, expect, it } from 'vitest';
import { validateJournalLines } from '../lib/accounting/journal-input';
const lines = [{ account_id: 'cash', debit: '0.10', credit: '' }, { account_id: 'cash', debit: '0.20', credit: '' }, { account_id: 'capital', credit: '0.30', debit: '' }];
describe('journal input', () => {
 it('balances using integer cents and preserves account sides', () => {
  expect(validateJournalLines(lines)).toMatchObject({ amount: '0.30', lines: [{ debit: '0.10', credit: '0.00' }, { debit: '0.20', credit: '0.00' }, { debit: '0.00', credit: '0.30' }] });
 });
 it.each(['-1', '1.001', '1e2', 'NaN', 'Infinity', '9007199254740991'])('rejects invalid or unsafe amounts %s', value => {
  expect(() => validateJournalLines([{ account_id: 'a', debit: value }, { account_id: 'b', credit: value }])).toThrow();
 });
 it('rejects missing accounts, single-sided journals, zero/both-sided lines and unbalanced totals', () => {
  for (const input of [[], [lines[0]], [{ ...lines[0], account_id: '' }, lines[2]], [{ account_id: 'a', debit: '1', credit: '1' }, lines[2]], [{ account_id: 'a' }, lines[2]], [lines[0], lines[2]]]) expect(() => validateJournalLines(input)).toThrow();
 });
});
