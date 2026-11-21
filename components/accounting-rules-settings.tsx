"use client";

import {useFinanceLocale} from './use-finance-locale';

export type AccountingRulesSettingsProps = {
  businessId?: string | null;
  businessContextError?: string | null;
};

export function AccountingRulesSettings({ businessId, businessContextError }: AccountingRulesSettingsProps) {
  const {t:w}=useFinanceLocale();
  if (!businessId) {
    return (
      <main style={{ minHeight: '100vh', background: '#f8fafc', color: '#0f172a', fontFamily: 'Arial, sans-serif', padding: '1.5rem 1rem 2.5rem', overflowX: 'hidden' }}>
        <div style={{ maxWidth: 900, margin: '0 auto', background: '#fff', border: '1px solid #e2e8f0', borderRadius: 18, padding: '1.5rem' }}>
          <p style={{ margin: 0, color: '#475569', letterSpacing: '0.08em', fontSize: 12, fontWeight: 700, textTransform: 'uppercase' }}>{w("Settings")}</p>
          <h1 style={{ margin: '0.35rem 0 0', fontSize: 'clamp(2rem, 4vw, 2.5rem)' }}>{w("Accounting Rules")}</h1>
          <p style={{ margin: '0.75rem 0 0', color: '#475569' }}>{w("No active business is available for this user.")}</p>
          <p style={{ margin: '0.5rem 0 0', color: '#475569' }}>{businessContextError ?? w("No active business is available for this user.")}</p>
        </div>
      </main>
    );
  }

  return (
    <main style={{ minHeight: '100vh', background: '#f8fafc', color: '#0f172a', fontFamily: 'Arial, sans-serif', padding: '1.5rem 1rem 2.5rem', overflowX: 'hidden' }}>
      <div style={{ maxWidth: 900, margin: '0 auto', background: '#fff', border: '1px solid #e2e8f0', borderRadius: 18, padding: '1.5rem' }}>
        <p style={{ margin: 0, color: '#475569', letterSpacing: '0.08em', fontSize: 12, fontWeight: 700, textTransform: 'uppercase' }}>{w("Settings")}</p>
        <h1 style={{ margin: '0.35rem 0 0', fontSize: 'clamp(2rem, 4vw, 2.5rem)' }}>{w("Accounting Rules")}</h1>
        <p style={{ margin: '0.75rem 0 0', color: '#475569' }}>{w("Accounting rules are not available yet.")}</p>
        {businessContextError ? <p style={{ margin: '0.5rem 0 0', color: '#475569' }}>{businessContextError}</p> : null}
      </div>
    </main>
  );
}
