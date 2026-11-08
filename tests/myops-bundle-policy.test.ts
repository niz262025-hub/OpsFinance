import {describe,it,expect} from 'vitest';
import {MYOPS_BUNDLE_PLANS} from '../packages/subscriptions';
describe('MYOPS central price metadata',()=>{
 it('offers only the owner-selected trial, first100, two-app and all-app packages',()=>{
  expect(Object.keys(MYOPS_BUNDLE_PLANS)).toEqual(['FREE_TRIAL','FOUNDERS_LIFETIME','TWO_APPS','ALL_APPS']);
  expect(MYOPS_BUNDLE_PLANS.FOUNDERS_LIFETIME).toMatchObject({monthlyPrice:null,oneTimePrice:'29.00'});
  expect(MYOPS_BUNDLE_PLANS.TWO_APPS).toMatchObject({monthlyPrice:'49.00',selectedApps:2});
  expect(MYOPS_BUNDLE_PLANS.ALL_APPS.monthlyPrice).toBe('79.00');
  for(const plan of Object.values(MYOPS_BUNDLE_PLANS)){expect(plan.trialDays).toBe(7);expect(plan.includedApps).toEqual(['OpsFinance','OpsFlow','OpsPS','OpsHR']);}
 });
});
