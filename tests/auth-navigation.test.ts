import { describe, expect, it, vi } from 'vitest';

import { navigateToDashboard } from '../lib/auth/navigation';

describe('auth navigation', () => {
  it('uses a full document navigation to the dashboard', () => {
    const assign = vi.fn();

    navigateToDashboard(assign);

    expect(assign).toHaveBeenCalledOnce();
    expect(assign).toHaveBeenCalledWith('/dashboard');
  });
});
