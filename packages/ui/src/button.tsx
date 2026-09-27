import type { ButtonHTMLAttributes } from 'react';

import { classNames } from './class-names';

export type ButtonVariant = 'primary' | 'secondary' | 'accent' | 'ghost' | 'danger';
export type ButtonSize = 'small' | 'medium' | 'large';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  readonly variant?: ButtonVariant;
  readonly size?: ButtonSize;
  readonly block?: boolean;
  readonly loading?: boolean;
}

export function Button({
  variant = 'primary',
  size = 'medium',
  block = false,
  loading = false,
  className,
  disabled,
  type = 'button',
  ...props
}: ButtonProps) {
  return (
    <button
      {...props}
      type={type}
      className={classNames('sf-button', `sf-button--${variant}`, `sf-button--${size}`, block && 'sf-button--block', className)}
      disabled={disabled === true || loading}
      aria-busy={loading || undefined}
      data-loading={loading || undefined}
    />
  );
}
