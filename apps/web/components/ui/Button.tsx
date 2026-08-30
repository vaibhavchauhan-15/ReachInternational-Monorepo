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
  | "success-sm"
  | "outline"
  | "ghost";

export type ButtonSize = "sm" | "md" | "lg" | "icon";

interface BaseProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: ReactNode;
  trailingIcon?: ReactNode;
  iconPosition?: "left" | "right";
  loading?: boolean;
  responsive?: boolean;
  mobileIconOnly?: boolean;
  children?: ReactNode;
  className?: string;
}

export interface ButtonProps
  extends BaseProps,
    Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "children"> {
  href?: undefined;
}

export interface LinkProps extends BaseProps {
  href: string;
  disabled?: boolean;
  target?: string;
  rel?: string;
  title?: string;
  onClick?: React.MouseEventHandler<HTMLAnchorElement>;
}

export type Props = ButtonProps | LinkProps;

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    "bg-sky-600 hover:bg-sky-700 dark:bg-sky-500 dark:hover:bg-sky-600 text-white shadow-xs font-semibold active:scale-[0.98] transition-all cursor-pointer",
  "primary-sm":
    "bg-sky-600 hover:bg-sky-700 dark:bg-sky-500 dark:hover:bg-sky-600 text-white shadow-xs text-xs font-semibold active:scale-[0.98] transition-all cursor-pointer",
  secondary:
    "border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] hover:bg-[var(--color-hairline-soft-surface)] text-[var(--color-ink)] shadow-xs font-medium active:scale-[0.98] transition-all cursor-pointer",
  "ghost-sm":
    "border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] hover:bg-[var(--color-hairline-soft-surface)] text-[var(--color-ink)] shadow-xs text-xs font-medium active:scale-[0.98] transition-all cursor-pointer",
  danger:
    "bg-rose-600 hover:bg-rose-700 text-white shadow-xs font-semibold active:scale-[0.98] transition-all cursor-pointer",
  "danger-sm":
    "bg-rose-600 hover:bg-rose-700 text-white shadow-xs text-xs font-semibold active:scale-[0.98] transition-all cursor-pointer",
  success:
    "bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs font-semibold active:scale-[0.98] transition-all cursor-pointer",
  "success-sm":
    "bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs text-xs font-semibold active:scale-[0.98] transition-all cursor-pointer",
  outline:
    "border border-[var(--color-hairline)] bg-transparent hover:bg-[var(--color-hairline-soft-surface)] text-[var(--color-ink)] font-medium active:scale-[0.98] transition-all cursor-pointer",
  ghost:
    "bg-transparent hover:bg-[var(--color-hairline-soft-surface)] text-[var(--color-ink)] font-medium active:scale-[0.98] transition-all cursor-pointer",
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: "h-8 px-3 text-xs rounded-lg sm:rounded-md",
  md: "h-9 px-4 text-xs sm:text-sm rounded-lg sm:rounded-md",
  lg: "h-11 px-5 text-sm sm:text-base rounded-xl",
  icon: "h-8 w-8 p-0 rounded-lg sm:rounded-md justify-center",
};

export function Button(props: Props) {
  const {
    variant = "primary",
    size,
    icon,
    trailingIcon,
    iconPosition = "left",
    loading = false,
    responsive = false,
    mobileIconOnly = false,
    children,
    className = "",
    ...rest
  } = props;

  // Derive default size from variant if not explicitly provided
  const effectiveSize: ButtonSize =
    size ??
    (variant === "primary-sm" ||
    variant === "ghost-sm" ||
    variant === "danger-sm" ||
    variant === "success-sm"
      ? "sm"
      : "md");

  const isResponsive = responsive || mobileIconOnly;

  // Responsive padding overrides when responsive icon-only mode is active
  const responsiveClasses =
    isResponsive && icon
      ? effectiveSize === "sm"
        ? "w-8 sm:w-auto px-0 sm:px-3 justify-center"
        : "w-9 sm:w-auto px-0 sm:px-4 justify-center"
      : "";

  const classes = `inline-flex items-center gap-1.5 shrink-0 ${variantClasses[variant]} ${sizeClasses[effectiveSize]} ${responsiveClasses} ${className}`;

  const renderLabel = () => {
    if (!children) return null;
    if (isResponsive && (icon || loading)) {
      return <span className="hidden sm:inline whitespace-nowrap">{children}</span>;
    }
    return <span className="whitespace-nowrap">{children}</span>;
  };

  const content = (
    <>
      {loading ? (
        <AnimatedLoader isSpinning size={16} className="shrink-0" />
      ) : iconPosition === "left" && icon ? (
        <span className="shrink-0">{icon}</span>
      ) : null}
      {renderLabel()}
      {!loading && (iconPosition === "right" || trailingIcon) ? (
        <span className="shrink-0">{trailingIcon || icon}</span>
      ) : null}
    </>
  );

  if ("href" in props && props.href !== undefined) {
    const { href, disabled, target, rel, title, onClick } = rest as LinkProps;
    return (
      <Link
        href={href}
        className={`${classes} ${disabled ? "opacity-50 pointer-events-none" : ""}`}
        target={target}
        rel={rel}
        title={title}
        onClick={onClick}
      >
        {content}
      </Link>
    );
  }

  const { disabled, type = "button", ...buttonRest } = rest as ButtonProps;
  return (
    <button
      type={type}
      className={classes}
      disabled={disabled || loading}
      {...buttonRest}
    >
      {content}
    </button>
  );
}
