import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

import { isPreviewAuthBypassEnabled } from './lib/auth/navigation';
import { verifyMyopsAppSession } from './lib/auth/myops-app-client';

const PROTECTED_PATH_PREFIXES = ['/dashboard', '/accounts', '/transactions', '/upload', '/reconciliation', '/reports', '/settings'];
const PUBLIC_API_PATHS = new Set(['/api/myops/redeem', '/api/preview/data', '/api/payments/checkout', '/api/payments/webhook']);
const MYOPS_SESSION_COOKIE = '__Host-opsfinance-myops-session';

function isPathUnder(pathname: string, prefix: string) {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request: { headers: request.headers } });

  const pathname = request.nextUrl.pathname;
  const previewBypassEnabled = isPreviewAuthBypassEnabled();
  // Production must not silently fall back to the old standalone login if the
  // SSO switch/configuration was omitted. Tests and local development opt in explicitly.
  const myopsSsoRequired = process.env.NODE_ENV === 'production' || process.env.MYOPS_SSO_ENABLED === 'true';

  // The local bypass is only for the isolated demo-data endpoint. It must never
  // skip authentication for accounting pages or real API routes.
  if (previewBypassEnabled && pathname === '/api/preview/data') {
    return response;
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    const isProtectedPath = PROTECTED_PATH_PREFIXES.some((prefix) => isPathUnder(pathname, prefix)) || pathname === '/opsfinance';
    const isProtectedApi = pathname.startsWith('/api/') && !PUBLIC_API_PATHS.has(pathname);
    if (isProtectedPath || isProtectedApi) {
      if (pathname.startsWith('/api/')) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: { 'Cache-Control': 'no-store' } });
      return NextResponse.redirect(new URL('/login', request.url));
    }
    return response;
  }

  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet: Array<{ name: string; value: string; options?: CookieOptions }>) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request: { headers: request.headers } });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  const isProtectedPath = PROTECTED_PATH_PREFIXES.some((prefix) => isPathUnder(pathname, prefix)) || pathname === '/opsfinance';
  const isProtectedApi = pathname.startsWith('/api/') && !PUBLIC_API_PATHS.has(pathname);
  const isProtectedRequest = isProtectedPath || isProtectedApi;
  const redirectWithCookies = (path: string) => {
    const redirected = NextResponse.redirect(new URL(path, request.url));
    response.cookies.getAll().forEach((cookie) => redirected.cookies.set(cookie));
    return redirected;
  };

  const {
    data: { user },
  } = await supabase.auth.getUser();

  let myopsSessionValid = false;
  if (myopsSsoRequired && isProtectedRequest && user) {
    const sessionId = request.cookies.get(MYOPS_SESSION_COOKIE)?.value;
    if (sessionId) {
      // A fresh check gates every protected request. Mutations are marked sensitive
      // so MYOPS applies its immediate entitlement/revocation rules.
      myopsSessionValid = await verifyMyopsAppSession(
        sessionId,
        true,
        ['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method.toUpperCase()),
      );
    }
    if (!myopsSessionValid) {
      const denied = pathname.startsWith('/api/')
        ? NextResponse.json({ error: 'MYOPS session is not active' }, { status: 401, headers: { 'Cache-Control': 'no-store' } })
        : NextResponse.redirect(new URL('/login?reason=myops-session', request.url));
      denied.cookies.set(MYOPS_SESSION_COOKIE, '', { httpOnly: true, secure: true, sameSite: 'lax', path: '/', maxAge: 0 });
      return denied;
    }
  }

  if (myopsSsoRequired && pathname === '/register') {
    return redirectWithCookies('/login');
  }
  if (!myopsSsoRequired && (pathname === '/login' || pathname === '/register') && user) {
    return redirectWithCookies('/dashboard');
  }
  if (pathname === '/opsfinance') {
    return redirectWithCookies(user && (!myopsSsoRequired || myopsSessionValid) ? '/dashboard' : '/login');
  }
  if (isProtectedRequest && !user) {
    if (pathname.startsWith('/api/')) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: { 'Cache-Control': 'no-store' } });
    return redirectWithCookies('/login');
  }

  return response;
}

export const config = {
  runtime: 'nodejs',
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
