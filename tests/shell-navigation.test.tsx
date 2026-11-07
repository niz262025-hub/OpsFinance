import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
vi.mock('next/navigation', () => ({ usePathname: () => '/reports/general-ledger', useRouter: () => ({ push: vi.fn() }) }));
vi.mock('next/link', () => ({ default: ({ children, href, ...props }: any) => <a href={href} {...props}>{children}</a> }));
vi.mock('next/image', () => ({ default: ({ src, alt }: any) => <img src={src} alt={alt} /> }));
vi.mock('../lib/supabase/client', () => ({ getSupabaseBrowserClient: () => null }));
import { AuthenticatedAppShell } from '../components/authenticated-shell';
afterEach(cleanup);

it('keeps the current page visible within a collapsible menu and preserves accounting routes', () => {
  render(<AuthenticatedAppShell businessName="Registered company"><div>Financial records</div></AuthenticatedAppShell>);
  expect(screen.queryByText(/Authenticated workspace/i)).toBeNull();
  expect(screen.getAllByText('Registered company').length).toBeGreaterThan(0);
  const ledger = screen.getByRole('link', { name: 'General Ledger' });
  expect(ledger.getAttribute('href')).toBe('/reports/general-ledger');
  expect(ledger.closest('details')?.open).toBe(true);
  const accounting = screen.getByText('Accounting').closest('details');
  expect(accounting?.open).toBe(false);
  // Keep all route entries in the DOM so native details can disclose them by keyboard.
  expect(document.querySelector('a[href="/accounts/chart"]')).not.toBeNull();
});
it('mobile navigation closes when a route is selected', () => {
  render(<AuthenticatedAppShell><div>Records</div></AuthenticatedAppShell>);
  const toggle = screen.getByRole('button', { name: 'Toggle navigation' });
  fireEvent.click(toggle);
  expect(toggle.getAttribute('aria-expanded')).toBe('true');
  const mobile = document.getElementById('opsfinance-mobile-nav')!;
  fireEvent.click(mobile.querySelector('a[href="/dashboard"]')!);
  expect(toggle.getAttribute('aria-expanded')).toBe('false');
  expect(document.getElementById('opsfinance-mobile-nav')).toBeNull();
});
