"use client";

import { useState } from "react";
import { Copy, Check } from "lucide-react";

interface ProfileFieldCopyButtonProps {
  value: string;
  label: string;
}

export function ProfileFieldCopyButton({ value, label }: ProfileFieldCopyButtonProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard fallback
    }
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="p-1 rounded text-[var(--color-mute)] hover:text-[var(--color-ink)] hover:bg-[var(--color-hairline-soft-surface)] transition-colors cursor-pointer inline-flex items-center justify-center min-h-[26px] min-w-[26px] shrink-0"
      title={copied ? `Copied ${label}!` : `Copy ${label}`}
      aria-label={`Copy ${label}`}
    >
      {copied ? (
        <Check className="h-3.5 w-3.5 text-emerald-500 dark:text-emerald-400" />
      ) : (
        <Copy className="h-3.5 w-3.5" />
      )}
    </button>
  );
}
