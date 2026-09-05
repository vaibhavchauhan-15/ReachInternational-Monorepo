"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const SIDEBAR_WIDTH_EXPANDED = 280;
export const SIDEBAR_WIDTH_COLLAPSED = 72;
export const SIDEBAR_KEYBOARD_SHORTCUT = "b";

interface SidebarContextValue {
  collapsed: boolean;
  setCollapsed: (value: boolean | ((prev: boolean) => boolean)) => void;
  toggleCollapse: () => void;
  mobileOpen: boolean;
  setMobileOpen: React.Dispatch<React.SetStateAction<boolean>>;
  toggleMobile: () => void;
  isMobile: boolean;
  isInteractive: boolean;
}

const SidebarContext = React.createContext<SidebarContextValue | null>(null);

export function useSidebar() {
  const context = React.useContext(SidebarContext);
  if (!context) {
    throw new Error("useSidebar must be used within a <SidebarProvider />");
  }
  return context;
}

export interface SidebarProviderProps {
  children: React.ReactNode;
  defaultCollapsed?: boolean;
  collapsed?: boolean;
  onCollapsedChange?: (collapsed: boolean) => void;
  isInteractive?: boolean;
}

export function SidebarProvider({
  children,
  defaultCollapsed = false,
  collapsed: controlledCollapsed,
  onCollapsedChange,
  isInteractive: controlledIsInteractive,
}: SidebarProviderProps) {
  const [internalCollapsed, setInternalCollapsed] = React.useState(defaultCollapsed);
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const [isMobile, setIsMobile] = React.useState(false);
  const [internalIsInteractive, setInternalIsInteractive] = React.useState(false);

  const isControlled = controlledCollapsed !== undefined;
  const collapsed = isControlled ? controlledCollapsed : internalCollapsed;
  const isInteractive = controlledIsInteractive !== undefined ? controlledIsInteractive : internalIsInteractive;

  React.useEffect(() => {
    // Enable animations only after mount so initial SSR/refresh renders stiffly without animation
    const timer = requestAnimationFrame(() => {
      setInternalIsInteractive(true);
    });
    return () => cancelAnimationFrame(timer);
  }, []);

  const setCollapsed = React.useCallback(
    (value: boolean | ((prev: boolean) => boolean)) => {
      const nextValue = typeof value === "function" ? value(collapsed) : value;
      if (!isControlled) {
        setInternalCollapsed(nextValue);
      }
      onCollapsedChange?.(nextValue);
    },
    [collapsed, isControlled, onCollapsedChange]
  );

  const toggleCollapse = React.useCallback(() => {
    setCollapsed((prev) => !prev);
  }, [setCollapsed]);

  const toggleMobile = React.useCallback(() => {
    setMobileOpen((prev) => !prev);
  }, []);

  React.useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  React.useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === SIDEBAR_KEYBOARD_SHORTCUT) {
        event.preventDefault();
        toggleCollapse();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [toggleCollapse]);

  const value = React.useMemo<SidebarContextValue>(
    () => ({
      collapsed,
      setCollapsed,
      toggleCollapse,
      mobileOpen,
      setMobileOpen,
      toggleMobile,
      isMobile,
      isInteractive,
    }),
    [collapsed, setCollapsed, toggleCollapse, mobileOpen, setMobileOpen, toggleMobile, isMobile, isInteractive]
  );

  return <SidebarContext.Provider value={value}>{children}</SidebarContext.Provider>;
}

export interface SidebarProps extends React.HTMLAttributes<HTMLElement> {
  children: React.ReactNode;
}

export function Sidebar({ className, style, children, ...props }: SidebarProps) {
  const { collapsed, isInteractive } = useSidebar();

  return (
    <aside
      data-sidebar="desktop"
      data-collapsed={collapsed}
      style={{
        width: collapsed ? `${SIDEBAR_WIDTH_COLLAPSED}px` : `${SIDEBAR_WIDTH_EXPANDED}px`,
        ...style,
      }}
      className={cn(
        "fixed top-0 left-0 bottom-0 z-40 hidden md:flex flex-col bg-[var(--color-canvas-elevated)] border-r border-[var(--color-hairline)] select-none overflow-hidden will-change-[width]",
        isInteractive
          ? "transition-[width] duration-200 ease-[cubic-bezier(0.2,0.8,0.2,1)]"
          : "transition-none",
        className
      )}
      {...props}
    >
      {children}
    </aside>
  );
}

