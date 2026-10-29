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
    : {statementId:'s1',rows:[{id:'r1',date:'2026-10-29',description:'UAT',amount:'10.00',direction:'CREDIT'}]}})));
  render(<UploadWorkflow businessId="business-1"/>);
  await screen.findByRole('option',{name:'4000 - UAT Revenue'});
  fireEvent.change(screen.getByLabelText('Posting account'),{target:{value:'a1'}});
  fireEvent.change(screen.getByLabelText('Preview content'),{target:{value:'Date,Amount\n2026-10-29,10'}});
  fireEvent.click(screen.getByRole('button',{name:'Parse & review'}));
  await screen.findByText('Preview loaded 1 statement rows.');
  await waitFor(()=>expect((screen.getByRole('button',{name:'Approve and post'}) as HTMLButtonElement).disabled).toBe(false));
  fireEvent.change(screen.getByLabelText('Preview content'),{target:{value:'changed input'}});
  expect((screen.getByRole('button',{name:'Approve and post'}) as HTMLButtonElement).disabled).toBe(true);
});
