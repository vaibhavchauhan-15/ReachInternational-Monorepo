"use client";

import React, { useState } from "react";
import { Copy, Check, KeyRound } from "lucide-react";
import { Button, Modal, useToast } from "@/components/ui";

export interface PasswordResetModalProps {
  open: boolean;
  onClose: () => void;
  userName: string;
  temporaryPassword: string;
}

export function PasswordResetModal({
  open,
  onClose,
  userName,
  temporaryPassword,
}: PasswordResetModalProps) {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(temporaryPassword);
      } else {
        const textArea = document.createElement("textarea");
        textArea.value = temporaryPassword;
        textArea.style.position = "fixed";
        textArea.style.opacity = "0";
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand("copy");
        document.body.removeChild(textArea);
      }
      setCopied(true);
      toast("success", "Password copied to clipboard");
      setTimeout(() => setCopied(false), 2500);
    } catch {
      toast("error", "Failed to copy password to clipboard");
    }
  };

  const handleModalClose = () => {
    setCopied(false);
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={handleModalClose}
      size="sm"
      title={
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
            <KeyRound className="h-4 w-4" />
          </div>
          <span className="font-semibold text-sm sm:text-base text-[var(--color-ink)]">
            Password Reset Successful
          </span>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        {/* Success Notice Banner */}
        <div className="flex items-start sm:items-center gap-3 p-3 rounded-md bg-emerald-500/10 border border-emerald-500/20 text-emerald-800 dark:text-emerald-300 text-xs">
          <div className="w-7 h-7 rounded-full bg-emerald-500/20 flex items-center justify-center shrink-0 mt-0.5 sm:mt-0">
            <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-emerald-900 dark:text-emerald-200">New Password Generated</p>
            <p className="text-[11px] text-[var(--color-mute)] mt-0.5 leading-relaxed">
              Password updated for <strong className="text-[var(--color-ink)] font-semibold">{userName}</strong>. Share these credentials securely with the user.
            </p>
          </div>
        </div>

        {/* Temporary Password Box */}
        <div className="bg-[var(--color-hairline-soft-surface)] p-3.5 rounded-md border border-[var(--color-hairline)] space-y-2">
          <label className="block text-[11px] font-mono font-bold uppercase tracking-wider text-[var(--color-mute)]">
            Generated Temporary Password
          </label>
          <div className="flex items-center gap-2">
            <input
              type="text"
              readOnly
              value={temporaryPassword}
              onFocus={(e) => e.target.select()}
              aria-label="Generated Temporary Password"
              className="w-full text-xs font-mono font-bold bg-[var(--color-canvas-elevated)] px-3 py-2 rounded-md border border-[var(--color-hairline)] text-[var(--color-ink)] select-all focus:outline-none focus:ring-1 focus:ring-[var(--color-link)] transition-colors"
            />
            <Button
              variant="primary"
              onClick={handleCopy}
              className={`h-9 px-3.5 text-xs font-semibold rounded-md inline-flex items-center gap-1.5 shadow-xs cursor-pointer active:scale-[0.98] transition-all shrink-0 ${
                copied
                  ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                  : "bg-sky-600 hover:bg-sky-700 dark:bg-sky-500 text-white"
              }`}
              title="Copy temporary password to clipboard"
              aria-label="Copy temporary password to clipboard"
            >
              {copied ? (
                <>
                  <Check className="h-3.5 w-3.5" />
                  <span>Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5" />
                  <span>Copy</span>
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Done / Dismiss Button */}
        <Button
          variant="secondary"
          onClick={handleModalClose}
          className="w-full h-9 text-xs font-semibold rounded-md border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] hover:bg-[var(--color-hairline-soft-surface)] text-[var(--color-ink)] shadow-xs cursor-pointer active:scale-[0.98] transition-all justify-center"
        >
          Done
        </Button>
      </div>
    </Modal>
  );
}
