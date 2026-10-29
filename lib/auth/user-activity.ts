// Only trusted visible interactions extend inactivity; timers never send activity.
export function trackUserActivity(target: Document, send: () => Promise<unknown>, now = Date.now, onIdle?: () => void) {
  const idleMs = 15 * 60 * 1000;
  let lastInteraction = now();
  let lastSent = -Infinity;
  let pending = false;
  let ended = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const events = ['pointerdown', 'keydown', 'wheel', 'input'];
  const checkIdle = () => {
    if (!onIdle || ended) return;
    clearTimeout(timer);
    const remaining = idleMs - (now() - lastInteraction);
    if (remaining <= 0) {
      ended = true;
      onIdle();
    } else timer = setTimeout(checkIdle, remaining);
  };
  const onVisibility = () => {
    if (target.visibilityState === 'visible') checkIdle();
  };
  const onActivity = (event: Event) => {
    if (ended || !event.isTrusted || target.visibilityState !== 'visible') return;
    // A suspended tab must not revive its expired timer with the first new click.
    if (onIdle && now() - lastInteraction >= idleMs) { checkIdle(); return; }
    lastInteraction = now();
    checkIdle();
    if (pending || now() - lastSent < 30000) return;
    lastSent = now();
    pending = true;
    void send().catch(() => undefined).finally(() => { pending = false; });
  };
  events.forEach(name => target.addEventListener(name, onActivity, {passive:true}));
  if (onIdle) {
    target.addEventListener('visibilitychange', onVisibility);
    checkIdle();
  }
  return () => {
    ended = true;
    clearTimeout(timer);
    events.forEach(name => target.removeEventListener(name, onActivity));
    if (onIdle) target.removeEventListener('visibilitychange', onVisibility);
  };
}
