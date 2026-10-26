import React,{StrictMode} from 'react';
import {cleanup,render,screen,waitFor} from '@testing-library/react';
import {afterEach,describe,expect,it,vi} from 'vitest';
import LaunchPage from '../app/launch/page';
afterEach(()=>{cleanup();vi.unstubAllGlobals();window.history.replaceState(null,'','/');});
describe('MYOPS fragment handoff',()=>{
 it('removes the fragment before a single POST, including React StrictMode',async()=>{
  window.history.replaceState(null,'',`/launch#t=${'t'.repeat(43)}`);
  const request=vi.fn().mockImplementation(async()=>{expect(window.location.hash).toBe('');return {ok:false};});vi.stubGlobal('fetch',request);
  render(<StrictMode><LaunchPage/></StrictMode>);
  await waitFor(()=>expect(screen.getByRole('status').textContent).toMatch(/could not be verified/i));
  expect(request).toHaveBeenCalledTimes(1);
  expect(request.mock.calls[0][1]).toMatchObject({method:'POST',credentials:'same-origin',body:JSON.stringify({ticket:'t'.repeat(43)})});
 });
 it('rejects invalid or extra fragment fields without redeeming',async()=>{
  window.history.replaceState(null,'','/launch#t=invalid&user_id=attacker');const request=vi.fn();vi.stubGlobal('fetch',request);
  render(<LaunchPage/>);expect(window.location.hash).toBe('');expect(screen.getByRole('status').textContent).toMatch(/invalid/i);expect(request).not.toHaveBeenCalled();
 });
});
