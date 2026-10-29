import React from 'react';
import {cleanup,render,screen} from '@testing-library/react';
import {afterEach,expect,it,vi} from 'vitest';
import {ReconciliationWorkflow} from '../components/reconciliation-workflow';
afterEach(()=>{cleanup();vi.unstubAllGlobals();});
it('uses saved opening balance and actual matches, keeps partial rows unresolved, and scopes rows to the current statement',async()=>{
  vi.stubGlobal('fetch',vi.fn().mockResolvedValue({ok:true,json:async()=>({
    statements:[{id:'statement-1',opening_balance:'10.00'}],
    bankTransactions:[{id:'bank-1',bank_statement_id:'statement-1',reference:'UAT partial',amount:'100.00',status:'PARTIAL'},
      {id:'bank-other',bank_statement_id:'statement-2',reference:'Other statement',amount:'500.00',status:'IMPORTED'}],
    bookTransactions:[{id:'book-1',amount:'200.00'}],
    matches:[{bank_transaction_id:'bank-1',matched_amount:'40.00'}],summary:{matched:1},
  })}));
  render(<ReconciliationWorkflow businessId="business-1"/>);
  expect(await screen.findByText('RM60.00')).toBeTruthy();
  expect(screen.getByText('RM10.00')).toBeTruthy();
  expect(screen.queryByText('RM12500.00')).toBeNull();
  expect(screen.queryByText(/Other statement/)).toBeNull();
  expect((screen.getByRole('button',{name:'Complete reconciliation'}) as HTMLButtonElement).disabled).toBe(true);
});
