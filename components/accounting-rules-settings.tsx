"use client";

export type AccountingRulesSettingsProps = {
  businessId?: string | null;
  businessContextError?: string | null;
};

export function AccountingRulesSettings({ businessId, businessContextError }: AccountingRulesSettingsProps) {
  if (!businessId) {
    return (
      <main style={{ minHeight: '100vh', background: '#f8fafc', color: '#0f172a', fontFamily: 'Arial, sans-serif', padding: '1.5rem 1rem 2.5rem', overflowX: 'hidden' }}>
        <div style={{ maxWidth: 900, margin: '0 auto', background: '#fff', border: '1px solid #e2e8f0', borderRadius: 18, padding: '1.5rem' }}>
          <p style={{ margin: 0, color: '#475569', letterSpacing: '0.08em', fontSize: 12, fontWeight: 700, textTransform: 'uppercase' }}>Settings</p>
          <h1 style={{ margin: '0.35rem 0 0', fontSize: 'clamp(2rem, 4vw, 2.5rem)' }}>Accounting Rules</h1>
          <p style={{ margin: '0.75rem 0 0', color: '#475569' }}>NO_BUSINESS</p>
          <p style={{ margin: '0.5rem 0 0', color: '#475569' }}>{businessContextError ?? 'BUSINESS_CONTEXT_UNAVAILABLE'}</p>
        </div>
      </main>
    );
  }

  return (
    <main style={{ minHeight: '100vh', background: '#f8fafc', color: '#0f172a', fontFamily: 'Arial, sans-serif', padding: '1.5rem 1rem 2.5rem', overflowX: 'hidden' }}>
      <div style={{ maxWidth: 900, margin: '0 auto', background: '#fff', border: '1px solid #e2e8f0', borderRadius: 18, padding: '1.5rem' }}>
        <p style={{ margin: 0, color: '#475569', letterSpacing: '0.08em', fontSize: 12, fontWeight: 700, textTransform: 'uppercase' }}>Settings</p>
        <h1 style={{ margin: '0.35rem 0 0', fontSize: 'clamp(2rem, 4vw, 2.5rem)' }}>Accounting Rules</h1>
        <p style={{ margin: '0.75rem 0 0', color: '#475569' }}>Accounting rules are not yet repository-backed for this business.</p>
        <p style={{ margin: '0.5rem 0 0', color: '#475569' }}>PERSISTENCE_NOT_AVAILABLE</p>
        {businessContextError ? <p style={{ margin: '0.5rem 0 0', color: '#475569' }}>{businessContextError}</p> : null}
      </div>
    </main>
  );
}
