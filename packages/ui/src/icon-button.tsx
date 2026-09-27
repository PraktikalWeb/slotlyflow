import type { ButtonHTMLAttributes } from 'react';

import { classNames } from './class-names';

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  readonly label: string;
  readonly size?: 'medium' | 'large';
}

export function IconButton({ label, size = 'medium', className, type = 'button', ...props }: IconButtonProps) {
  return (
    <button
      {...props}
      type={type}
      className={classNames('sf-icon-button', `sf-icon-button--${size}`, className)}
      aria-label={label}
    />
  );
}
