'use client';
import React from 'react';
import {useFinanceLocale} from './use-finance-locale';
export function SubscriptionSettings(){
 const {t:w}=useFinanceLocale();
 return <main className="opsfinance-workflow-panel" style={{padding:'2rem'}}>
  <h1>{w('Subscription managed in MYOPS')}</h1>
  <p>{w('Manage your plan, trial and payments in your MYOPS account.')}</p>
  <a className="opsfinance-primary-button" href="https://www.myops.com.my/account">{w('Open MYOPS account')}</a>
 </main>;
}
