import {createHash,createPrivateKey,createPublicKey} from 'node:crypto';
try {
 if(process.env.VERCEL_ENV!=='production') throw Error('production target required');
 const finance=process.env.RELEASE_APP==='finance';
 const url=finance?(process.env.SUPABASE_URL||process.env.NEXT_PUBLIC_SUPABASE_URL):process.env.VITE_SUPABASE_URL;
 const expected=finance?'https://ozkjsihuovzpujuabupa.supabase.co':'https://uhuukcztdifvpjuopdea.supabase.co';
 if(url!==expected) throw Error('database target mismatch');
 const key=finance?process.env.SUPABASE_SERVICE_ROLE_KEY:process.env.MYOPS_SERVICE_ROLE_KEY;
 if(!key) throw Error('missing server credential');
 if(!key.startsWith('sb_secret_')){
  let payload;try{payload=JSON.parse(Buffer.from(key.split('.')[1]||'','base64url').toString());}catch{throw Error('server credential is neither secret API key nor valid JWT');}
  if(payload.role!=='service_role') throw Error('server credential is not service_role');
  if(payload.ref!=='ozkjsihuovzpujuabupa') throw Error('server credential belongs to another project');
  if(!Number.isFinite(payload.exp)||payload.exp*1000<=Date.now()) throw Error('server credential has expired');
 }
 const headers={apikey:key,Authorization:'Bearer '+key};
 if(finance){
  const publicKey=createPublicKey(createPrivateKey(process.env.MYOPS_APP_PRIVATE_KEY)).export({type:'spki',format:'pem'}).toString();
  const hash=v=>createHash('sha256').update(v).digest('hex');
  if(hash(publicKey)!==process.env.RELEASE_SIGNING_SHA256) throw Error('signing key mismatch');
  if(hash(process.env.MYOPS_DATA_BROKER_KEY||'')!==process.env.RELEASE_BROKER_SHA256) throw Error('broker credential mismatch');
  headers['x-myops-broker-key']=process.env.MYOPS_DATA_BROKER_KEY;
 }
 const path=finance?'/rest/v1/myops_identity_links?select=enabled&enabled=eq.true&limit=1':'/rest/v1/myops_app_clients?select=enabled&app_id=eq.opsfinance';
 const response=await fetch(url+path,{headers,redirect:'error'});
 if(!response.ok){
  const body=await response.json().catch(()=>({}));const code=/^[A-Z0-9_]{1,16}$/.test(body.code||'')?body.code:'unclassified';
  const category=body.message==='Invalid API key'?'invalid API key':body.message==='MYOPS application access required.'?'broker denied':body.message?.includes('permission denied')?'database permission denied':body.message?.includes('JWT')?'JWT rejected':'upstream rejection';
  throw Error('server credential HTTP '+response.status+' / '+code+' / '+category);
 }
 const rows=await response.json();
 if(!Array.isArray(rows)||!rows.length||!rows[0].enabled) throw Error('enabled identity/client unavailable');
 console.log('RELEASE_CREDENTIAL_CHECK PASS '+(finance?'Finance signing, broker, server credential':'MYOPS server credential'));
}catch(error){console.error('RELEASE_CREDENTIAL_CHECK FAIL: '+error.message);process.exit(1);}
