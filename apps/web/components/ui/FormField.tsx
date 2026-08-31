"use client";

import React, { createContext, useContext } from "react";

interface FormFieldContextValue {
  id?: string;
  error?: string;
  required?: boolean;
}

const FormFieldContext = createContext<FormFieldContextValue>({});

export interface FormFieldProps {
  id?: string;
  error?: string;
  required?: boolean;
  className?: string;
  children: React.ReactNode;
}

export function FormField({
  id,
  error,
  required = false,
  className = "flex flex-col gap-1 w-full",
  children,
}: FormFieldProps) {
  return (
    <FormFieldContext.Provider value={{ id, error, required }}>
      <div className={className}>{children}</div>
    </FormFieldContext.Provider>
  );
}

export interface LabelProps extends React.LabelHTMLAttributes<HTMLLabelElement> {
  required?: boolean;
  children: React.ReactNode;
}

export function Label({ required: requiredProp, className = "", children, ...props }: LabelProps) {
  const context = useContext(FormFieldContext);
  const isRequired = requiredProp ?? context.required;

  return (
    <label
      htmlFor={props.htmlFor || context.id}
      className={`text-[12px] sm:text-[13px] font-medium text-[var(--color-ink)] select-none flex items-center justify-between ${className}`}
      {...props}
    >
      <span>{children}</span>
      {isRequired && <span className="text-[10px] text-rose-500 font-bold">* Required</span>}
    </label>
  );
}

export interface HelperTextProps extends React.HTMLAttributes<HTMLParagraphElement> {
  children: React.ReactNode;
}

export function HelperText({ className = "", children, ...props }: HelperTextProps) {
  const context = useContext(FormFieldContext);
  if (context.error) return null; // Hide helper if error is active

  return (
    <p className={`text-[11px] text-[var(--color-mute)] mt-0.5 ${className}`} {...props}>
      {children}
    </p>
  );
}

export interface ErrorMessageProps extends React.HTMLAttributes<HTMLParagraphElement> {
  children?: React.ReactNode;
}

export function ErrorMessage({ className = "", children, ...props }: ErrorMessageProps) {
  const context = useContext(FormFieldContext);
  const error = children || context.error;

  if (!error) return null;

  return (
    <p
      className={`text-[11px] sm:text-xs font-medium text-rose-500 dark:text-rose-400 mt-0.5 flex items-center gap-1 form-error-enter ${className}`}
      {...props}
    >
      {error}
    </p>
  );
}
