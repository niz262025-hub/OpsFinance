'use client';

import React from 'react';
import { getMyopsHomeUrl } from '../lib/auth/navigation';

// Retain the export for existing callers; returning to MYOPS does not sign out.
export function LogoutButton() {
  return <a href={getMyopsHomeUrl()} style={{ marginTop: '0.75rem' }}>Back to MYOPS</a>;
}
