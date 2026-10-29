import React from "react";

interface KPIGridProps {
  children: React.ReactNode;
  columns?: 2 | 3 | 4 | 5 | 6;
  className?: string;
}

export function KPIGrid({ children, columns = 4, className = "" }: KPIGridProps) {
  const colClasses = {
    2: "grid-cols-1 sm:grid-cols-2",
    3: "grid-cols-1 sm:grid-cols-3",
    4: "grid-cols-2 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-4",
    5: "grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-5 [&>*:last-child:nth-child(odd)]:col-span-2 sm:[&>*:last-child:nth-child(odd)]:col-span-1",
    6: "grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-6",
  }[columns] || "grid-cols-2 sm:grid-cols-2 lg:grid-cols-4";

  return (
    <div className={`grid ${colClasses} gap-3 sm:gap-3.5 lg:gap-4 ${className}`}>
      {children}
    </div>
  );
}
