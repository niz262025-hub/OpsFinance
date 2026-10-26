import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

import { MYOPS_COOKIE, openSession, ssoConfig, ssoEnabled } from './lib/auth/myops-session';
import { checkMyopsEntitlement } from './lib/auth/myops-transport';

import { isPreviewAuthBypassEnabled } from './lib/auth/navigation';

const PROTECTED_PATH_PREFIXES = ['/dashboard', '/accounts', '/transactions', '/upload', '/reconciliation', '/reports', '/settings'];

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request: { headers: request.headers } });

  const pathname = request.nextUrl.pathname;
  if (ssoEnabled()) {
    const protectedPath=PROTECTED_PATH_PREFIXES.some(prefix=>pathname===prefix||pathname.startsWith(`${prefix}/`));
    const protectedApi=pathname.startsWith('/api/') && !pathname.startsWith('/api/myops/');
    if (['/login','/register','/auth/callback','/','/opsfinance'].includes(pathname)) {
      return NextResponse.redirect(new URL('/dashboard',process.env.MYOPS_ORIGIN??'https://www.myops.com.my'));
    }
    if(protectedPath||protectedApi) {
      try {
        const {secret,transport}=ssoConfig();
        const session=openSession(request.cookies.get(MYOPS_COOKIE)?.value,secret);
        if(!session)throw new Error();
        await checkMyopsEntitlement(transport,session.sessionId,false);
      }catch{
        if(protectedApi)return NextResponse.json({error:'MYOPS authentication required.'},{status:401,headers:{'Cache-Control':'no-store'}});
        return NextResponse.redirect(new URL('/login',process.env.MYOPS_ORIGIN??'https://www.myops.com.my'));
      }
    }
    response.headers.set('Cache-Control','private, no-store');
    response.headers.set('Referrer-Policy','no-referrer');
    return response;
  }
  const previewBypassEnabled = isPreviewAuthBypassEnabled();

  if (previewBypassEnabled) {
    if (pathname === '/' || pathname === '/login' || pathname === '/register' || pathname === '/opsfinance') {
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }

    return response;
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    const pathname = request.nextUrl.pathname;
    if (PROTECTED_PATH_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))) {
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

  const isProtectedPath = PROTECTED_PATH_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
  const redirectWithCookies = (path: string) => {
    const redirected = NextResponse.redirect(new URL(path, request.url));
    response.cookies.getAll().forEach((cookie) => redirected.cookies.set(cookie));
    return redirected;
  };

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if ((pathname === '/login' || pathname === '/register') && user) {
    return redirectWithCookies('/dashboard');
  }
  if (pathname === '/opsfinance') {
    return redirectWithCookies(user ? '/dashboard' : '/login');
  }
  if (isProtectedPath && !user) {
    return redirectWithCookies('/login');
  }

  return response;
}

export const config = {
  runtime: 'nodejs',
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
