import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AgentationWrapper } from "@/components/AgentationWrapper";
import { CookieConsent } from "@/components/ui/CookieConsent";
import { ThemeProvider } from "@/components/theme/ThemeProvider";
import { ThemeScript } from "@/components/theme/ThemeScript";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0a" },
  ],
};

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || "https://www.reachinternational.co.in"),
  title: "REACH INTERNATIONAL — Reaching All Heights",
  description:
    "Enterprise heavy machinery fleet management, field service tracking, and automated operations platform.",
  icons: {
    icon: [
      { url: "/light-favicon.ico", media: "(prefers-color-scheme: dark)" },
      { url: "/dark-favicon.ico", media: "(prefers-color-scheme: light)" },
      { url: "/light-favicon.svg", type: "image/svg+xml", media: "(prefers-color-scheme: dark)" },
      { url: "/dark-favicon.svg", type: "image/svg+xml", media: "(prefers-color-scheme: light)" },
      { url: "/light-favicon-96x96.png", sizes: "96x96", type: "image/png", media: "(prefers-color-scheme: dark)" },
      { url: "/dark-favicon-96x96.png", sizes: "96x96", type: "image/png", media: "(prefers-color-scheme: light)" },
    ],
    shortcut: "/dark-favicon.ico",
    apple: [
      { url: "/light-apple-touch-icon.png", media: "(prefers-color-scheme: dark)" },
      { url: "/dark-apple-touch-icon.png", media: "(prefers-color-scheme: light)" },
    ],
  },
  manifest: "/site.webmanifest",
  openGraph: {
    title: "REACH INTERNATIONAL — Reaching All Heights",
    description:
      "Enterprise heavy machinery fleet management, field service tracking, and automated operations platform.",
    type: "website",
    siteName: "REACH INTERNATIONAL",
    images: [
      {
        url: "/dark-web-app-manifest-512x512.png",
        width: 512,
        height: 512,
        alt: "Reach International Fleet Operations",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "REACH INTERNATIONAL — Reaching All Heights",
    description:
      "Enterprise heavy machinery fleet management, field service tracking, and automated operations platform.",
    images: ["/dark-web-app-manifest-512x512.png"],
  },
};

import { TooltipProvider, ToastProvider, PullToRefresh } from "@/components/ui";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      data-scroll-behavior="smooth"
      suppressHydrationWarning
    >
      <head>
        <ThemeScript />
        <link rel="icon" href="/light-favicon.ico" sizes="any" media="(prefers-color-scheme: dark)" />
        <link rel="icon" href="/dark-favicon.ico" sizes="any" media="(prefers-color-scheme: light)" />
        <link rel="icon" href="/light-favicon.svg" type="image/svg+xml" media="(prefers-color-scheme: dark)" />
        <link rel="icon" href="/dark-favicon.svg" type="image/svg+xml" media="(prefers-color-scheme: light)" />
        <link rel="apple-touch-icon" href="/light-apple-touch-icon.png" media="(prefers-color-scheme: dark)" />
        <link rel="apple-touch-icon" href="/dark-apple-touch-icon.png" media="(prefers-color-scheme: light)" />
        {process.env.NEXT_PUBLIC_SUPABASE_URL ? (
          <link
            rel="preconnect"
            href={process.env.NEXT_PUBLIC_SUPABASE_URL}
            crossOrigin="anonymous"
          />
        ) : null}
      </head>
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <ThemeProvider>
          <ToastProvider>
            <TooltipProvider delayDuration={200}>
              <PullToRefresh>
                {children}
              </PullToRefresh>
              <AgentationWrapper />
              <CookieConsent />
            </TooltipProvider>
          </ToastProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
