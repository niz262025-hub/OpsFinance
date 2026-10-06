import Link from 'next/link';

import { AuthenticatedAppShell } from '../../components/authenticated-shell';

export default function AccountsPage() {
  return (
    <AuthenticatedAppShell>
      <main style={{ minHeight: '100vh', background: '#f8fafc', color: '#0f172a', fontFamily: 'Arial, sans-serif' }}>
        <div style={{ maxWidth: 900, margin: '0 auto', background: '#fff', border: '1px solid #e2e8f0', borderRadius: 18, padding: '1.5rem' }}>
          <p style={{ margin: 0, color: '#475569', letterSpacing: '0.08em', fontSize: 12, fontWeight: 700, textTransform: 'uppercase' }}>OpsFinance</p>
          <h1 style={{ margin: '0.35rem 0 0', fontSize: '2rem' }}>Accounts</h1>
          <ul style={{ listStyle: 'none', padding: 0, display: 'grid', gap: '0.85rem', marginTop: '1.25rem' }}>
            <li>
              <Link href="/accounts/financial" style={{ fontWeight: 700, color: '#0f172a' }}>Financial Accounts</Link>
            </li>
            <li>
              <Link href="/accounts/chart" style={{ fontWeight: 700, color: '#0f172a' }}>Chart of Accounts</Link>
            </li>
          </ul>
        </div>
      </main>
    </AuthenticatedAppShell>
  );
}
