// Event driven only: no heartbeat, background polling or synthetic events.
export function trackUserActivity(target: Document, send: () => Promise<unknown>, now = Date.now) {
  let lastSent = -Infinity;
  let pending = false;
  const events = ['pointerdown', 'keydown', 'wheel', 'input'];
  const onActivity = (event: Event) => {
    if (!event.isTrusted || target.visibilityState !== 'visible' || pending || now() - lastSent < 30000) return;
    lastSent = now();
    pending = true;
    void send().catch(() => undefined).finally(() => { pending = false; });
  };
  events.forEach(name => target.addEventListener(name, onActivity, {passive:true}));
  return () => events.forEach(name => target.removeEventListener(name, onActivity));
}
