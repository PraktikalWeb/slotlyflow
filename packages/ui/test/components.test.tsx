import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { Button, FormFeedback, FormField, IconButton, Input } from '../src/index';

describe('shared UI primitives', () => {
  it('renders button variants with safe native-button defaults', () => {
    const html = renderToStaticMarkup(<Button variant="accent" size="large" block loading>Continue</Button>);

    expect(html).toContain('type="button"');
    expect(html).toContain('sf-button--accent');
    expect(html).toContain('sf-button--large');
    expect(html).toContain('sf-button--block');
    expect(html).toContain('aria-busy="true"');
    expect(html).toContain('disabled');
  });

  it('connects form labels and supporting state to the supplied control IDs', () => {
    const html = renderToStaticMarkup(
      <FormField
        controlId="email"
        label="Email address"
        help="Use your work email."
        helpId="email-help"
        error="Enter a valid email."
        errorId="email-error"
      >
        <Input id="email" type="email" hasTrailingAction aria-describedby="email-help email-error" />
      </FormField>,
    );

    expect(html).toContain('for="email"');
    expect(html).toContain('id="email-help"');
    expect(html).toContain('id="email-error"');
    expect(html).toContain('role="alert"');
    expect(html).toContain('sf-input--with-trailing-action');
  });

  it('keeps feedback and icon-only controls accessible', () => {
    const html = renderToStaticMarkup(
      <>
        <FormFeedback tone="error"><p>Try again.</p></FormFeedback>
        <IconButton label="Show password"><span aria-hidden="true">icon</span></IconButton>
      </>,
    );

    expect(html).toContain('sf-form-feedback--error');
    expect(html).toContain('role="alert"');
    expect(html).toContain('aria-label="Show password"');
    expect(html).toContain('type="button"');
  });
});
