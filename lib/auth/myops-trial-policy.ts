/** Server-owned policy derived only from MYOPS's signed entitlement response. */
export type FinanceTrialFeature = 'transactions' | 'bank_statements' | 'documents' | 'reconciliation_commit' | 'report_export';
export type FinanceAccess = { mode:'paid' } | { mode:'trial'; trialId:string; expiresAt:string; policyVersion:1 };
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export interface MyopsBundleEntitlement {
 entitled?: boolean;
 session_active?: boolean;
 access_mode?: 'paid' | 'trial' | string | null;
 trial?: { id?: string; expires_at?: string; policy_version?: number } | null;
 bundle?: { app?: string; monthly_price?: string; currency?: string; plan?: string } | null;
}

export function financeAccessFromEntitlement(value:unknown, trialReady:boolean, now=Date.now()):FinanceAccess {
 if(!value||typeof value!=='object')throw new Error('MYOPS access denied.');
 const data=value as Record<string,unknown>;
 if(data.entitled!==true||data.session_active!==true)throw new Error('MYOPS access denied.');
 if(data.access_mode==='paid'&&data.trial==null)return {mode:'paid'};
 // Existing signed paid contracts predate access_mode; never treat explicit trials as paid.
 if(data.access_mode==null&&data.trial==null)return {mode:'paid'};
 // Central MYOPS entitlement is the source of truth. A production app must not add
 // its own preview-only rollout gate on top of the signed trial grant.
 if(data.access_mode!=='trial')throw new Error('OpsFinance trial is not available yet. Manage your access in MYOPS.');
 const trial=data.trial as Record<string,unknown>|null;
 if(!trial||typeof trial.id!=='string'||!UUID.test(trial.id)||trial.policy_version!==1||typeof trial.expires_at!=='string'||!Number.isFinite(Date.parse(trial.expires_at))||Date.parse(trial.expires_at)<=now)throw new Error('MYOPS trial expired or unavailable.');
 return {mode:'trial',trialId:trial.id,expiresAt:trial.expires_at,policyVersion:1};
}

export function financeTrialLimit(feature:FinanceTrialFeature):number {
 switch(feature){case 'transactions':return 30;case 'bank_statements':return 2;case 'documents':return 5;default:return 0;}
}

export function assertFinanceFeature(access:FinanceAccess,feature:FinanceTrialFeature):void {
 if(access.mode==='trial'&&financeTrialLimit(feature)===0)throw new Error('Preview only during your trial. Upgrade in MYOPS to use this feature.');
}

export function resolveMyopsBundlePrice(entitlement: MyopsBundleEntitlement | null | undefined): { monthlyPrice: string; currency: string; app: string; plan: string } {
 const bundle = entitlement?.bundle as Record<string, unknown> | undefined;
 const monthlyPrice = typeof bundle?.monthly_price === 'string' && bundle.monthly_price.trim() ? bundle.monthly_price : '19.90';
 const currency = typeof bundle?.currency === 'string' && bundle.currency.trim() ? bundle.currency : 'MYR';
 const app = typeof bundle?.app === 'string' && bundle.app.trim() ? bundle.app : 'OpsFinance';
 const plan = typeof bundle?.plan === 'string' && bundle.plan.trim() ? bundle.plan : 'SINGLE_APP';
 return { monthlyPrice, currency, app, plan };
}
