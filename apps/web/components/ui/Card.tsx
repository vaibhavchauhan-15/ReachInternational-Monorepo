import { ReactNode } from "react";

interface CardProps {
  children: ReactNode;
  className?: string;
  elevated?: boolean;
  padding?: "sm" | "md" | "lg" | "xl" | "none";
  id?: string;
  onClick?: () => void;
}

const paddingClasses = {
  none: "",
  sm: "p-3",
  md: "p-4",
  lg: "p-6",
  xl: "p-8",
};

export function Card({
  children,
  className = "",
  elevated = false,
  padding = "lg",
  id,
  onClick,
}: CardProps) {
  return (
    <div
      id={id}
      className={`${elevated ? "card-elevated" : "card-base"} ${paddingClasses[padding]} ${
        onClick ? "cursor-pointer card-hover-system" : ""
      } ${className}`}
      onClick={onClick}
    >
      {children}
    </div>
  );
}

interface CardHeaderProps {
  title: string;
  subtitle?: string;
  eyebrow?: string;
  action?: ReactNode;
  className?: string;
}

export function CardHeader({ title, subtitle, eyebrow, action, className = "" }: CardHeaderProps) {
  return (
    <div className={`flex items-start justify-between gap-4 ${className}`}>
      <div className="flex flex-col gap-1">
        {eyebrow && <span className="eyebrow">{eyebrow}</span>}
        <h3 className="heading-md text-[var(--color-ink)]">{title}</h3>
        {subtitle && <p className="body-md text-[var(--color-body)]">{subtitle}</p>}
      </div>
      {action && <div className="flex-shrink-0">{action}</div>}
    </div>
  );
}