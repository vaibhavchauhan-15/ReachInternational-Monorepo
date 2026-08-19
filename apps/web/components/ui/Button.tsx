import Link from "next/link";
import { ReactNode } from "react";
import { AnimatedLoader } from "./animated-icons";

export type ButtonVariant =
  | "primary"
  | "secondary"
  | "primary-sm"
  | "ghost-sm"
  | "danger"
  | "danger-sm"
  | "success"
  | "success-sm";

type Variant = ButtonVariant;

interface BaseProps {
  variant?: Variant;
  loading?: boolean;
  children: ReactNode;
  className?: string;
}

export interface ButtonProps extends BaseProps, Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "children"> {
  href?: undefined;
}

export interface LinkProps extends BaseProps {
  href: string;
  disabled?: boolean;
}

export type Props = ButtonProps | LinkProps;

const variantClasses: Record<Variant, string> = {
  primary: "btn-primary",
  secondary: "btn-secondary",
  "primary-sm": "btn-primary-sm",
  "ghost-sm": "btn-ghost-sm",
  success: "btn-success",
  "success-sm": "btn-success-sm",
  danger: "btn-danger",
  "danger-sm": "btn-danger-sm",
};

export function Button(props: Props) {
  const { variant = "primary", loading = false, children, className = "", ...rest } = props;

  const classes = `${variantClasses[variant]} ${className}`;

  const content = (
    <>
      {loading && (
        <AnimatedLoader isSpinning size={16} className="shrink-0" />
      )}
      {children}
    </>
  );

  if ("href" in props && props.href !== undefined) {
    const { href, disabled, ...linkRest } = rest as LinkProps;
    return (
      <Link
        href={href}
        className={`${classes} ${disabled ? "opacity-50 pointer-events-none" : ""}`}
        {...(linkRest as Omit<LinkProps, "href" | "disabled">)}
      >
        {content}
      </Link>
    );
  }

  const { disabled, ...buttonRest } = rest as ButtonProps;
  return (
    <button className={classes} disabled={disabled || loading} {...buttonRest}>
      {content}
    </button>
  );
}
