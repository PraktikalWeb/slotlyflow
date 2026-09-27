import type { HTMLAttributes } from 'react';

import { classNames } from './class-names';

export interface FormFeedbackProps extends HTMLAttributes<HTMLDivElement> {
  readonly tone?: 'warning' | 'error' | 'success' | 'info';
}

export function FormFeedback({ tone = 'warning', className, role = 'alert', ...props }: FormFeedbackProps) {
  return <div {...props} className={classNames('sf-form-feedback', `sf-form-feedback--${tone}`, className)} role={role} />;
}
