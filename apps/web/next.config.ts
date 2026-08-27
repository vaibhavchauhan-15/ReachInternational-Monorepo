import type { NextConfig } from "next";

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
          // SECURITY (F11): Enforce tightened production CSP — blocks XSS & frame injection attacks at browser level
          {
            key: "Content-Security-Policy",
            value: "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; font-src 'self' data:; connect-src 'self' https://*.supabase.co wss://*.supabase.co; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; worker-src 'self' blob:; media-src 'self' data: blob:; manifest-src 'self'; upgrade-insecure-requests;",
          },
        ],
      },
    ];
  },
};

export default nextConfig;