import React from 'react';
import {cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
import {afterEach,expect,it,vi} from 'vitest';
import {UploadWorkflow} from '../components/upload-workflow';
afterEach(()=>{cleanup();vi.unstubAllGlobals();});
it('rejects unsupported binary files before trying to read or send them',async()=>{
  const fetch=vi.fn().mockResolvedValue({ok:true,json:async()=>({accounts:[]})});vi.stubGlobal('fetch',fetch);
  render(<UploadWorkflow businessId="business-1"/>);
  const file={name:'UAT-invoice.pdf',size:20,text:vi.fn()};
  fireEvent.change(screen.getByLabelText('Upload a bank statement'),{target:{files:[file]}});
  await screen.findByText(/CSV and TXT statements only/);
  expect(file.text).not.toHaveBeenCalled();
  expect(fetch.mock.calls.some(call=>call[0]==='/api/upload')).toBe(false);
});
it('invalidates an old preview when the source text changes',async()=>{
  vi.stubGlobal('fetch',vi.fn(async(url)=>({ok:true,json:async()=>String(url).startsWith('/api/accounts')
    ? {accounts:[{id:'a1',code:'4000',name:'UAT Revenue'}]}
    : String(url).startsWith('/api/financial-accounts') ? {financialAccounts:[{id:'bank1',account_code:'BANK1',name:'Bank One',status:'ACTIVE',account_id:'ledger1'}]}
    : {statementId:'s1',rows:[{id:'r1',date:'2026-10-29',description:'UAT',amount:'10.00',direction:'CREDIT'}]}})));
  render(<UploadWorkflow businessId="business-1"/>);
  await screen.findByRole('option',{name:'4000 - UAT Revenue'});
  await screen.findByRole('option',{name:'BANK1 - Bank One'});
  fireEvent.change(screen.getByLabelText('Bank or financial account'),{target:{value:'bank1'}});
  fireEvent.change(screen.getByLabelText('Posting account'),{target:{value:'a1'}});
  fireEvent.change(screen.getByLabelText('Preview content'),{target:{value:'Date,Amount\n2026-10-29,10'}});
  fireEvent.click(screen.getByRole('button',{name:'Parse & review'}));
  await screen.findByText('Preview loaded 1 statement rows.');
  await waitFor(()=>expect((screen.getByRole('button',{name:'Approve and post'}) as HTMLButtonElement).disabled).toBe(false));
  fireEvent.change(screen.getByLabelText('Preview content'),{target:{value:'changed input'}});
  expect((screen.getByRole('button',{name:'Approve and post'}) as HTMLButtonElement).disabled).toBe(true);
});

it('requires an explicit eligible account, sends the selected second account, and invalidates preview on account change',async()=>{
  const fetch=vi.fn(async(url)=>({ok:true,json:async()=>String(url).startsWith('/api/accounts')
    ? {accounts:[{id:'a1',code:'4000',name:'UAT Revenue'}]}
    : String(url).startsWith('/api/financial-accounts') ? {financialAccounts:[
      {id:'bank1',account_code:'BANK1',name:'Bank One',status:'ACTIVE',account_id:'ledger1'},
      {id:'bank2',account_code:'BANK2',name:'Bank Two',status:'ACTIVE',account_id:'ledger2'},
      {id:'inactive',account_code:'OLD',name:'Inactive',status:'INACTIVE',account_id:'ledger3'},
      {id:'unmapped',account_code:'RAW',name:'Unmapped',status:'ACTIVE',account_id:null},
    ]} : {statementId:'s2',rows:[{id:'r2',date:'2026-10-29',description:'UAT',amount:'10.00',direction:'CREDIT'}]}}));
  vi.stubGlobal('fetch',fetch);
  render(<UploadWorkflow businessId="business-1"/>);
  await screen.findByRole('option',{name:'BANK2 - Bank Two'});
  expect(screen.queryByRole('option',{name:'OLD - Inactive'})).toBeNull();
  expect(screen.queryByRole('option',{name:'RAW - Unmapped'})).toBeNull();
  fireEvent.change(screen.getByLabelText('Preview content'),{target:{value:'Date,Amount\n2026-10-29,10'}});
  expect((screen.getByRole('button',{name:'Parse & review'}) as HTMLButtonElement).disabled).toBe(true);
  expect((screen.getByLabelText('Upload a bank statement') as HTMLInputElement).disabled).toBe(true);
  fireEvent.change(screen.getByLabelText('Bank or financial account'),{target:{value:'bank2'}});
  fireEvent.change(screen.getByLabelText('Posting account'),{target:{value:'a1'}});
  fireEvent.click(screen.getByRole('button',{name:'Parse & review'}));
  await screen.findByText('Preview loaded 1 statement rows.');
  const preview=fetch.mock.calls.find(call=>call[0]==='/api/upload');
  expect(JSON.parse((preview as any)[1].body).financialAccountId).toBe('bank2');
  await waitFor(()=>expect((screen.getByRole('button',{name:'Approve and post'}) as HTMLButtonElement).disabled).toBe(false));
  fireEvent.change(screen.getByLabelText('Bank or financial account'),{target:{value:'bank1'}});
  expect((screen.getByRole('button',{name:'Approve and post'}) as HTMLButtonElement).disabled).toBe(true);
  expect(screen.queryByText('Imported rows')).toBeNull();
});

it('shows an import-cancelled popup and prevents approval after server account mismatch',async()=>{
  vi.stubGlobal('fetch',vi.fn(async(url)=>({ok:!String(url).includes('/api/upload'),json:async()=>String(url).startsWith('/api/accounts')
    ? {accounts:[]}
    : String(url).startsWith('/api/financial-accounts') ? {financialAccounts:[{id:'bank1',account_code:'B1',name:'Bank One',status:'ACTIVE',account_id:'ledger1'}]}
    : {error:'Wrong account uploaded. The statement account number does not match the selected account. Import cancelled.'}})));
  render(<UploadWorkflow businessId="business-1"/>);
  await screen.findByRole('option',{name:'B1 - Bank One'});
  fireEvent.change(screen.getByLabelText('Bank or financial account'),{target:{value:'bank1'}});
  fireEvent.change(screen.getByLabelText('Preview content'),{target:{value:'Account Number,3450'}});
  fireEvent.click(screen.getByRole('button',{name:'Parse & review'}));
  await screen.findByRole('alertdialog',{name:'Import cancelled'});
  expect((screen.getByRole('button',{name:'Approve and post'}) as HTMLButtonElement).disabled).toBe(true);
  fireEvent.click(screen.getByRole('button',{name:'Close'}));
  expect(screen.queryByRole('alertdialog')).toBeNull();
});
