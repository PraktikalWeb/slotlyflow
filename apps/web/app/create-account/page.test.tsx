import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import CreateAccountPage from './page';

describe('CreateAccountPage', () => {
  it('renders the accessible registration fields, actions, branding, and Sign In route', () => {
    const markup = renderToStaticMarkup(<CreateAccountPage />);

    expect(markup).toContain('Create account');
    expect(markup).toContain('for="create-account-email"');
    expect(markup).toContain('for="create-account-password"');
    expect(markup).toContain('for="create-account-confirm-password"');
    expect(markup).toContain('name="email"');
    expect(markup).toContain('name="password"');
    expect(markup).toContain('name="confirmPassword"');
    expect(markup).toContain('minLength="12"');
    expect(markup).toContain('maxLength="256"');
    expect(markup).toContain('Continue with Google');
    expect(markup).toContain('href="/sign-in"');
    expect(markup).toContain('slotlyflow-logo-transparent.png');
    expect(markup).toContain('google-logo.png');
    expect(markup).toContain('aria-label="Show password"');
    expect(markup).toContain('aria-label="Show confirm password"');
    expect(markup.match(/type="button"/g)).toHaveLength(3);
    expect(markup).toContain('aria-hidden="true"');
    expect(markup).not.toContain('localStorage');
  });
});
