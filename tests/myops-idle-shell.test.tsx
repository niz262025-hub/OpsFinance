import React from 'react';
import {act,cleanup,render,screen} from '@testing-library/react';
import {afterEach,expect,it,vi} from 'vitest';
vi.mock('next/navigation',()=>({usePathname:()=>'/dashboard',useRouter:()=>({push:vi.fn()})}));
vi.mock('next/link',()=>({default:({children,href,...props}:any)=><a href={href} {...props}>{children}</a>}));
vi.mock('next/image',()=>({default:({src,alt}:any)=><img src={src} alt={alt}/> }));
vi.mock('../lib/supabase/client',()=>({getSupabaseBrowserClient:()=>null}));
import {AuthenticatedAppShell} from '../components/authenticated-shell';
afterEach(()=>{cleanup();vi.useRealTimers();vi.unstubAllEnvs();vi.unstubAllGlobals();});

it('hides dashboard content and starts same-origin cleanup after 15 minutes without activity',async()=>{
  vi.useFakeTimers();vi.stubEnv('NEXT_PUBLIC_MYOPS_SSO_ENABLED','true');
  // Leave the request pending to verify sensitive UI disappears before networking completes.
  const request=vi.fn(()=>new Promise(()=>{}));vi.stubGlobal('fetch',request);
  render(<AuthenticatedAppShell><div>Private finance data</div></AuthenticatedAppShell>);
  await act(async()=>{vi.advanceTimersByTime(899999);});
  expect(screen.queryByText('Private finance data')).not.toBeNull();expect(request).not.toHaveBeenCalled();
  await act(async()=>{vi.advanceTimersByTime(1);});
  expect(screen.queryByText('Private finance data')).toBeNull();
  expect(screen.getByRole('status').textContent).toContain('Session expired');
  expect(request).toHaveBeenCalledWith('/api/myops/logout',expect.objectContaining({method:'POST',credentials:'same-origin',body:'{"reason":"inactivity"}'}));
});
