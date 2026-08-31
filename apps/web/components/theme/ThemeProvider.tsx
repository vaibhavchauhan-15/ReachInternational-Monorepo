"use client";

import React, { createContext, useContext, useEffect, useState } from "react";

export type Theme = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";

interface ThemeContextType {
  theme: Theme;
  resolvedTheme: ResolvedTheme;
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

// Filter out React 19 false-positive warning for inline theme initialization script in development
if (typeof window !== "undefined" && process.env.NODE_ENV === "development") {
  const origError = console.error;
  console.error = (...args: unknown[]) => {
    if (
      typeof args[0] === "string" &&
      args[0].includes("Encountered a script tag while rendering React component")
    ) {
      return;
    }
    origError.apply(console, args);
  };
}

const STORAGE_KEY = "reachinternational-theme";

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("system");
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>("light");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY) as Theme | null;
      if (stored && ["light", "dark", "system"].includes(stored)) {
        setThemeState(stored);
      }
    } catch {
      // Storage access blocked or unavailable
    }
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;

    const media = window.matchMedia("(prefers-color-scheme: dark)");

    applyTheme(theme, media);

    const handleMediaChange = () => {
      if (theme === "system") applyTheme("system", media, true);
    };

    media.addEventListener("change", handleMediaChange);
    return () => media.removeEventListener("change", handleMediaChange);
  }, [theme, mounted]);

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme);
    try {
      localStorage.setItem(STORAGE_KEY, newTheme);
    } catch {
      // Storage access blocked
    }
    applyTheme(newTheme, window.matchMedia("(prefers-color-scheme: dark)"), true);
  };

  // Apply theme atomically across the entire DOM using a temporary transition lock.
  // This disables all per-element CSS transitions during the theme change,
  // guaranteeing 0ms parallel updates for sidebar, headers, cards, tables, and modals.
  const applyTheme = (
    currentTheme: Theme,
    media: MediaQueryList,
    lockTransitions = true
  ) => {
    const isDark =
      currentTheme === "dark" ||
      (currentTheme === "system" && media.matches);

    const root = document.documentElement;

    if (lockTransitions) {
      root.classList.add("theme-changing");
    }

    root.classList.toggle("dark", isDark);
    root.style.colorScheme = isDark ? "dark" : "light";
    setResolvedTheme(isDark ? "dark" : "light");

    if (lockTransitions) {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          root.classList.remove("theme-changing");
        });
      });
    }
  };


  return (
    <ThemeContext.Provider value={{ theme, resolvedTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

const defaultContext: ThemeContextType = {
  theme: "system",
  resolvedTheme: "light",
  setTheme: () => {},
};

export function useTheme() {
  const context = useContext(ThemeContext);
  return context ?? defaultContext;
}
