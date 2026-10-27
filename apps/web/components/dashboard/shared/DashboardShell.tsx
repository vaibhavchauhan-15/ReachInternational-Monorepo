import React from "react";

interface DashboardShellProps {
  children: React.ReactNode;
  className?: string;
}

export function DashboardShell({ children, className = "" }: DashboardShellProps) {
  return (
    <div
      className={`w-full max-w-7xl mx-auto space-y-5 sm:space-y-6 lg:space-y-7 ${className}`}
    >
      {children}
    </div>
  );
}
