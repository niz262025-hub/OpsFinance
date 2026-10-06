'use client';

type ReconciliationWorkflowProps = {
  businessId?: string;
  businessContextError?: string | null;
};

export function ReconciliationWorkflow({ businessId, businessContextError }: ReconciliationWorkflowProps) {
  if (!businessId) {
    return (
      <main style={{ minHeight: '100vh', background: '#f8fafc', color: '#0f172a', fontFamily: 'Arial, sans-serif', padding: '2rem 1rem' }}>
        <div style={{ maxWidth: 900, margin: '0 auto', background: '#fff', border: '1px solid #e2e8f0', borderRadius: 18, padding: '1.5rem' }}>
          <h1 style={{ marginTop: 0 }}>Bank Reconciliation</h1>
          <p style={{ marginBottom: 0, color: '#475569' }}>{businessContextError ?? 'No active business is available for reconciliation.'}</p>
        </div>
      </main>
    );
  }

  return (
    <main style={{ minHeight: '100vh', background: '#f8fafc', color: '#0f172a', fontFamily: 'Arial, sans-serif', padding: '2rem 1rem' }}>
      <div style={{ maxWidth: 960, margin: '0 auto', background: '#fff', border: '1px solid #e2e8f0', borderRadius: 18, padding: '1.5rem' }}>
        <h1 style={{ marginTop: 0 }}>Bank Reconciliation</h1>
        <p style={{ marginBottom: 0 }}>Reconciliation workflows are scoped to the active business: {businessId}.</p>
      </div>
    </main>
  );
}
