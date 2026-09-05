"use client";

import { ReactNode } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  type DialogFrom,
} from "./dialog";
import { cn } from "@/lib/utils";

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  description?: ReactNode;
  headerActions?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  size?: "sm" | "md" | "lg" | "xl";
  from?: DialogFrom;
  className?: string;
  headerClassName?: string;
  bodyClassName?: string;
  footerClassName?: string;
}

const sizeClasses = {
  sm: "sm:max-w-md",
  md: "sm:max-w-lg",
  lg: "sm:max-w-2xl",
  xl: "sm:max-w-4xl",
};

export function Modal({
  open,
  onClose,
  title,
  description,
  headerActions,
  children,
  footer,
  size = "md",
  from = "center",
  className,
  headerClassName,
  bodyClassName,
  footerClassName,
}: ModalProps) {
  return (
    <Dialog open={open} onOpenChange={(val) => { if (!val) onClose(); }}>
      <DialogContent
        from={from}
        showCloseButton={true}
        className={cn(sizeClasses[size], className)}
      >
        {(title || description || headerActions) && (
          <DialogHeader className={cn("pr-12", headerClassName)}>
            <div className="flex items-center justify-between gap-4 w-full">
              <div className="flex flex-col space-y-1.5 min-w-0 flex-1">
                {title && <DialogTitle>{title}</DialogTitle>}
                {description && (
                  <DialogDescription>{description}</DialogDescription>
                )}
              </div>
              {headerActions && (
                <div className="flex items-center gap-2 shrink-0">{headerActions}</div>
              )}
            </div>
          </DialogHeader>
        )}
        <div className={cn("flex-1 overflow-y-auto p-4 sm:p-5", bodyClassName)}>{children}</div>
        {footer && <DialogFooter className={footerClassName}>{footer}</DialogFooter>}
      </DialogContent>
    </Dialog>
  );
}