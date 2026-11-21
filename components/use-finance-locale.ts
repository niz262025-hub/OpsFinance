'use client';
import {useSyncExternalStore} from 'react';
import {getStoredLocale,persistLocale,type Locale} from '../lib/i18n';
import {workflowText} from '../lib/workflow-translations';
const subscribe=(notify:()=>void)=>{
  window.addEventListener('opsfinance:localechange',notify);
  window.addEventListener('storage',notify);
  return ()=>{window.removeEventListener('opsfinance:localechange',notify);window.removeEventListener('storage',notify);};
};
const serverLocale=():Locale=>'en';
export function useFinanceLocale(){
 const locale=useSyncExternalStore(subscribe,getStoredLocale,serverLocale);
 return {locale,setLocale:persistLocale,t:(source:string)=>workflowText(locale,source),
 formatMoney:(value:string|number|undefined)=>{
  const number=Number(value??0),safe=Number.isFinite(number)?number:0;
  return locale==='en'?`RM${safe.toFixed(2)}`:new Intl.NumberFormat(locale,{style:'currency',currency:'MYR',minimumFractionDigits:2,maximumFractionDigits:2}).format(safe);
 }};
}
