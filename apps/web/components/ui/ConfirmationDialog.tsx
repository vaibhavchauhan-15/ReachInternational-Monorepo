"use client";

import { ReactNode, useState } from "react";
import { AnimatedTrash, AnimatedAlertTriangle, AnimatedInfo } from "./animated-icons";
import { Modal } from "./Modal";
import { Button } from "./Button";
import { isRedirectError } from "@/lib/utils";

interface ConfirmationDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  title: string;
  description: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "danger" | "warning" | "info";
  loading?: boolean;
}

export function ConfirmationDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  variant = "danger",
  loading = false,
}: ConfirmationDialogProps) {
  const [internalLoading, setInternalLoading] = useState(false);
  const isLoading = Boolean(loading || internalLoading);

  const iconConfig = {
    danger: {
      icon: AnimatedTrash,
      bg: "bg-[rgba(238,0,0,0.1)] text-[var(--color-error)]",
      buttonVariant: "danger" as const,
    },
    warning: {
      icon: AnimatedAlertTriangle,
      bg: "bg-[var(--color-warning-soft)] text-[var(--color-warning-deep)]",
      buttonVariant: "primary" as const,
    },
    info: {
      icon: AnimatedInfo,
      bg: "bg-[var(--color-link-soft)] text-[var(--color-link)]",
      buttonVariant: "primary" as const,
    },
  };

  const currentConfig = iconConfig[variant];
  const Icon = currentConfig.icon;

  const handleClose = () => {
    if (!isLoading) {
      onClose();
    }
  };

  const handleConfirm = async () => {
    if (isLoading) return;
    try {
      const result = onConfirm();
      if (result && typeof (result as any).then === "function") {
        setInternalLoading(true);
        await result;
      }
    } catch (error) {
      if (isRedirectError(error)) {
        throw error;
      }
      setInternalLoading(false);
    }
  };

  return (
    <Modal
      open={isOpen}
      onClose={handleClose}
      title={title}
      showCloseButton={!isLoading}
      preventClose={isLoading}
    >
      <div className="flex flex-col gap-4">
        <div className="flex items-start gap-3">
          <div className={`p-2.5 rounded-[var(--radius-md)] flex-shrink-0 ${currentConfig.bg}`}>
            <Icon size={20} />
          </div>
          <div className="body-md text-[var(--color-body)] leading-relaxed pt-0.5">
            {description}
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 pt-3 border-t border-[var(--color-hairline)] mt-2">
          <Button variant="secondary" onClick={handleClose} disabled={isLoading}>
            {cancelLabel}
          </Button>
          <Button
            variant={currentConfig.buttonVariant}
            onClick={handleConfirm}
            loading={isLoading}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
