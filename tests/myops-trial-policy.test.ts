// @vitest-environment node
import {expect,it} from 'vitest';
import {assertFinanceFeature,financeAccessFromEntitlement,financeTrialLimit} from '../lib/auth/myops-trial-policy';
const now=Date.parse('2026-11-02T00:00:00Z');
const trial={id:'11111111-1111-4111-8111-111111111111',expires_at:'2026-11-03T00:00:00Z',policy_version:1};
const active={entitled:true,session_active:true,access_mode:'trial',trial};
it('requires an explicit rollout gate and fresh signed trial metadata',()=>{
 expect(()=>financeAccessFromEntitlement(active,false,now)).toThrow();
 expect(financeAccessFromEntitlement(active,true,now).mode).toBe('trial');
 for(const patch of [{expires_at:'2026-11-02T00:00:00Z'},{expires_at:'invalid'},{id:'other'},{policy_version:2}])expect(()=>financeAccessFromEntitlement({...active,trial:{...trial,...patch}},true,now)).toThrow();
 for(const patch of [{entitled:false},{session_active:false},{access_mode:'unknown'},{trial:null}])expect(()=>financeAccessFromEntitlement({...active,...patch},true,now)).toThrow();
});
it('keeps paid access and applies the approved feature limits only to trials',()=>{
 const access=financeAccessFromEntitlement(active,true,now);
 expect(['transactions','bank_statements','documents'].map(x=>financeTrialLimit(x as any))).toEqual([30,2,5]);
 for(const feature of ['reconciliation_commit','report_export'] as const){
  expect(()=>assertFinanceFeature(access,feature)).toThrow(/Upgrade in MYOPS/);
  expect(()=>assertFinanceFeature({mode:'paid'},feature)).not.toThrow();
 }
 expect(financeAccessFromEntitlement({entitled:true,session_active:true},false,now)).toEqual({mode:'paid'});
});
