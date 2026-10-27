import {afterEach,expect,it,vi} from 'vitest';
import {myopsBrokerHeaders} from '../lib/auth/myops-broker';
afterEach(()=>vi.unstubAllEnvs());
it('uses only server configuration and rejects malformed broker credentials',()=>{
 vi.stubEnv('MYOPS_DATA_BROKER_KEY','');expect(myopsBrokerHeaders()).toEqual({});
 vi.stubEnv('MYOPS_DATA_BROKER_KEY','k'.repeat(48));expect(myopsBrokerHeaders()).toEqual({'x-myops-broker-key':'k'.repeat(48)});
 vi.stubEnv('MYOPS_DATA_BROKER_KEY','bad\nheader');expect(()=>myopsBrokerHeaders()).toThrow('Invalid server broker configuration.');
});
