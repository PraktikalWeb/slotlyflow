import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import SignInPage from './page';

describe('SignInPage', () => {
  it('renders labelled email/password controls and the intended future auth routes', () => {
    const markup = renderToStaticMarkup(<SignInPage />);
    expect(markup).toContain('Sign in');
    expect(markup).toContain('for="sign-in-email"');
    expect(markup).toContain('for="sign-in-password"');
    expect(markup).toContain('Continue with Google');
    expect(markup).toContain('href="/forgot-password"');
    expect(markup).toContain('href="/create-account"');
    expect(markup).toContain('slotlyflow-logo-transparent.png');
    expect(markup).toContain('google-logo.png');
    expect(markup).toContain('aria-label="Show password"');
    expect(markup).toContain('<svg');
    expect(markup).not.toContain('>Show<');
  });
});
