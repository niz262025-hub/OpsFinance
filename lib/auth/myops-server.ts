import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { MYOPS_COOKIE, openSession, ssoConfig, type AppSession } from './myops-session';
import { checkMyopsEntitlement, redeemMyopsTicket } from './myops-transport';
import { myopsBrokerHeaders } from './myops-broker';

function clients() {
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const adminKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key || !adminKey) throw new Error('SSO identity bridge is not configured.');
  return { url, key, admin: createClient(url, adminKey, { auth: { persistSession: false, autoRefreshToken: false },global:{headers:myopsBrokerHeaders()} }) };
}
async function mappedIdentity(userRef: string) {
  const { url, key, admin } = clients();
  const { data: mapping, error } = await admin.from('myops_identity_links')
    .select('supabase_user_id,business_id').eq('user_ref', userRef).eq('enabled',true).maybeSingle();
  if (error || !mapping) {
    if (process.env.VERCEL_ENV === 'preview') console.warn('myops_identity_lookup_unavailable',
      error?.message === 'Invalid API key' ? 'invalid_api_key' : error?.code === '42501' ? 'database_access_denied' : error ? 'upstream' : 'mapping_missing');
    throw new Error('No authorized identity mapping.');
  }
  return { url, key, admin, mapping };
}
export async function establishMyopsSession(ticket: string): Promise<AppSession> {
  const config = ssoConfig();
  const grant = await redeemMyopsTicket(config.transport, ticket);
  const { url, key, admin, mapping } = await mappedIdentity(grant.user_ref);
  const { data: identity, error: identityError } = await admin.auth.admin.getUserById(mapping.supabase_user_id);
  const user = identity.user;
  if (identityError || !user?.email || !user.email_confirmed_at) throw new Error('Mapped identity is unavailable.');
  // Admin generates a server-only one-time proof for the explicitly provisioned identity.
  // No email matching, account creation, browser OTP or service-role data client.
  const { data: link, error: linkError } = await admin.auth.admin.generateLink({ type:'magiclink', email:user.email });
  if (linkError || link.user?.id !== user.id || !link.properties?.hashed_token) throw new Error('Identity exchange failed.');
  const client = createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false},global:{headers:myopsBrokerHeaders()}});
  const { data, error } = await client.auth.verifyOtp({type:'magiclink',token_hash:link.properties.hashed_token});
  if (error || data.user?.id !== mapping.supabase_user_id || !data.session?.access_token || !data.session.expires_at) throw new Error('Identity exchange failed.');
  const { data: member, error: memberError } = await client.from('business_members').select('business_id')
    .eq('user_id',user.id).eq('business_id',mapping.business_id).maybeSingle();
  if (memberError || !member) throw new Error('Business access denied.');
  await checkMyopsEntitlement(config.transport,grant.session_id,true);
  return {version:1, sessionId:grant.session_id,userRef:grant.user_ref,userId:user.id,businessId:mapping.business_id,
    accessToken:data.session.access_token,expiresAt:Math.min(data.session.expires_at*1000,Date.now()+grant.max_session_seconds*1000)};
}
export async function verifiedMyopsClient(activity = false) {
  const config = ssoConfig();
  const session = openSession((await cookies()).get(MYOPS_COOKIE)?.value,config.secret);
  if (!session) throw new Error('MYOPS authentication required.');
  const [, { url,key,mapping }] = await Promise.all([
    checkMyopsEntitlement(config.transport,session.sessionId,activity),
    mappedIdentity(session.userRef),
  ]);
  if (mapping.supabase_user_id !== session.userId || mapping.business_id !== session.businessId) throw new Error('Identity mapping revoked.');
  const client = createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false},global:{headers:{...myopsBrokerHeaders(),Authorization:`Bearer ${session.accessToken}`}}});
  const [{ data, error }, { data: member,error: memberError }] = await Promise.all([
    client.auth.getUser(session.accessToken),
    client.from('business_members').select('business_id')
      .eq('user_id',session.userId).eq('business_id',session.businessId).maybeSingle(),
  ]);
  if (error || data.user?.id !== session.userId) throw new Error('Local identity is no longer valid.');
  if (memberError || !member) throw new Error('Business membership revoked.');
  // Existing server pages call auth.getUser() without passing a token.
  client.auth.getUser = async () => ({ data:{user:data.user},error:null });
  Object.defineProperty(client,'myopsBusinessId',{value:session.businessId});
  return { client,session,user:data.user };
}
