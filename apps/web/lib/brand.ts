/**
 * Single source of truth for official REACH INTERNATIONAL branding metadata & assets.
 * Maintained as pure vector + text React identity system.
 */
export const BRAND_NAME = "REACH INTERNATIONAL";
export const BRAND_TAGLINE = "REACHING ALL HEIGHTS";

export const BRAND_ASSETS = {
  // SVG Vector Brand Marks
  lightLogo: "/light-favicon.svg",
  darkLogo: "/dark-favicon.svg",

  // Browser Favicon (.ico)
  lightFaviconIco: "/light-favicon.ico",
  darkFaviconIco: "/dark-favicon.ico",

  // High-Resolution App Icons (96x96)
  lightFaviconPng: "/light-favicon-96x96.png",
  darkFaviconPng: "/dark-favicon-96x96.png",

  // Apple Touch Icons (180x180)
  lightAppleTouch: "/light-apple-touch-icon.png",
  darkAppleTouch: "/dark-apple-touch-icon.png",

  // PWA / Web App Manifest Icons
  lightManifest192: "/light-web-app-manifest-192x192.png",
  darkManifest192: "/dark-web-app-manifest-192x192.png",
  lightManifest512: "/light-web-app-manifest-512x512.png",
  darkManifest512: "/dark-web-app-manifest-512x512.png",
  manifest: "/site.webmanifest",
} as const;

export type BrandAssetKey = keyof typeof BRAND_ASSETS;

