import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { createElement } from 'react';
import * as React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { getSupabaseBrowserClientMock, navigateToDashboardMock, signInWithPasswordMock } = vi.hoisted(() => ({
  getSupabaseBrowserClientMock: vi.fn(),
  navigateToDashboardMock: vi.fn(),
  signInWithPasswordMock: vi.fn(),
}));

vi.mock('../lib/supabase/client', () => ({
  getSupabaseBrowserClient: getSupabaseBrowserClientMock,
}));

vi.mock('../lib/auth/navigation', () => ({
  navigateToDashboard: navigateToDashboardMock,
}));

import LoginPage from '../app/login/page';

describe('login flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('React', React);
    getSupabaseBrowserClientMock.mockReturnValue({
      auth: { signInWithPassword: signInWithPasswordMock },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  async function submitLogin() {
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'uat@example.test' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'test-only-password' } });
    fireEvent.submit(screen.getByRole('button', { name: 'Sign in' }).closest('form')!);
    await waitFor(() => expect(signInWithPasswordMock).toHaveBeenCalledOnce());
  }

  it('navigates deterministically after a successful session', async () => {
    signInWithPasswordMock.mockResolvedValue({ data: { session: { user: { id: 'test-user' } } }, error: null });
    render(createElement(LoginPage));

    await submitLogin();

    expect(navigateToDashboardMock).toHaveBeenCalledOnce();
  });

  it('does not navigate after an authentication error', async () => {
    signInWithPasswordMock.mockResolvedValue({
      data: { session: null },
      error: { message: 'Invalid login credentials' },
    });
    render(createElement(LoginPage));

    await submitLogin();

    expect(navigateToDashboardMock).not.toHaveBeenCalled();
    expect(await screen.findByText(/email or password is incorrect/i)).toBeTruthy();
  });

  it('does not navigate when no session is returned', async () => {
    signInWithPasswordMock.mockResolvedValue({ data: { session: null }, error: null });
    render(createElement(LoginPage));

    await submitLogin();

    expect(navigateToDashboardMock).not.toHaveBeenCalled();
    expect(await screen.findByText(/no active session was returned/i)).toBeTruthy();
  });
});
