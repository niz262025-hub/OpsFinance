import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'OpsFinance',
  description: 'OpsFinance accounting platform',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
