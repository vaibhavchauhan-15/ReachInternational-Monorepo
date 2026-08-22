"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, ReactNode } from "react";
import {
  AnimatedCheckCircle,
  AnimatedXCircle,
  AnimatedAlertCircle,
  AnimatedInfo,
  AnimatedX,
} from "./animated-icons";
import { motion, AnimatePresence } from "framer-motion";

type ToastType = "success" | "error" | "warning" | "info";

interface Toast {
  id: string;
  type: ToastType;
  message: string;
  description?: string;
}

interface ToastContextValue {
  toast: (type: ToastType, message: string, description?: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}

const toastConfig: Record<ToastType, { icon: React.ComponentType<{ size?: number; className?: string }>; color: string; bg: string }> = {
  success: { icon: AnimatedCheckCircle, color: "text-[var(--color-link)]", bg: "bg-[var(--color-link-soft)]" },
  error: { icon: AnimatedXCircle, color: "text-[var(--color-error)]", bg: "bg-[rgba(238,0,0,0.1)]" },
  warning: { icon: AnimatedAlertCircle, color: "text-[var(--color-warning-deep)]", bg: "bg-[var(--color-warning-soft)]" },
  info: { icon: AnimatedInfo, color: "text-[var(--color-link-deep)]", bg: "bg-[var(--color-link-soft)]" },
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    const media = window.matchMedia("(min-width: 640px)");
    setIsDesktop(media.matches);
    const listener = (e: MediaQueryListEvent) => setIsDesktop(e.matches);
    media.addEventListener("change", listener);
    return () => media.removeEventListener("change", listener);
  }, []);

  const removeToast = useCallback((id: string) => {
    // Clear any pending auto-dismiss timer for this toast
    const timer = timersRef.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timersRef.current.delete(id);
    }
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback(
    (type: ToastType, message: string, description?: string) => {
      const id = Math.random().toString(36).substring(7);
      setToasts((prev) => [...prev, { id, type, message, description }]);
      const timer = setTimeout(() => removeToast(id), 5000);
      timersRef.current.set(id, timer);
    },
    [removeToast]
  );

  // Clear all timers on unmount to prevent memory leaks
  useEffect(() => {
    const timers = timersRef.current;
    return () => {
      timers.forEach((timer) => clearTimeout(timer));
      timers.clear();
    };
  }, []);

  const contextValue = useMemo(() => ({ toast }), [toast]);

  return (
    <ToastContext.Provider value={contextValue}>
      {children}
      <div className="fixed top-4 left-4 right-4 sm:left-auto sm:right-4 z-[100] flex flex-col items-center sm:items-end gap-2 pointer-events-none">
        <AnimatePresence>
          {toasts.map((t) => {
            const config = toastConfig[t.type];
            const Icon = config.icon;
            return (
              <motion.div
                key={t.id}
                initial={
                  isDesktop
                    ? { opacity: 0, y: -30, x: 30, scale: 0.95 }
                    : { opacity: 0, y: -30, scale: 0.95 }
                }
                animate={{ opacity: 1, y: 0, x: 0, scale: 1 }}
                exit={{ opacity: 0, y: -30, x: 0, scale: 0.95 }}
                transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                className="pointer-events-auto card-elevated flex items-start gap-3 p-4 min-w-[280px] sm:min-w-[320px] max-w-[400px] shadow-xl border border-[var(--color-hairline)] rounded-xl"
              >
                <div className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full ${config.bg}`}>
                  <Icon size={16} className={config.color} />
                </div>
                <div className="flex-1 pt-0.5">
                  <p className="label-sm text-[var(--color-ink)] font-semibold">{t.message}</p>
                  {t.description && (
                    <p className="body-sm text-[var(--color-body)] text-xs mt-0.5">{t.description}</p>
                  )}
                </div>
                <button
                  onClick={() => removeToast(t.id)}
                  className="text-[var(--color-mute)] hover:text-[var(--color-ink)] transition-colors p-0.5 rounded"
                >
                  <AnimatedX size={16} />
                </button>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}