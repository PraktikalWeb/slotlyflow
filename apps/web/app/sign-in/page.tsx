import Image from 'next/image';
import * as React from 'react';

import { SignInForm } from './sign-in-form';

export default function SignInPage() {
  return (
    <main className="sign-in-page">
      <div className="sign-in-mobile-fragments" aria-hidden="true">
        <span className="mobile-fragment mobile-fragment--aqua" />
        <span className="mobile-fragment mobile-fragment--violet" />
        <span className="mobile-fragment mobile-fragment--lime" />
        <span className="mobile-fragment mobile-fragment--coral" />
      </div>
      <section className="sign-in-brand" aria-label="SlotlyFlow">
        <Image className="sign-in-logo" src="/slotlyflow-logo-transparent.png" alt="SlotlyFlow" width={1086} height={362} priority />
        <div className="sign-in-artwork-region" aria-hidden="true">
          <div className="sign-in-pattern">
            <span className="pattern-tile pattern-tile--green-cap" />
            <span className="pattern-tile pattern-tile--lime-square" />
            <span className="pattern-tile pattern-tile--aqua-arch" />
            <span className="pattern-tile pattern-tile--violet-circle-top" />
            <span className="pattern-tile pattern-tile--coral-half" />
            <span className="pattern-tile pattern-tile--lime-quarter" />
            <span className="pattern-tile pattern-tile--green-square" />
            <span className="pattern-tile pattern-tile--coral-bar" />
            <span className="pattern-tile pattern-tile--aqua-circle" />
            <span className="pattern-tile pattern-tile--violet-bar" />
            <span className="pattern-tile pattern-tile--green-arch" />
            <span className="pattern-tile pattern-tile--lime-circle" />
            <span className="pattern-tile pattern-tile--coral-square" />
            <span className="pattern-tile pattern-tile--aqua-square" />
          </div>
        </div>
        <div className="brand-copy">
          <p>Keep every customer conversation moving.</p>
          <span aria-hidden="true" className="brand-rule" />
        </div>
      </section>
      <section className="sign-in-workspace" aria-labelledby="sign-in-title">
        <div className="sign-in-content">
          <div className="sign-in-heading">
            <h1 id="sign-in-title">Sign in</h1>
            <p>Manage your customer communication and automation in one place.</p>
          </div>
          <SignInForm />
        </div>
      </section>
    </main>
  );
}
