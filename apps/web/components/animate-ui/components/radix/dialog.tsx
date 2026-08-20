"use client";

import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { AnimatedX } from "@/components/ui/animated-icons";
import { cn } from "@/lib/utils";
import { TooltipWrapper } from "@/components/ui/tooltip";

export type DialogFrom = "top" | "bottom" | "left" | "right" | "center";

export interface DialogContentProps
  extends React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> {
  from?: DialogFrom;
  showCloseButton?: boolean;
}

const DialogContext = React.createContext<{
  open: boolean;
  setOpen: (open: boolean) => void;
}>({
  open: false,
  setOpen: () => {},
});

export const Dialog = ({
  open: controlledOpen,
  defaultOpen = false,
  onOpenChange,
  children,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Root>) => {
  const [uncontrolledOpen, setUncontrolledOpen] = React.useState(defaultOpen);
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : uncontrolledOpen;

  const setOpen = React.useCallback(
    (value: boolean) => {
      if (!isControlled) {
        setUncontrolledOpen(value);
      }
      onOpenChange?.(value);
    },
    [isControlled, onOpenChange]
  );

  return (
    <DialogContext.Provider value={{ open, setOpen }}>
      <DialogPrimitive.Root open={open} onOpenChange={setOpen} {...props}>
        {children}
      </DialogPrimitive.Root>
    </DialogContext.Provider>
  );
};

export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogPortal = DialogPrimitive.Portal;
export const DialogClose = DialogPrimitive.Close;
export const DialogOverlay = DialogPrimitive.Overlay;

const getAnimationVariants = (from: DialogFrom = "center") => {
  switch (from) {
    case "top":
      return {
        initial: { opacity: 0, y: -24, scale: 0.97 },
        animate: { opacity: 1, y: 0, scale: 1 },
        exit: { opacity: 0, y: -20, scale: 0.97 },
      };
    case "bottom":
      return {
        initial: { opacity: 0, y: 24, scale: 0.97 },
        animate: { opacity: 1, y: 0, scale: 1 },
        exit: { opacity: 0, y: 20, scale: 0.97 },
      };
    case "left":
      return {
        initial: { opacity: 0, x: -24, scale: 0.97 },
        animate: { opacity: 1, x: 0, scale: 1 },
        exit: { opacity: 0, x: -20, scale: 0.97 },
      };
    case "right":
      return {
        initial: { opacity: 0, x: 24, scale: 0.97 },
        animate: { opacity: 1, x: 0, scale: 1 },
        exit: { opacity: 0, x: 20, scale: 0.97 },
      };
    case "center":
    default:
      return {
        initial: { opacity: 0, scale: 0.95, y: 8 },
        animate: { opacity: 1, scale: 1, y: 0 },
        exit: { opacity: 0, scale: 0.95, y: 8 },
      };
  }
};

export const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  DialogContentProps
>(
  (
    { className, children, from = "center", showCloseButton = true, ...props },
    ref
  ) => {
    const { open } = React.useContext(DialogContext);
    const shouldReduceMotion = useReducedMotion();
    const variants = getAnimationVariants(from);

    return (
      <AnimatePresence>
        {open && (
          <DialogPrimitive.Portal forceMount>
            <DialogPrimitive.Overlay asChild forceMount>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm"
              />
            </DialogPrimitive.Overlay>

            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <DialogPrimitive.Content ref={ref} asChild forceMount {...props}>
                <motion.div
                  initial={
                    shouldReduceMotion ? { opacity: 0 } : variants.initial
                  }
                  animate={
                    shouldReduceMotion ? { opacity: 1 } : variants.animate
                  }
                  exit={
                    shouldReduceMotion ? { opacity: 0 } : variants.exit
                  }
                  transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                  className={cn(
                    "relative z-10 w-full card-elevated flex flex-col max-h-[90vh] focus:outline-none",
                    className
                  )}
                >
                  {children}
                  {showCloseButton && (
                    <TooltipWrapper content="Close modal (Esc)" side="left">
                      <DialogPrimitive.Close className="absolute right-5 top-5 rounded-[var(--radius-sm)] p-1.5 text-[var(--color-mute)] transition-colors hover:bg-[var(--color-hairline-soft-surface)] hover:text-[var(--color-ink)] focus:outline-none cursor-pointer">
                        <AnimatedX size={16} />
                        <span className="sr-only">Close</span>
                      </DialogPrimitive.Close>
                    </TooltipWrapper>
                  )}
                </motion.div>
              </DialogPrimitive.Content>
            </div>
          </DialogPrimitive.Portal>
        )}
      </AnimatePresence>
    );
  }
);
DialogContent.displayName = DialogPrimitive.Content.displayName;

export const DialogHeader = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "flex flex-col space-y-1.5 p-6 border-b border-[var(--color-hairline)]",
      className
    )}
    {...props}
  />
);
DialogHeader.displayName = "DialogHeader";

export const DialogFooter = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "flex flex-col-reverse sm:flex-row sm:justify-end gap-3 p-6 border-t border-[var(--color-hairline)]",
      className
    )}
    {...props}
  />
);
DialogFooter.displayName = "DialogFooter";

export const DialogTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn("heading-md text-[var(--color-ink)]", className)}
    {...props}
  />
));
DialogTitle.displayName = DialogPrimitive.Title.displayName;

export const DialogDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn("body-md text-[var(--color-body)]", className)}
    {...props}
  />
));
DialogDescription.displayName = DialogPrimitive.Description.displayName;
