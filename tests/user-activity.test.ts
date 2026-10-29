// @vitest-environment node
import {describe, expect, it, vi} from 'vitest';
import {trackUserActivity} from '../lib/auth/user-activity';

describe('user activity reporting', () => {
  it('ignores hidden and synthetic events, throttles trusted activity, and removes listeners', async () => {
    const listeners = new Map<string, EventListener>();
    const target = {visibilityState:'visible', addEventListener:vi.fn((name, fn)=>listeners.set(name,fn)), removeEventListener:vi.fn()};
    let now = 0;
    const send = vi.fn().mockResolvedValue(undefined);
    const stop = trackUserActivity(target as unknown as Document,send,()=>now);
    expect(send).not.toHaveBeenCalled(); // no heartbeat on mount
    listeners.get('pointerdown')!({isTrusted:false} as Event);
    target.visibilityState='hidden';listeners.get('keydown')!({isTrusted:true} as Event);
    expect(send).not.toHaveBeenCalled();
    target.visibilityState='visible';listeners.get('pointerdown')!({isTrusted:true} as Event);
    await new Promise(resolve=>setImmediate(resolve));
    listeners.get('keydown')!({isTrusted:true} as Event);
    expect(send).toHaveBeenCalledTimes(1);
    now=30001;listeners.get('wheel')!({isTrusted:true} as Event);
    expect(send).toHaveBeenCalledTimes(2);
    stop();expect(target.removeEventListener).toHaveBeenCalledTimes(4);
  });
});
