import {describe,expect,it} from 'vitest';
import {getReconciliationSnapshot} from '../lib/accounting/server-operations';
describe('reconciliation hosted query errors',()=>{
  for (const failed of ['bank_transactions','transactions','reconciliation_matches']) {
    it(`does not turn ${failed} failures into an empty successful snapshot`,async()=>{
      const client={from:(table:string)=>{
        const result=table===failed?{data:null,error:{message:'permission denied'}}:{data:table==='bank_statements'?[{id:'s1'}]:[],error:null};
        const query:any=Promise.resolve(result);
        for(const name of ['select','eq','in','order'])query[name]=()=>query;
        return query;
      }};
      await expect(getReconciliationSnapshot(client,'business-1')).rejects.toThrow('permission denied');
    });
  }
});
