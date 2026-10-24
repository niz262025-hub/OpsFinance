import { render, screen } from '@testing-library/react';
import * as React from 'react';
import { createElement } from 'react';

// The test JSX transform expects React in scope for the rendered page.
import { describe, expect, it } from 'vitest';
import LoginPage from '../app/login/page';

describe('MYOPS-only login entry', () => {
  it('provides a link to the central MYOPS login', () => {
    render(createElement(LoginPage));
    const link = screen.getByRole('link', { name: 'Go to MYOPS' });
    expect(link.getAttribute('href')).toBe('https://myops.com.my/');
  });
  it('does not expose a second email/password login form', () => {
    render(createElement(LoginPage));
    expect(screen.queryByRole('textbox')).toBeNull();
    expect(screen.queryByRole('button', { name: /sign in/i })).toBeNull();
  });
});
