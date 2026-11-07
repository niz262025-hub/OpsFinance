// Controlled network-latency fixture, not a live website or browser benchmark.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { performance } = require('node:perf_hooks');
const { createHash } = require('node:crypto');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
const baselinePath = process.argv[2] || path.join(root, 'docs/uat-evidence/access-baseline-a66fee14.ts.txt');
const currentPath = path.join(root, 'lib/auth/myops-server.ts');
const session = { version: 1, sessionId: 'fixture-session', userRef: 'fixture-ref', userId: 'fixture-user', businessId: 'fixture-business', accessToken: 'fixture-token', expiresAt: Date.now() + 60000 };
const user = { id: session.userId };
const latencyMs = { central: 120, mapping: 180, identity: 140, membership: 100 };
const delay = (value, ms) => new Promise(resolve => setTimeout(() => resolve(value), ms));
process.env.SUPABASE_URL = 'https://benchmark.invalid';
process.env.SUPABASE_ANON_KEY = 'fixture-public';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'fixture-admin';
async function run(source) {
  const calls = { central: 0, mapping: 0, identity: 0, membership: 0 };
  const query = (kind, data) => {
    const q = { select: () => q, eq: () => q, maybeSingle: () => { calls[kind]++; return delay({ data, error: null }, latencyMs[kind]); } };
    return q;
  };
  const admin = { from: () => query('mapping', { supabase_user_id: session.userId, business_id: session.businessId }) };
  const client = { from: table => { if (table !== 'business_members') throw new Error('Unexpected business data query'); return query('membership', { business_id: session.businessId }); }, auth: { getUser: () => { calls.identity++; return delay({ data: { user }, error: null }, latencyMs.identity); } } };
  const dependencies = {
    '@supabase/supabase-js': { createClient: (_url, key) => key === 'fixture-admin' ? admin : client },
    'next/headers': { cookies: async () => ({ get: () => ({ value: 'fixture-cookie' }) }) },
    './myops-session': { MYOPS_COOKIE: 'fixture', openSession: () => session, ssoConfig: () => ({ secret: 'fixture', transport: {} }) },
    './myops-transport': { checkMyopsEntitlement: () => { calls.central++; return delay(undefined, latencyMs.central); } },
    './myops-broker': { myopsBrokerHeaders: () => ({}) },
    './myops-performance': { measureMyopsPhase: async (_phase, operation) => operation() },
    './myops-trial-client': { installFinanceTrialClient: () => {} },
  };
  const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const module = { exports: {} };
  const load = name => { if (!(name in dependencies)) throw new Error(`Unexpected dependency ${name}`); return dependencies[name]; };
  vm.runInThisContext(`(function(require,module,exports){${output}\n})`)(load, module, module.exports);
  const start = performance.now();
  const result = await module.exports.verifiedMyopsClient();
  const durationMs = performance.now() - start;
  if (Object.values(calls).some(value => value !== 1)) throw new Error('Access checks changed');
  const snapshot = JSON.stringify({ userId: result.user.id, businessId: result.client.myopsBusinessId, session: result.session, calls });
  return { durationMs, hash: createHash('sha256').update(snapshot).digest('hex') };
}
async function sample(file) {
  const source = fs.readFileSync(file, 'utf8');
  const times = []; let hash;
  for (let i = 0; i < 7; i++) { const result = await run(source); if (hash && hash !== result.hash) throw new Error('Result changed'); hash = result.hash; if (i >= 2) times.push(result.durationMs); }
  times.sort((a,b) => a-b);
  return { medianMs: Number(times[2].toFixed(3)), samplesMs: times.map(n => Number(n.toFixed(3))), resultSha256: hash };
}
(async () => {
  const before = await sample(baselinePath), after = await sample(currentPath);
  if (before.resultSha256 !== after.resultSha256) throw new Error('Before/after result mismatch');
  console.log(JSON.stringify({ fixture: 'simulated read-only access-check latency; no real network', latencyMs, warmups: 2, timedSamples: 5, before, after }, null, 2));
})().catch(error => { console.error(error.message); process.exitCode = 1; });
