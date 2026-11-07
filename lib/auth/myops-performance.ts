// Preview diagnostics contain phase names and durations only, never identity or session data.
type AccessPhase = 'middleware_entitlement' | 'central_entitlement' | 'identity_mapping' | 'local_identity' | 'local_membership' | 'business_context';

export async function measureMyopsPhase<T>(phase: AccessPhase, run: () => PromiseLike<T>): Promise<T> {
  if (process.env.VERCEL_ENV !== 'preview') return await run();
  const start = Date.now();
  try {
    return await run();
  } finally {
    console.info('myops_performance', JSON.stringify({ phase, durationMs: Date.now() - start }));
  }
}
