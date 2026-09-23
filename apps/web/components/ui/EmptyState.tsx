import { ReactNode } from "react";
import { AnimatedInbox } from "./animated-icons";

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className = "",
}: EmptyStateProps) {
  return (
    <div className={`group interactive-parent flex flex-col items-center justify-center gap-3 py-16 text-center ${className}`}>
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--color-hairline-soft-surface)] text-[var(--color-mute)] transition-transform duration-200 group-hover:scale-105">
        <span className="interactive-icon icon-bounce">
          {icon || <AnimatedInbox size={24} />}
        </span>
      </div>
      <h3 className="heading-md text-[var(--color-ink)]">{title}</h3>
      {description && <p className="body-md text-[var(--color-body)] max-w-sm">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}