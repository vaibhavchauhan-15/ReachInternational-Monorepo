import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function isRedirectError(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  const err = error as Record<string, unknown>;
  if (typeof err.digest === "string" && err.digest.startsWith("NEXT_REDIRECT")) {
    return true;
  }
  if (err.message === "NEXT_REDIRECT") {
    return true;
  }
  return false;
}
