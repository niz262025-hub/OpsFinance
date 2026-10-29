import {expect,it} from 'vitest';
import {verifyStatementAccount,normalizeAccountNumber} from '../lib/accounting/statement-account';
const csv='Date,Description,Debit,Credit\n2026-10-29,UAT,,25.00';
it('compares full numbers with leading zeros and permits only spacing/hyphen formatting',()=>{
  expect(normalizeAccountNumber('00-12 35')).toBe('001235');
  expect(verifyStatementAccount('Account Number,00-12 35\n'+csv,'001235')).toEqual({csv,accountNumber:'001235'});
  expect(()=>verifyStatementAccount('Account Number,1235\n'+csv,'001235')).toThrow('Wrong account uploaded');
});
it('rejects wrong, masked, missing or contradictory metadata',()=>{
  expect(()=>verifyStatementAccount('Account Number,3450\n'+csv,'1235')).toThrow('Wrong account uploaded');
  expect(()=>verifyStatementAccount(csv,'1235')).toThrow('does not contain');
  expect(()=>verifyStatementAccount('Account Number,XX1235\n'+csv,'1235')).toThrow('masked');
  expect(()=>verifyStatementAccount('Account Number,1235\nAccount No,3450\n'+csv,'1235')).toThrow('Wrong account uploaded');
  expect(()=>verifyStatementAccount(csv,null)).toThrow('Add the account number');
});
it('verifies every account-number column value and recognizes colon metadata',()=>{
  expect(verifyStatementAccount('Account No: 001235\n'+csv,'001235').csv).toBe(csv);
  const columns='Date,Description,Debit,Credit,Account Number\n2026-10-29,UAT,,25.00,1235';
  expect(verifyStatementAccount(columns,'1235').accountNumber).toBe('1235');
  expect(()=>verifyStatementAccount(columns+'\n2026-10-29,UAT,,5.00,3450','1235')).toThrow('Wrong account uploaded');
  expect(()=>verifyStatementAccount(columns+'\n2026-10-29,UAT,,5.00,','1235')).toThrow('Every statement row');
});
