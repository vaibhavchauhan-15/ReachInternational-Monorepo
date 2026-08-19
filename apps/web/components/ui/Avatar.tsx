"use client";

import React, { useState, ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export type AvatarSize = "xs" | "sm" | "md" | "lg" | "xl";
export type AvatarStatus = "online" | "offline" | "busy" | "away";

export interface AvatarProps extends React.HTMLAttributes<HTMLDivElement> {
  src?: string;
  alt?: string;
  name?: string;
  role?: string;
  fallback?: ReactNode;
  size?: AvatarSize;
  status?: AvatarStatus;
  ring?: boolean;
  ringColor?: string;
  showTooltip?: boolean;
  tooltipContent?: ReactNode;
  className?: string;
}

const SIZE_MAP: Record<AvatarSize, { box: string; text: string; status: string; statusOffset: string }> = {
  xs: { box: "h-6 w-6 text-[10px]", text: "text-[10px]", status: "h-1.5 w-1.5", statusOffset: "-bottom-0.5 -right-0.5" },
  sm: { box: "h-8 w-8 text-xs", text: "text-xs", status: "h-2 w-2", statusOffset: "bottom-0 right-0" },
  md: { box: "h-10 w-10 text-sm", text: "text-sm", status: "h-2.5 w-2.5", statusOffset: "bottom-0 right-0" },
  lg: { box: "h-12 w-12 text-base", text: "text-base", status: "h-3 w-3", statusOffset: "bottom-0.5 right-0.5" },
  xl: { box: "h-16 w-16 text-xl", text: "text-xl", status: "h-4 w-4", statusOffset: "bottom-1 right-1" },
};

const STATUS_COLOR_MAP: Record<AvatarStatus, string> = {
  online: "bg-emerald-500 ring-white dark:ring-slate-900",
  offline: "bg-slate-400 dark:bg-slate-500 ring-white dark:ring-slate-900",
  busy: "bg-rose-500 ring-white dark:ring-slate-900",
  away: "bg-amber-500 ring-white dark:ring-slate-900",
};

const FALLBACK_BG_PALETTES = [
  "bg-indigo-600 text-white",
  "bg-violet-600 text-white",
  "bg-cyan-600 text-white",
  "bg-emerald-600 text-white",
  "bg-amber-600 text-white",
  "bg-rose-600 text-white",
  "bg-blue-600 text-white",
];

function getInitials(name?: string): string {
  if (!name) return "U";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function getFallbackColor(name?: string): string {
  if (!name) return FALLBACK_BG_PALETTES[0];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % FALLBACK_BG_PALETTES.length;
  return FALLBACK_BG_PALETTES[index];
}

export const AvatarFallback = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & { name?: string; size?: AvatarSize }
>(({ className, children, name, size = "md", ...props }, ref) => {
  const initials = children || getInitials(name);
  const colorClass = getFallbackColor(name);

  return (
    <div
      ref={ref}
      className={cn(
        "flex h-full w-full items-center justify-center rounded-full font-semibold uppercase tracking-wider select-none",
        colorClass,
        SIZE_MAP[size].text,
        className
      )}
      {...props}
    >
      {initials}
    </div>
  );
});
AvatarFallback.displayName = "AvatarFallback";

export const AvatarImage = React.forwardRef<
  HTMLImageElement,
  React.ImgHTMLAttributes<HTMLImageElement> & { onErrorCallback?: () => void }
>(({ className, src, alt, onErrorCallback, ...props }, ref) => {
  return (
    <img
      ref={ref}
      src={src}
      alt={alt || "Avatar"}
      onError={onErrorCallback}
      className={cn("h-full w-full rounded-full object-cover", className)}
      {...props}
    />
  );
});
AvatarImage.displayName = "AvatarImage";

export const Avatar = React.forwardRef<HTMLDivElement, AvatarProps>(
  (
    {
      src,
      alt,
      name,
      role,
      fallback,
      size = "md",
      status,
      ring = true,
      ringColor = "ring-white dark:ring-slate-900",
      showTooltip = false,
      tooltipContent,
      className,
      ...props
    },
    ref
  ) => {
    const [imageError, setImageError] = useState(!src);
    const [isHovered, setIsHovered] = useState(false);

    const sizeConfig = SIZE_MAP[size];

    return (
      <div
        ref={ref}
        className={cn("relative inline-block select-none", className)}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        {...props}
      >
        <div
          className={cn(
            "relative overflow-hidden rounded-full transition-all duration-200",
            sizeConfig.box,
            ring && `ring-2 ${ringColor}`,
            "shadow-sm"
          )}
        >
          {src && !imageError ? (
            <AvatarImage
              src={src}
              alt={alt || name}
              onErrorCallback={() => setImageError(true)}
            />
          ) : (
            <AvatarFallback name={name} size={size}>
              {fallback}
            </AvatarFallback>
          )}
        </div>

        {/* Status Indicator Dot */}
        {status && (
          <span
            className={cn(
              "absolute rounded-full ring-2",
              sizeConfig.status,
              sizeConfig.statusOffset,
              STATUS_COLOR_MAP[status]
            )}
          />
        )}

        {/* Hover Tooltip */}
        {showTooltip && (
          <AnimatePresence>
            {isHovered && (
              <motion.div
                initial={{ opacity: 0, y: 4, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 4, scale: 0.96 }}
                transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
                className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50 pointer-events-none px-2.5 py-1.5 rounded-md bg-slate-900/95 text-white dark:bg-slate-100 dark:text-slate-900 border border-slate-800 dark:border-slate-200 text-xs shadow-xl whitespace-nowrap"
              >
                {tooltipContent ? (
                  tooltipContent
                ) : (
                  <div className="flex flex-col items-center text-center">
                    {name && <span className="font-semibold leading-tight">{name}</span>}
                    {role && <span className="text-[10px] opacity-80 leading-tight">{role}</span>}
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        )}
      </div>
    );
  }
);
Avatar.displayName = "Avatar";

export interface AvatarGroupItem {
  src?: string;
  name?: string;
  role?: string;
  alt?: string;
  status?: AvatarStatus;
  fallback?: ReactNode;
}

export interface AvatarGroupProps extends React.HTMLAttributes<HTMLDivElement> {
  items?: AvatarGroupItem[];
  children?: ReactNode;
  max?: number;
  size?: AvatarSize;
  spacing?: "tight" | "normal" | "loose";
  hoverAnimation?: boolean;
  showTooltip?: boolean;
  totalCount?: number;
  onMoreClick?: () => void;
  className?: string;
}

const SPACING_MAP: Record<AvatarSize, Record<"tight" | "normal" | "loose", string>> = {
  xs: { tight: "-space-x-1.5", normal: "-space-x-2", loose: "-space-x-2.5" },
  sm: { tight: "-space-x-2", normal: "-space-x-2.5", loose: "-space-x-3" },
  md: { tight: "-space-x-2.5", normal: "-space-x-3", loose: "-space-x-4" },
  lg: { tight: "-space-x-3", normal: "-space-x-4", loose: "-space-x-5" },
  xl: { tight: "-space-x-4", normal: "-space-x-5", loose: "-space-x-6" },
};

export const AvatarGroup = React.forwardRef<HTMLDivElement, AvatarGroupProps>(
  (
    {
      items = [],
      children,
      max = 4,
      size = "md",
      spacing = "normal",
      hoverAnimation = true,
      showTooltip = true,
      totalCount,
      onMoreClick,
      className,
      ...props
    },
    ref
  ) => {
    const rawItems = items.length > 0 ? items : [];
    const visibleItems = rawItems.slice(0, max);
    const hiddenCount = totalCount !== undefined ? totalCount - visibleItems.length : rawItems.length - max;
    const hasMore = hiddenCount > 0;

    const spacingClass = SPACING_MAP[size][spacing];
    const sizeConfig = SIZE_MAP[size];

    return (
      <div
        ref={ref}
        className={cn("flex items-center", spacingClass, className)}
        {...props}
      >
        {items.length > 0
          ? visibleItems.map((item, idx) => (
              <motion.div
                key={idx}
                className="relative"
                style={{ zIndex: visibleItems.length - idx }}
                whileHover={
                  hoverAnimation
                    ? {
                        y: -3,
                        scale: 1.08,
                        zIndex: 40,
                        transition: { type: "spring", stiffness: 400, damping: 25 },
                      }
                    : undefined
                }
              >
                <Avatar
                  src={item.src}
                  name={item.name}
                  role={item.role}
                  alt={item.alt || item.name}
                  status={item.status}
                  fallback={item.fallback}
                  size={size}
                  showTooltip={showTooltip}
                />
              </motion.div>
            ))
          : React.Children.map(children, (child, idx) => {
              if (!React.isValidElement(child)) return child;
              return (
                <motion.div
                  key={idx}
                  className="relative"
                  style={{ zIndex: 30 - idx }}
                  whileHover={
                    hoverAnimation
                      ? {
                          y: -3,
                          scale: 1.08,
                          zIndex: 40,
                          transition: { type: "spring", stiffness: 400, damping: 25 },
                        }
                      : undefined
                  }
                >
                  {React.cloneElement(child as React.ReactElement<AvatarProps>, {
                    size: (child.props as AvatarProps).size || size,
                  })}
                </motion.div>
              );
            })}

        {/* Overflow Badge Counter (+N) */}
        {hasMore && (
          <motion.div
            className="relative cursor-pointer"
            style={{ zIndex: 0 }}
            whileHover={
              hoverAnimation
                ? {
                    y: -3,
                    scale: 1.08,
                    zIndex: 40,
                    transition: { type: "spring", stiffness: 400, damping: 25 },
                  }
                : undefined
            }
            onClick={onMoreClick}
          >
            <div
              className={cn(
                "flex items-center justify-center rounded-full font-semibold border-2 border-white dark:border-slate-900 bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200 shadow-sm transition-colors hover:bg-slate-200 dark:hover:bg-slate-700 select-none",
                sizeConfig.box
              )}
            >
              +{hiddenCount}
            </div>
          </motion.div>
        )}
      </div>
    );
  }
);
AvatarGroup.displayName = "AvatarGroup";

// Convenient Aliases
export const GroupAvatar = AvatarGroup;
export const AvatarStack = AvatarGroup;
