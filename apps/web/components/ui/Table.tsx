import { ReactNode } from "react";

interface TableProps {
  children: ReactNode;
  className?: string;
}

export function Table({ children, className = "" }: TableProps) {
  return (
    <div className="w-full overflow-x-auto">
      <table className={`w-full border-collapse ${className}`}>{children}</table>
    </div>
  );
}

export function TableHeader({ children }: { children: ReactNode }) {
  return (
    <thead className="sticky top-0 z-10 bg-background/90 backdrop-blur-md">
      <tr className="border-b border-border">{children}</tr>
    </thead>
  );
}

export function TableBody({ children }: { children: ReactNode }) {
  return <tbody>{children}</tbody>;
}

export function TableRow({
  children,
  onClick,
  className = "",
}: {
  children: ReactNode;
  onClick?: () => void;
  className?: string;
}) {
  return (
    <tr
      className={`border-b border-border transition-colors duration-100 ease-out last:border-0 hover:bg-muted/50 ${
        onClick ? "cursor-pointer hover:bg-muted" : ""
      } ${className}`}
      onClick={onClick}
    >
      {children}
    </tr>
  );
}

export function TableHead({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <th
      className={`text-left py-3 px-4 eyebrow whitespace-nowrap text-muted-foreground font-medium ${className}`}
    >
      {children}
    </th>
  );
}

export function TableCell({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <td className={`py-3 px-4 body-md text-foreground ${className}`}>
      {children}
    </td>
  );
}

interface PaginationProps {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
}

export function Pagination({ page, pageSize, total, onPageChange }: PaginationProps) {
  const totalPages = Math.ceil(total / pageSize);
  const start = (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);

  if (total === 0) return null;

  return (
    <div className="flex items-center justify-between gap-4 py-4">
      <p className="body-sm text-muted-foreground">
        Showing {start}–{end} of {total}
      </p>
      <div className="flex items-center gap-2">
        <button
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          className="btn-ghost-sm disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.97] transition-transform"
        >
          Previous
        </button>
        <span className="body-md text-foreground px-2 tabular-nums">
          {page} / {totalPages}
        </span>
        <button
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
          className="btn-ghost-sm disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.97] transition-transform"
        >
          Next
        </button>
      </div>
    </div>
  );
}