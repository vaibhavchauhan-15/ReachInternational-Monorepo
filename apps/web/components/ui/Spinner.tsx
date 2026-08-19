import { AnimatedLoader } from "./animated-icons";

interface SpinnerProps {
  size?: "sm" | "md" | "lg";
  className?: string;
}

const sizeClasses = {
  sm: "h-4 w-4",
  md: "h-6 w-6",
  lg: "h-8 w-8",
};

export function Spinner({ size = "md", className = "" }: SpinnerProps) {
  return <AnimatedLoader isSpinning className={`${sizeClasses[size]} text-[var(--color-mute)] ${className}`} />;
}

interface FullPageSpinnerProps {
  message?: string;
}

export function FullPageSpinner({ message }: FullPageSpinnerProps) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4">
      <Spinner size="lg" />
      {message && <p className="body-md text-[var(--color-mute)]">{message}</p>}
    </div>
  );
}