import type { ReactNode } from 'react';

export interface FormFieldProps {
  readonly children: ReactNode;
  readonly controlId: string;
  readonly label: ReactNode;
  readonly labelAccessory?: ReactNode;
  readonly help?: ReactNode;
  readonly helpId?: string;
  readonly error?: ReactNode;
  readonly errorId?: string;
}

export function FormField({
  children,
  controlId,
  label,
  labelAccessory,
  help,
  helpId,
  error,
  errorId,
}: FormFieldProps) {
  return (
    <div className="sf-form-field">
      {labelAccessory === undefined ? (
        <label className="sf-form-field__label" htmlFor={controlId}>{label}</label>
      ) : (
        <div className="sf-form-field__label-row">
          <label className="sf-form-field__label" htmlFor={controlId}>{label}</label>
          <span className="sf-form-field__accessory">{labelAccessory}</span>
        </div>
      )}
      {children}
      {help === undefined ? null : <p className="sf-form-field__help" id={helpId}>{help}</p>}
      {error === undefined ? null : <p className="sf-form-field__error" id={errorId} role="alert">{error}</p>}
    </div>
  );
}
