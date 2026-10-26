'use client';
import React, { useEffect, useRef, useState } from 'react';
export default function LaunchPage() {
  const started = useRef(false);
  const [message,setMessage] = useState('Verifying your MYOPS access…');
  useEffect(() => {
    if (started.current) return;
    started.current=true;
    const fragment = new URLSearchParams(window.location.hash.slice(1));
    window.history.replaceState(null,'','/launch');
    const ticket = fragment.get('t');
    if (fragment.size !== 1 || !ticket || !/^[A-Za-z0-9_-]{43}$/.test(ticket)) {
      setMessage('This launch link is invalid. Open OpsFinance again from MYOPS.'); return;
    }
    void fetch('/api/myops/launch',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({ticket})})
      .then(response => { if (!response.ok) throw new Error(); window.location.replace('/dashboard'); })
      .catch(() => setMessage('Access could not be verified. Open OpsFinance again from MYOPS.'));
  },[]);
  return <main><h1>Opening OpsFinance</h1><p role="status">{message}</p></main>;
}
