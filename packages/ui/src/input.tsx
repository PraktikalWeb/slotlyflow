import type { InputHTMLAttributes } from 'react';

import { classNames } from './class-names';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  readonly hasTrailingAction?: boolean;
}

export function Input({ hasTrailingAction = false, className, ...props }: InputProps) {
  return <input {...props} className={classNames('sf-input', hasTrailingAction && 'sf-input--with-trailing-action', className)} />;
}
