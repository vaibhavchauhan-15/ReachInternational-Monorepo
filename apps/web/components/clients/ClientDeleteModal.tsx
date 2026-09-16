"use client";

import React, { useState } from "react";
import { ShieldAlert, Trash2, Loader2, X } from "lucide-react";
import type { CRMClient } from "@/lib/types/database";
import { softDeleteClientAction } from "@/app/actions/clients";

interface ClientDeleteModalProps {
  isOpen: boolean;
  onClose: () => void;
  client: CRMClient | null;
  onSuccess: (deletedClient: CRMClient) => void;
  onError: (errorMessage: string) => void;
}

export function ClientDeleteModal({
  isOpen,
  onClose,
  client,
  onSuccess,
  onError,
}: ClientDeleteModalProps) {
  const [isDeleting, setIsDeleting] = useState(false);

  if (!isOpen || !client) return null;

  async function handleConfirmSoftDelete() {
    if (!client) return;
    setIsDeleting(true);

    try {
      const res = await softDeleteClientAction(client.id);
      setIsDeleting(false);

      if (res.error) {
        onError(res.error);
      } else {
        onSuccess(client);
        onClose();
      }
    } catch (err: any) {
      setIsDeleting(false);
      onError(err.message || "Failed to soft delete client.");
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
      <div className="relative w-full max-w-md rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] p-5 shadow-2xl space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 text-red-600">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-100 dark:bg-red-950/60 border border-red-200 dark:border-red-800/80">
              <ShieldAlert className="h-5 w-5 text-red-600 dark:text-red-400" />
            </div>
            <div>
              <h3 className="text-base font-bold text-[var(--color-ink)]">Soft Delete Client?</h3>
              <p className="text-xs text-[var(--color-mute)] font-mono">{client.code}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isDeleting}
            className="rounded-lg p-1.5 text-[var(--color-mute)] hover:bg-[var(--color-hairline-soft-surface)] hover:text-[var(--color-ink)] transition-colors cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="rounded-lg border border-amber-200 dark:border-amber-800/80 bg-amber-50 dark:bg-amber-950/40 p-3 text-xs text-amber-800 dark:text-amber-300 space-y-1.5">
          <p className="font-semibold flex items-center gap-1.5">
            Historical Logs Preservation Guarantee:
          </p>
          <p className="leading-relaxed">
            Soft-deleting <strong>&ldquo;{client.company_name || client.client_name}&rdquo;</strong> sets its status to inactive. All historical machine running logs, shift allocations, delivery challans, and billing records will remain 100% intact in the system.
          </p>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-[var(--color-hairline)] pt-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isDeleting}
            className="rounded-lg border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] px-4 py-2 text-xs font-medium text-[var(--color-body)] hover:bg-[var(--color-hairline-soft-surface)] transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirmSoftDelete}
            disabled={isDeleting}
            className="flex items-center gap-1.5 rounded-lg bg-red-600 px-4 py-2 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-50 transition-colors cursor-pointer"
          >
            {isDeleting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Deleting...
              </>
            ) : (
              <>
                <Trash2 className="h-4 w-4" />
                Confirm Soft Delete
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
