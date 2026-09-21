"use client";

import { useState } from "react";
import { AnimatedEye, AnimatedEyeOff } from "@/components/ui/animated-icons";
import { Copy, Check } from "lucide-react";
import { formatAadhaar, maskAadhaar } from "@reachinternational/utils";

interface AadhaarProfileFieldProps {
  aadhaarNumber?: string | null;
  maskedFallback?: string;
}

export function AadhaarProfileField({
  aadhaarNumber,
  maskedFallback,
}: AadhaarProfileFieldProps) {
  const [isRevealed, setIsRevealed] = useState(false);
  const [copied, setCopied] = useState(false);

  if (!aadhaarNumber || !aadhaarNumber.trim()) {
    return <span>{maskedFallback || "—"}</span>;
  }

  const clean = aadhaarNumber.replace(/[\s\-]/g, "");
  const formatted = formatAadhaar(clean) || clean;
  const masked = maskedFallback || maskAadhaar(clean);
  const displayValue = isRevealed ? formatted : masked;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(clean);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard fallback
    }
  };

  return (
    <span className="inline-flex items-center gap-1.5 sm:justify-end">
      <span className="select-text">{displayValue}</span>
      <span className="inline-flex items-center gap-0.5">
        <button
          type="button"
          onClick={() => setIsRevealed((prev) => !prev)}
          className="p-1 rounded text-[var(--color-mute)] hover:text-[var(--color-ink)] hover:bg-[var(--color-hairline-soft-surface)] transition-colors cursor-pointer inline-flex items-center justify-center min-h-[28px] min-w-[28px]"
          title={isRevealed ? "Hide Aadhaar number" : "Reveal Aadhaar number"}
          aria-label={isRevealed ? "Hide Aadhaar number" : "Reveal Aadhaar number"}
        >
          {isRevealed ? <AnimatedEyeOff size={14} /> : <AnimatedEye size={14} />}
        </button>
        <button
          type="button"
          onClick={handleCopy}
          className="p-1 rounded text-[var(--color-mute)] hover:text-[var(--color-ink)] hover:bg-[var(--color-hairline-soft-surface)] transition-colors cursor-pointer inline-flex items-center justify-center min-h-[28px] min-w-[28px]"
          title={copied ? "Copied Aadhaar!" : "Copy Aadhaar number"}
          aria-label="Copy Aadhaar number"
        >
          {copied ? (
            <Check className="h-3.5 w-3.5 text-emerald-500 dark:text-emerald-400" />
          ) : (
            <Copy className="h-3.5 w-3.5" />
          )}
        </button>
      </span>
    </span>
  );
}
