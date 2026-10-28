import React from "react";

export interface FormFieldProps {
  id: string;
  label: string;
  required?: boolean;
  helperText?: string;
  error?: string;
  className?: string;
  children: React.ReactNode;
}

export function FormField({
  id,
  label,
  required = false,
  helperText,
  error,
  className = "",
  children,
}: FormFieldProps) {
  const errorId = `${id}-error`;
  const helperId = `${id}-helper`;

  return (
    <div className={`space-y-1.5 ${className}`}>
      <div className="flex items-center justify-between">
        <label
          htmlFor={id}
          className="block text-sm font-medium text-foreground tracking-tight"
        >
          {label}
          {required && (
            <span className="text-destructive ml-1" aria-hidden="true">
              *
            </span>
          )}
        </label>
        {required && <span className="sr-only">(required)</span>}
      </div>

      <div className="relative">{children}</div>

      {error ? (
        <p
          id={errorId}
          className="text-xs font-medium text-destructive mt-1 flex items-center gap-1"
          role="alert"
        >
          <span>{error}</span>
        </p>
      ) : helperText ? (
        <p id={helperId} className="text-xs text-muted-foreground mt-1">
          {helperText}
        </p>
      ) : null}
    </div>
  );
}
