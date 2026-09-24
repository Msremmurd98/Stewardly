import * as React from "react";
import { cn } from "@/lib/utils";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  icon?: React.ReactNode;
  trailing?: React.ReactNode;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, icon, trailing, id, ...props }, ref) => {
    const inputId = id ?? React.useId();
    return (
      <div className="w-full">
        {label && (
          <label htmlFor={inputId} className="mb-1.5 block text-sm font-medium text-foreground">
            {label}
          </label>
        )}
        <div className="relative flex items-center">
          {icon && <span className="pointer-events-none absolute left-4 text-muted">{icon}</span>}
          <input
            id={inputId}
            ref={ref}
            aria-invalid={!!error}
            aria-describedby={error ? `${inputId}-error` : undefined}
            className={cn(
              "h-14 w-full rounded-2xl border border-border bg-surface px-4 text-base text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-foreground/20",
              icon && "pl-11",
              trailing && "pr-11",
              error && "border-danger focus:ring-danger/20",
              className
            )}
            {...props}
          />
          {trailing && <span className="absolute right-4">{trailing}</span>}
        </div>
        {error && (
          <p id={`${inputId}-error`} role="alert" className="mt-1.5 text-sm text-danger">
            {error}
          </p>
        )}
      </div>
    );
  }
);
Input.displayName = "Input";
