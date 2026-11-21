// @vitest-environment node
import {describe,it,expect} from 'vitest';
import {loadReportRows} from '../lib/report-source';
import {currentMonth,localDate,validReportPeriod} from '../lib/calendar';
function fixture(count:number,failAfter=Infinity,foreign=false){
 const calls:any[]=[];
 const client={from:(table:string)=>{
  let columns='';const filters:any[]=[];const orders:string[]=[];
  const q={select:(value:string)=>{columns=value;return q;},eq:(key:string,value:string)=>{filters.push([key,value]);return q;},order:(key:string)=>{orders.push(key);return q;},range:async(from:number,to:number)=>{
   calls.push({table,columns,filters,orders,from,to});
   if(table==='journal_entries'&&from>=failAfter)return {data:null,error:{message:'Journal page unavailable'}};
   const total=table==='accounts'?1:count;
   return {error:null,data:Array.from({length:Math.max(0,Math.min(to+1,total)-from)},(_,i)=>({id:`${table}-${i+from}`,business_id:foreign?'other':'biz',...(table==='journal_entries'?{status:'POSTED'}:{})}))};
  }};return q;
 }};
 return {client,calls};
}
describe('complete tenant-scoped report source',()=>{
 it('fetches all 1001 journals and required columns in stable pages',async()=>{
  const {client,calls}=fixture(1001);const rows=await loadReportRows(client,'biz');
  expect(rows.journals).toHaveLength(1001);expect(rows.accounts).toHaveLength(1);
  const pages=calls.filter(c=>c.table==='journal_entries');
  expect(pages.map(c=>c.from)).toEqual([0,500,1000,1001]);
  for(const p of pages){expect(p.columns).toContain('business_id');expect(p.filters).toEqual([['business_id','biz'],['status','POSTED']]);expect(p.orders).toEqual(['journal_date','id']);}
 });
 it('rejects a failed later page and foreign rows instead of returning incomplete totals',async()=>{
  await expect(loadReportRows(fixture(501,500).client,'biz')).rejects.toThrow('Journal page unavailable');
  await expect(loadReportRows(fixture(1,Infinity,true).client,'biz')).rejects.toThrow(/outside this business/);
 });
 it('uses the current local calendar month and rejects reversed or invalid periods',()=>{
  expect(localDate(new Date(2026,10,8))).toBe('2026-11-08');
  expect(currentMonth(new Date(2026,10,8))).toEqual({from:'2026-11-01',to:'2026-11-30'});
  expect(currentMonth(new Date(2028,1,2)).to).toBe('2028-02-29');
  expect(validReportPeriod('2026-11-01','2026-11-30')).toBe(true);
  for(const range of [['2026-11-30','2026-11-01'],['2026-02-30','2026-03-01'],['','2026-11-01']])expect(validReportPeriod(...range as [string,string])).toBe(false);
 });
});
