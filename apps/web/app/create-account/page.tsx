import Image from 'next/image';
import * as React from 'react';

import { CreateAccountForm } from './create-account-form';

export default function CreateAccountPage() {
  return (
    <main className="create-account-page">
      <div className="create-account-mobile-fragments" aria-hidden="true">
        <span className="create-mobile-fragment create-mobile-fragment--aqua" />
        <span className="create-mobile-fragment create-mobile-fragment--violet" />
        <span className="create-mobile-fragment create-mobile-fragment--lime" />
        <span className="create-mobile-fragment create-mobile-fragment--coral" />
      </div>

      <section className="create-account-brand" aria-label="SlotlyFlow">
        <Image className="create-account-logo" src="/slotlyflow-logo-transparent.png" alt="SlotlyFlow" width={1086} height={362} priority />
        <div className="create-account-artwork-region" aria-hidden="true">
          <div className="create-account-pattern">
            <span className="create-pattern-tile create-pattern-tile--aqua-cap" />
            <span className="create-pattern-tile create-pattern-tile--green-square" />
            <span className="create-pattern-tile create-pattern-tile--lime-arch" />
            <span className="create-pattern-tile create-pattern-tile--violet-circle" />
            <span className="create-pattern-tile create-pattern-tile--coral-bar" />
            <span className="create-pattern-tile create-pattern-tile--green-quarter" />
            <span className="create-pattern-tile create-pattern-tile--aqua-circle" />
            <span className="create-pattern-tile create-pattern-tile--lime-bar" />
            <span className="create-pattern-tile create-pattern-tile--violet-arch" />
            <span className="create-pattern-tile create-pattern-tile--coral-square" />
            <span className="create-pattern-tile create-pattern-tile--green-cap" />
            <span className="create-pattern-tile create-pattern-tile--lime-circle" />
          </div>
        </div>
        <div className="create-account-brand-copy">
          <p>Start every customer conversation with a clear next step.</p>
          <span aria-hidden="true" className="brand-rule" />
        </div>
      </section>

      <section className="create-account-workspace" aria-labelledby="create-account-title">
        <div className="create-account-content">
          <div className="create-account-heading">
            <h1 id="create-account-title">Create account</h1>
            <p>Set up your SlotlyFlow account to get started.</p>
          </div>
          <CreateAccountForm />
        </div>
      </section>
    </main>
  );
}
