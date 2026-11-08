'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import React, { useEffect, useState } from 'react';

import {useFinanceLocale} from './use-finance-locale';
import { LanguageSwitcher } from './language-switcher';
import { trackUserActivity } from '../lib/auth/user-activity';

import { isPreviewAuthBypassEnabled } from '../lib/auth/navigation';
import { getTranslation, getNavigationGroups } from '../lib/i18n';
import { getSupabaseBrowserClient } from '../lib/supabase/client';

type AuthenticatedAppShellProps = {
  children: React.ReactNode;
  businessName?: string | null;
  userEmail?: string | null;
};

type NavItem = { href: string; label: string };

type NavGroup = {
  title: string;
  items: NavItem[];
};

function NavigationList({ onNavigate, locale }: { onNavigate?: () => void; locale: string }) {
  const pathname = usePathname();
  const navGroups = getNavigationGroups(locale);

  return (
    <nav aria-label="OpsFinance navigation" className="opsfinance-nav">
      {navGroups.map((group) => (
        <details key={group.title} className="opsfinance-nav-group" open={group.items.some((item) => pathname === item.href)}>
          <summary className="opsfinance-nav-label">{group.title}</summary>
          {group.items.map((item) => {
            const isActive = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href));
            return (
              <Link
                key={`${group.title}-${item.label}`}
                href={item.href}
                onClick={onNavigate}
                className={isActive ? 'opsfinance-nav-link active' : 'opsfinance-nav-link'}
              >
                {item.label}
              </Link>
            );
          })}
        </details>
      ))}
    </nav>
  );
}

export function AuthenticatedAppShell({ children, businessName, userEmail }: AuthenticatedAppShellProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [idleExpired, setIdleExpired] = useState(false);
  const {locale,setLocale}=useFinanceLocale();

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  useEffect(() => {
    if (typeof window !== 'undefined' && window.innerWidth > 900) {
      setMobileOpen(false);
    }
  }, [pathname]);

  useEffect(() => {
    if (process.env.NEXT_PUBLIC_MYOPS_SSO_ENABLED !== 'true') return;
    return trackUserActivity(document,
      () => fetch('/api/myops/activity', {method:'POST',credentials:'same-origin',cache:'no-store'}),
      Date.now,
      () => {
        setIdleExpired(true);
        void (async () => {
          try {
            const response = await fetch('/api/myops/logout', {method:'POST',credentials:'same-origin',
              headers:{'Content-Type':'application/json'},body:JSON.stringify({reason:'inactivity'}),
              signal:AbortSignal.timeout(10000)});
            if (!response.ok) throw new Error('Session cleanup unavailable.');
            const result = await response.json();
            window.location.replace(typeof result.next === 'string' ? result.next : '/login');
          } catch { window.location.replace('/login'); }
        })();
      });
  }, []);

  const signOut = async () => {
    if (process.env.NEXT_PUBLIC_MYOPS_SSO_ENABLED === 'true') {
      const response=await fetch('/api/myops/logout',{method:'POST',credentials:'same-origin'});
      if(response.ok) { const body=await response.json(); window.location.replace(body.next); }
      return;
    }

    const supabase = getSupabaseBrowserClient();
    if (supabase) {
      await supabase.auth.signOut();
    }
    router.push(isPreviewAuthBypassEnabled() ? '/dashboard' : '/login');
  };

  if (idleExpired) return <main role="status">{getTranslation(locale, 'logoutMessage')}</main>;

  return (
    <div className="opsfinance-app-shell">
      <aside className="opsfinance-sidebar">
        <div className="opsfinance-sidebar-header">
          <div className="opsfinance-sidebar-brand">
            <div className="opsfinance-brand-badge">
              <Image src="/favicon.svg" alt="MYOPS brand mark" width={18} height={18} />
            </div>
            <div className="opsfinance-brand-copy">
              <strong>MYOPS</strong>
              <span>{businessName ?? getTranslation(locale, 'myAccount')}</span>
            </div>
          </div>
        </div>

        <div className="opsfinance-business-card">
          <label>{getTranslation(locale, 'currentBusiness')}</label>
          <strong>{businessName ?? getTranslation(locale, 'noActiveBusiness')}</strong>
        </div>

        <NavigationList locale={locale} />

        {userEmail ? <div className="opsfinance-user-block">{userEmail}</div> : null}

      </aside>

      <div className="opsfinance-main-panel">
        <header className="opsfinance-topbar">
          <div className="opsfinance-topbar-left">
            <button
              type="button"
              className="opsfinance-mobile-toggle"
              onClick={() => setMobileOpen((value) => !value)}
              aria-expanded={mobileOpen}
              aria-controls="opsfinance-mobile-nav"
              aria-label={getTranslation(locale, 'toggleNavigation')}
            >
              ☰
            </button>
            <div className="opsfinance-topbar-copy">
              <strong>MYOPS</strong>
              <span>{businessName ?? getTranslation(locale, 'myAccount')}</span>
            </div>
          </div>

          <div className="opsfinance-topbar-meta">
            <LanguageSwitcher value={locale as any} onChange={(nextLocale) => setLocale(nextLocale)} />
            <div className="opsfinance-business-pill">{businessName ?? getTranslation(locale, 'noActiveBusiness')}</div>
            <button type="button" onClick={signOut} className="opsfinance-signout">
              {getTranslation(locale, 'backToMyOps')}
            </button>
          </div>
        </header>

        {mobileOpen ? (
          <div id="opsfinance-mobile-nav" style={{ padding: '1rem 1rem 0' }}>
            <div className="opsfinance-business-card" style={{ marginBottom: '0.75rem' }}>
              <label>{getTranslation(locale, 'currentBusiness')}</label>
              <strong>{businessName ?? getTranslation(locale, 'noActiveBusiness')}</strong>
            </div>
            <NavigationList locale={locale} onNavigate={() => setMobileOpen(false)} />
          </div>
        ) : null}

        <main className="opsfinance-content" style={{ overflowY: 'auto', overflowX: 'hidden' }}>{children}</main>
      </div>
    </div>
  );
}
