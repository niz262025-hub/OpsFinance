import React from 'react';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {cleanup,render,screen,fireEvent,waitFor} from '@testing-library/react';
import {LanguageSwitcher} from '../components/language-switcher';
import {FinancialAccountsWorkflow} from '../components/financial-accounts-workflow';
import {SUPPORTED_LOCALES,persistLocale,getStoredLocale,getMissingTranslationKeys,getNavigationGroups} from '../lib/i18n';
import {workflowTranslations,workflowText} from '../lib/workflow-translations';
beforeEach(()=>{localStorage.clear();persistLocale('en');});
afterEach(()=>{cleanup();vi.restoreAllMocks();vi.unstubAllGlobals();persistLocale('en');});
it('every workflow message and navigation group has four complete locale values',()=>{
 expect(getMissingTranslationKeys()).toEqual([]);
 expect(Object.keys(workflowTranslations).length).toBeGreaterThan(180);
 for(const [source,values] of Object.entries(workflowTranslations))for(const locale of SUPPORTED_LOCALES){expect(values[locale]?.trim(),`${locale}: ${source}`).toBeTruthy();}
 expect(getNavigationGroups('ms')[1].title).toBe('Transaksi');
 expect(workflowText('ta','Customer-entered Name')).toBe('Customer-entered Name');
});
it('switches the form immediately through all four languages without translating entered bank data or API values',async()=>{
 const fetchMock=vi.fn(async(_url:unknown,init?:RequestInit)=>({ok:true,json:async()=>init?.method==='POST'?{financialAccount:{id:'new',name:'Customer Raw Name'}}:{accounts:[],financialAccounts:[]}}));
 vi.stubGlobal('fetch',fetchMock);
 render(<><LanguageSwitcher/><FinancialAccountsWorkflow businessId="biz"/></>);
 const picker=screen.getByRole('combobox',{name:'Select language'});
 const name=screen.getByLabelText('Name'),type=screen.getByLabelText('Type'),status=screen.getByLabelText('Status');
 for(const [label,value] of Object.entries({'Name':'Customer Raw Name','Bank name':'Raw Bank','Company / account holder name':'Raw Company','Account number':'001234','Code':'RAW-BANK'}))fireEvent.change(screen.getByLabelText(label),{target:{value}});
 for(const locale of SUPPORTED_LOCALES){
  fireEvent.change(picker,{target:{value:locale}});
  await screen.findByRole('heading',{level:1,name:workflowText(locale,'Financial Accounts')});
  expect((name as HTMLInputElement).value).toBe('Customer Raw Name');
  expect((type as HTMLSelectElement).value).toBe('BANK');expect((status as HTMLSelectElement).value).toBe('ACTIVE');
  expect(document.documentElement.lang).toBe(locale);expect(getStoredLocale()).toBe(locale);
 }
 await waitFor(()=>expect(screen.getByRole('button',{name:workflowText('ta','+ Create Account')}).hasAttribute('disabled')).toBe(false));
 fireEvent.click(screen.getByRole('button',{name:workflowText('ta','+ Create Account')}));
 await waitFor(()=>expect(fetchMock.mock.calls.some(([,init])=>init?.method==='POST')).toBe(true));
 const body=JSON.parse(String(fetchMock.mock.calls.find(([,init])=>init?.method==='POST')![1]?.body));
 expect(body).toMatchObject({name:'Customer Raw Name',bankName:'Raw Bank',companyName:'Raw Company',accountNumber:'001234',type:'BANK',status:'ACTIVE',currency:'MYR',accountId:null});
});
it('retains a usable language selection when browser storage is blocked',()=>{
 render(<LanguageSwitcher/>);
 const picker=screen.getByRole('combobox',{name:'Select language'});
 vi.spyOn(Storage.prototype,'setItem').mockImplementation(()=>{throw Error('blocked');});
 fireEvent.change(picker,{target:{value:'zh-CN'}});
 expect(getStoredLocale()).toBe('zh-CN');expect(document.documentElement.lang).toBe('zh-CN');
 expect((picker as HTMLSelectElement).value).toBe('zh-CN');
});
