import {createHash,createPrivateKey,createPublicKey} from 'node:crypto';
try {
 if(process.env.VERCEL_ENV!=='production') throw Error('production target required');
 const finance=process.env.RELEASE_APP==='finance';
 const url=finance?(process.env.SUPABASE_URL||process.env.NEXT_PUBLIC_SUPABASE_URL):process.env.VITE_SUPABASE_URL;
 const expected=finance?'https://ozkjsihuovzpujuabupa.supabase.co':'https://uhuukcztdifvpjuopdea.supabase.co';
 if(url!==expected) throw Error('database target mismatch');
 const key=finance?process.env.SUPABASE_SERVICE_ROLE_KEY:process.env.MYOPS_SERVICE_ROLE_KEY;
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
 if(!response.ok) throw Error('server credential rejected HTTP '+response.status);
 const rows=await response.json();
 if(!Array.isArray(rows)||!rows.length||!rows[0].enabled) throw Error('enabled identity/client unavailable');
 console.log('RELEASE_CREDENTIAL_CHECK PASS '+(finance?'Finance signing, broker, server credential':'MYOPS server credential'));
}catch(error){console.error('RELEASE_CREDENTIAL_CHECK FAIL: '+error.message);process.exit(1);}
