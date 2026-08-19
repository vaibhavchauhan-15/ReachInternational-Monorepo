import { forwardRef } from "react";
import { AnimatedChevronDown } from "./animated-icons";

interface SelectOption {
  value: string;
  label: string;
}

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  hint?: string;
  options: SelectOption[];
  placeholder?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, error, hint, options, placeholder, className = "", id, ...props }, ref) => {
    const selectId = id || props.name;
    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label htmlFor={selectId} className="label-sm text-[var(--color-ink)]">
            {label}
          </label>
        )}
        <div className="relative">
          <select
            ref={ref}
            id={selectId}
            className={`input-base appearance-none pr-9 ${
              error ? "!border-[var(--color-error)]" : ""
            } ${className}`}
            {...props}
          >
            {placeholder && <option value="">{placeholder}</option>}
            {options.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <AnimatedChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--color-mute)] pointer-events-none" />
        </div>
        {error && <p className="body-sm text-[var(--color-error)]">{error}</p>}
        {hint && !error && <p className="body-sm text-[var(--color-mute)]">{hint}</p>}
      </div>
    );
  }
);

Select.displayName = "Select";

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  hint?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, error, hint, className = "", id, ...props }, ref) => {
    const textareaId = id || props.name;
    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label htmlFor={textareaId} className="label-sm text-[var(--color-ink)]">
            {label}
          </label>
        )}
        <textarea
          ref={ref}
          id={textareaId}
          className={`input-base min-h-[80px] resize-y ${
            error ? "!border-[var(--color-error)]" : ""
          } ${className}`}
          {...props}
        />
        {error && <p className="body-sm text-[var(--color-error)]">{error}</p>}
        {hint && !error && <p className="body-sm text-[var(--color-mute)]">{hint}</p>}
      </div>
    );
  }
);

Textarea.displayName = "Textarea";