export function SidebarHeader({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "shrink-0 flex items-center border-b border-[var(--color-hairline)]",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function SidebarContent({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "flex-1 overflow-y-auto p-3 space-y-6 no-scrollbar",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function SidebarFooter({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "p-3 border-t border-[var(--color-hairline)] shrink-0",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function SidebarGroup({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("space-y-1", className)} {...props}>
      {children}
    </div>
  );
}

export function SidebarGroupLabel({ className, children, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  const { collapsed } = useSidebar();
  if (collapsed) return null;

  return (
    <p
      className={cn(
        "px-3 text-[10px] font-extrabold uppercase tracking-wider text-[var(--color-mute)] mb-2 select-none",
        className
      )}
      {...props}
    >
      {children}
    </p>
  );
}

export function SidebarGroupContent({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("space-y-1", className)} {...props}>
      {children}
    </div>
  );
}

export function SidebarMenu({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <nav className={cn("space-y-1", className)} {...props}>
      {children}
    </nav>
  );
}

export function SidebarMenuItem({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("relative space-y-1", className)} {...props}>
      {children}
    </div>
  );
}

export interface SidebarMenuButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  active?: boolean;
  icon?: React.ComponentType<{ className?: string }>;
  asChild?: boolean;
}

export const SidebarMenuButton = React.forwardRef<HTMLButtonElement, SidebarMenuButtonProps>(
  ({ className, active, children, ...props }, ref) => {
    const { collapsed } = useSidebar();

    return (
      <button
        ref={ref}
        type="button"
        className={cn(
          "relative flex items-center gap-3 rounded-xl transition-colors duration-150 cursor-pointer select-none font-semibold text-xs",
          collapsed ? "justify-center h-11 w-11 mx-auto p-0" : "w-full px-3.5 py-2.5",
          active
            ? "bg-sky-500/10 text-sky-600 dark:text-sky-400 font-bold border border-sky-500/20 shadow-2xs"
            : "text-[var(--color-body)] hover:text-[var(--color-ink)] hover:bg-[var(--color-hairline-soft-surface)]",
          className
        )}
        {...props}
      >
        {children}
      </button>
    );
  }
);
SidebarMenuButton.displayName = "SidebarMenuButton";

export function SidebarMenuSub({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "pl-4 space-y-0.5 border-l-2 border-[var(--color-hairline)] ml-4 my-1",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function SidebarMenuSubItem({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("relative", className)} {...props}>
      {children}
    </div>
  );
}

export interface SidebarMenuSubButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  active?: boolean;
}

export const SidebarMenuSubButton = React.forwardRef<HTMLButtonElement, SidebarMenuSubButtonProps>(
  ({ className, active, children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        type="button"
        className={cn(
          "flex items-center gap-2.5 w-full px-2.5 py-1.5 rounded-lg text-[11px] font-semibold transition-colors cursor-pointer select-none",
          active
            ? "text-sky-600 dark:text-sky-400 font-bold bg-sky-500/10"
            : "text-[var(--color-mute)] hover:text-[var(--color-ink)] hover:bg-[var(--color-hairline-soft-surface)]",
          className
        )}
        {...props}
      >
        {children}
      </button>
    );
  }
);
SidebarMenuSubButton.displayName = "SidebarMenuSubButton";

// Collapsible Component Primitives for Smooth Accordion Animations
interface CollapsibleContextValue {
  open: boolean;
  toggleOpen: () => void;
}
const CollapsibleContext = React.createContext<CollapsibleContextValue>({
  open: false,
  toggleOpen: () => {},
});

export function Collapsible({
  open: controlledOpen,
  defaultOpen = false,
  onOpenChange,
  children,
  className,
}: {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  children: React.ReactNode;
  className?: string;
}) {
  const [internalOpen, setInternalOpen] = React.useState(defaultOpen);
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : internalOpen;

  const toggleOpen = React.useCallback(() => {
    const next = !open;
    if (!isControlled) {
      setInternalOpen(next);
    }
    onOpenChange?.(next);
  }, [open, isControlled, onOpenChange]);

  return (
    <CollapsibleContext.Provider value={{ open, toggleOpen }}>
      <div className={cn("group/collapsible", className)} data-state={open ? "open" : "closed"}>
        {children}
      </div>
    </CollapsibleContext.Provider>
  );
}

export interface CollapsibleTriggerProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  asChild?: boolean;
}

export function CollapsibleTrigger({
  children,
  className,
  onClick,
  asChild,
  ...props
}: CollapsibleTriggerProps) {
  const { toggleOpen } = React.useContext(CollapsibleContext);

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    toggleOpen();
    onClick?.(e);
  };

  if (asChild && React.isValidElement(children)) {
    return React.cloneElement(children as React.ReactElement<{ onClick?: (e: React.MouseEvent) => void }>, {
      onClick: (e: React.MouseEvent) => {
        toggleOpen();
        (children.props as { onClick?: (e: React.MouseEvent) => void }).onClick?.(e);
      },
    });
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className={cn("w-full cursor-pointer", className)}
      {...props}
    >
      {children}
    </button>
  );
}

export function CollapsibleContent({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const { open } = React.useContext(CollapsibleContext);

  return (
    <AnimatePresence initial={false}>
      {open && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ duration: 0.2, ease: [0.2, 0.8, 0.2, 1] }}
          className={cn("overflow-hidden", className)}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
