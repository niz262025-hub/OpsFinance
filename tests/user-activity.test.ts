// @vitest-environment node
import {afterEach, describe, expect, it, vi} from 'vitest';
import {trackUserActivity} from '../lib/auth/user-activity';

describe('user activity reporting', () => {
  afterEach(() => vi.useRealTimers());
  it('expires at 15 minutes without sending a heartbeat and cancels on cleanup', () => {
    vi.useFakeTimers();
    const target={visibilityState:'visible',addEventListener:vi.fn(),removeEventListener:vi.fn()};
    const send=vi.fn().mockResolvedValue(undefined);const idle=vi.fn();
    const stop=trackUserActivity(target as unknown as Document,send,Date.now,idle);
    vi.advanceTimersByTime(899999);expect(idle).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);expect(idle).toHaveBeenCalledTimes(1);
    expect(send).not.toHaveBeenCalled();stop();
    const cancelled=vi.fn();const stopAgain=trackUserActivity(target as unknown as Document,send,Date.now,cancelled);
    stopAgain();vi.advanceTimersByTime(900000);expect(cancelled).not.toHaveBeenCalled();
  });
  it('extends the local deadline only for trusted visible activity', async () => {
    vi.useFakeTimers();
    const listeners=new Map<string,EventListener>();
    const target={visibilityState:'visible',addEventListener:vi.fn((name,fn)=>listeners.set(name,fn)),removeEventListener:vi.fn()};
    const send=vi.fn().mockResolvedValue(undefined);const idle=vi.fn();
    const stop=trackUserActivity(target as unknown as Document,send,Date.now,idle);
    await vi.advanceTimersByTimeAsync(600000);
    listeners.get('keydown')!({isTrusted:true} as Event);
    await vi.advanceTimersByTimeAsync(600000);
    listeners.get('pointerdown')!({isTrusted:false} as Event);
    await vi.advanceTimersByTimeAsync(300000);
    expect(idle).toHaveBeenCalledTimes(1);expect(send).toHaveBeenCalledTimes(1);stop();
  });
  it('expires a resumed tab before accepting a late click', () => {
    vi.useFakeTimers();let now=0;
    const listeners=new Map<string,EventListener>();
    const target={visibilityState:'visible',addEventListener:vi.fn((name,fn)=>listeners.set(name,fn)),removeEventListener:vi.fn()};
    const send=vi.fn().mockResolvedValue(undefined);const idle=vi.fn();
    const stop=trackUserActivity(target as unknown as Document,send,()=>now,idle);
    now=900001;listeners.get('pointerdown')!({isTrusted:true} as Event);
    expect(idle).toHaveBeenCalledTimes(1);expect(send).not.toHaveBeenCalled();stop();
  });
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
