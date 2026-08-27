import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV !== "production";

// SECURITY (F11): Environment-aware Content-Security-Policy
// In development, React 19 & Turbopack require 'unsafe-eval' for source maps, error overlays, and debugging callstack reconstruction.
// In production, 'unsafe-eval' is strictly excluded to prevent XSS, and upgrade-insecure-requests is enforced.
const scriptSrc = isDev
  ? "script-src 'self' 'unsafe-inline' 'unsafe-eval'"
  : "script-src 'self' 'unsafe-inline'";

const connectSrc = isDev
  ? "connect-src 'self' https://*.supabase.co wss://*.supabase.co ws: wss:"
  : "connect-src 'self' https://*.supabase.co wss://*.supabase.co";

const upgradeInsecure = isDev ? "" : "upgrade-insecure-requests;";

const contentSecurityPolicy = [
  "default-src 'self'",
  scriptSrc,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  connectSrc,
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "worker-src 'self' blob:",
  "media-src 'self' data: blob:",
  "manifest-src 'self'",
  upgradeInsecure,
]
  .filter(Boolean)
  .join("; ");

const nextConfig: NextConfig = {
  experimental: {
    staleTimes: {
      dynamic: 60,
      static: 180,
    },
    serverActions: {
      bodySizeLimit: "1mb",
    },
    optimizePackageImports: [
      "lucide-react",
      "@base-ui/react",
      "@supabase/supabase-js",
      "recharts",
    ],
  },
  compiler: {
    removeConsole: process.env.NODE_ENV === "production" ? { exclude: ["error", "warn"] } : false,
  },
  async redirects() {
    return [
      {
        source: "/notification",
        destination: "/notifications",
        permanent: true,
      },
    ];
  },
  async headers() {
    return [
      {
        source: "/:all*(svg|jpg|png|webp|woff2|woff|ttf)",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
      {
        source: "/:path*",
        headers: [
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), clipboard-read=(self), clipboard-write=(self)",
          },
          // SECURITY (F12): Enforce HTTPS via HSTS — prevents SSL stripping attacks
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          // SECURITY (F11): Enforce Content-Security-Policy (with dev-mode unsafe-eval support for React Turbopack)
          {
            key: "Content-Security-Policy",
            value: contentSecurityPolicy,
          },
        ],
      },
    ];
  },
};

export default nextConfig;