import { describe, expect, it } from 'vitest';
import { POST } from './route';

describe('MYOPS launch exchange authorization gate', () => {
  it('fails closed without redeeming a one-use ticket or setting a session', async () => {
    const response = await POST(new Request('https://opsfinance.example.com/api/myops/launch', {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: 'https://opsfinance.example.com' },
      body: JSON.stringify({ ticket: 'a'.repeat(43) }),
    }));
    expect(response.status).toBe(503);
    expect(response.headers.get('set-cookie')).toBeNull();
    expect(response.headers.get('cache-control')).toBe('no-store');
  });

  it('rejects cross-origin submissions and wrong content types', async () => {
    const crossOrigin = await POST(new Request('https://opsfinance.example.com/api/myops/launch', {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: 'https://evil.example.com' },
      body: '{}',
    }));
    expect(crossOrigin.status).toBe(403);
    const wrongType = await POST(new Request('https://opsfinance.example.com/api/myops/launch', {
      method: 'POST',
      headers: { 'content-type': 'text/plain' }, body: '{}',
    }));
    expect(wrongType.status).toBe(415);
  });
});
