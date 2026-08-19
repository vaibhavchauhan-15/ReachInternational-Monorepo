import { ReactNode } from "react";

type BadgeVariant =
  | "default"
  | "success"
  | "warning"
  | "error"
  | "info"
  | "neutral"
  | "active"
  | "inactive"
  | "overdue"
  | "today"
  | "tomorrow"
  | "upcoming";

interface BadgeProps {
  variant?: BadgeVariant;
  children: ReactNode;
  className?: string;
  dot?: boolean;
}

const variantClasses: Record<BadgeVariant, string> = {
  default: "bg-muted text-foreground border border-border",
  success: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20",
  warning: "bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20",
  error: "bg-rose-500/10 text-rose-700 dark:text-rose-400 border border-rose-500/20",
  info: "bg-sky-500/10 text-sky-700 dark:text-sky-400 border border-sky-500/20",
  neutral: "bg-muted text-muted-foreground border border-border",
  active: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20",
  inactive: "bg-muted text-muted-foreground border border-border",
  overdue: "bg-rose-500/10 text-rose-700 dark:text-rose-400 border border-rose-500/20",
  today: "bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20",
  tomorrow: "bg-sky-500/10 text-sky-700 dark:text-sky-400 border border-sky-500/20",
  upcoming: "bg-muted text-muted-foreground border border-border",
};

const dotColors: Record<BadgeVariant, string> = {
  default: "bg-muted-foreground",
  success: "bg-emerald-500",
  warning: "bg-amber-500",
  error: "bg-rose-500",
  info: "bg-sky-500",
  neutral: "bg-muted-foreground",
  active: "bg-emerald-500",
  inactive: "bg-muted-foreground",
  overdue: "bg-rose-500",
  today: "bg-amber-500",
  tomorrow: "bg-sky-500",
  upcoming: "bg-muted-foreground",
};

export function Badge({ variant = "default", children, className = "", dot = false }: BadgeProps) {
  return (
    <span className={`badge-base ${variantClasses[variant]} ${className}`}>
      {dot && <span className={`h-1.5 w-1.5 rounded-full ${dotColors[variant]}`} />}
      {children}
    </span>
  );
}