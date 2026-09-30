export type SessionLike = { user?: { id?: string } | null } | null;

export const PROTECTED_ROUTE_PREFIXES = [
  '/dashboard',
  '/accounts',
  '/transactions',
  '/upload',
  '/reconciliation',
  '/reports',
  '/settings',
] as const;

export const PUBLIC_AUTH_PATHS = ['/login', '/register', '/auth/callback'] as const;

export function getSupabasePublicConfig(
  input: Partial<Record<string, string | undefined>> = process.env,
): { isConfigured: boolean; missing: string[]; config: Record<string, string | undefined> } {
  const required = ['NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY'];
  const config = { ...input };
  const missing = required.filter((key) => !config[key] || String(config[key]).trim() === '');

  return {
    isConfigured: missing.length === 0,
    missing,
    config,
  };
}

export function isProtectedRoute(pathname: string): boolean {
  if (PUBLIC_AUTH_PATHS.includes(pathname as (typeof PUBLIC_AUTH_PATHS)[number])) {
    return false;
  }

  return PROTECTED_ROUTE_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

export function shouldRedirectToLogin(pathname: string, session: SessionLike): boolean {
  return isProtectedRoute(pathname) && !session?.user?.id;
}

export function normalizeAuthError(error?: { message?: string } | null): string {
  if (!error?.message) {
    return 'Authentication failed. Please try again or check your email confirmation.';
  }

  const msg = error.message.toLowerCase();
  if (msg.includes('email') && msg.includes('confirm')) {
    return 'Please confirm your email before signing in.';
  }

  if (msg.includes('invalid login') || msg.includes('credentials') || msg.includes('password')) {
    return 'The email or password is incorrect. Please try again.';
  }

  if (msg.includes('email')) {
    return 'Please check your email and try again.';
  }

  if (msg.includes('jwt') || msg.includes('session') || msg.includes('token')) {
    return 'Your session is invalid or expired. Please sign in again.';
  }

  return 'Authentication failed. Please try again.';
}
