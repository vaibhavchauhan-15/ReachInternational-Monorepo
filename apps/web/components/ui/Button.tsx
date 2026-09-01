import Link from "next/link";
import { ReactNode, forwardRef } from "react";
import { AnimatedLoader } from "./animated-icons";

export type ButtonVariant =
  | "primary"
  | "secondary"
  | "primary-sm"
  | "ghost-sm"
  | "danger"
  | "danger-sm"
  | "destructive"
  | "success"
  | "success-sm"
  | "outline"
  | "ghost"
  | "link";

export type ButtonSize = "sm" | "md" | "lg" | "icon";

interface BaseProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: ReactNode;
  trailingIcon?: ReactNode;
  iconPosition?: "left" | "right";
  loading?: boolean;
  fullWidth?: boolean;
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
  destructive:
    "bg-rose-600 hover:bg-rose-700 text-white shadow-xs font-semibold active:scale-[0.98] transition-all cursor-pointer",
  success:
    "bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs font-semibold active:scale-[0.98] transition-all cursor-pointer",
  "success-sm":
    "bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs text-xs font-semibold active:scale-[0.98] transition-all cursor-pointer",
  outline:
    "border border-[var(--color-hairline)] bg-transparent hover:bg-[var(--color-hairline-soft-surface)] text-[var(--color-ink)] font-medium active:scale-[0.98] transition-all cursor-pointer",
  ghost:
    "bg-transparent hover:bg-[var(--color-hairline-soft-surface)] text-[var(--color-ink)] font-medium active:scale-[0.98] transition-all cursor-pointer",
  link:
    "bg-transparent hover:underline text-sky-600 dark:text-sky-400 p-0 h-auto font-medium shadow-none cursor-pointer",
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: "h-8 sm:h-8.5 px-3 text-xs font-semibold rounded-lg",
  md: "h-9 sm:h-9.5 px-3.5 sm:px-4 text-xs sm:text-sm font-semibold rounded-lg",
  lg: "h-11 sm:h-11.5 px-5 text-xs sm:text-sm font-semibold rounded-lg",
  icon: "h-8.5 sm:h-9 w-8.5 sm:w-9 p-0 rounded-lg justify-center",
};

export const Button = forwardRef<HTMLButtonElement, Props>(
  (props, ref) => {
    const {
      variant = "primary",
      size,
      icon,
      trailingIcon,
      iconPosition = "left",
      loading = false,
      fullWidth = false,
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
          ? "w-8.5 sm:w-auto px-0 sm:px-3 justify-center"
          : "w-9.5 sm:w-auto px-0 sm:px-3.5 justify-center"
        : "";

    const widthClass = fullWidth ? "w-full justify-center" : "";

    const classes = `inline-flex items-center justify-center gap-1.5 shrink-0 select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/30 dark:focus-visible:ring-sky-400/30 ${
      variantClasses[variant]
    } ${variant === "link" ? "" : sizeClasses[effectiveSize]} ${widthClass} ${responsiveClasses} ${className}`;

    const renderLabel = () => {
      if (!children) return null;
      if (isResponsive && (icon || loading)) {
        return <span className="hidden sm:inline whitespace-nowrap leading-none">{children}</span>;
      }
      return <span className="whitespace-nowrap leading-none">{children}</span>;
    };

    const content = (
      <>
        {loading ? (
          <span className="inline-flex items-center justify-center shrink-0">
            <AnimatedLoader isSpinning size={16} />
          </span>
        ) : iconPosition === "left" && icon ? (
          <span className="inline-flex items-center justify-center shrink-0 leading-none">{icon}</span>
        ) : null}
        {renderLabel()}
        {!loading && (iconPosition === "right" || trailingIcon) ? (
          <span className="inline-flex items-center justify-center shrink-0 leading-none">{trailingIcon || icon}</span>
        ) : null}
      </>
    );

    if ("href" in props && props.href !== undefined) {
      const { href, disabled, target, rel, title, onClick } = rest as LinkProps;
      return (
        <Link
          ref={ref as any}
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
        ref={ref as any}
        type={type}
        className={classes}
        disabled={disabled || loading}
        {...buttonRest}
      >
        {content}
      </button>
    );
  }
);

Button.displayName = "Button";
