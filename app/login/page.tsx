import Link from 'next/link';

export default function LoginPage() {
  return (
    <main style={{ maxWidth: 520, margin: '5rem auto', padding: 24 }}>
      <h1>Sign in with MYOPS</h1>
      <p>Open OpsFinance from your MYOPS applications. You do not need a separate OpsFinance password.</p>
      <Link href="https://myops.com.my/">Go to MYOPS</Link>
    </main>
  );
}
