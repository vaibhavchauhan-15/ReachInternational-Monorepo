import type { Metadata } from "next";
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

export const metadata: Metadata = {
  title: "REACH INTERNATIONAL — Reaching All Heights",
  description:
    "Enterprise heavy machinery fleet management, field service tracking, and automated operations platform.",
  icons: {
    icon: [
      { url: "/light-favicon.ico", media: "(prefers-color-scheme: light)" },
      { url: "/dark-favicon.ico", media: "(prefers-color-scheme: dark)" },
      { url: "/light-favicon.svg", type: "image/svg+xml", media: "(prefers-color-scheme: light)" },
      { url: "/dark-favicon.svg", type: "image/svg+xml", media: "(prefers-color-scheme: dark)" },
      { url: "/light-favicon-96x96.png", sizes: "96x96", type: "image/png", media: "(prefers-color-scheme: light)" },
      { url: "/dark-favicon-96x96.png", sizes: "96x96", type: "image/png", media: "(prefers-color-scheme: dark)" },
    ],
    shortcut: "/light-favicon.ico",
    apple: [
      { url: "/light-apple-touch-icon.png", media: "(prefers-color-scheme: light)" },
      { url: "/dark-apple-touch-icon.png", media: "(prefers-color-scheme: dark)" },
    ],
  },
  manifest: "/site.webmanifest",
};

import { TooltipProvider, ToastProvider } from "@/components/ui";

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
        <link rel="icon" href="/light-favicon.ico" sizes="any" media="(prefers-color-scheme: light)" />
        <link rel="icon" href="/dark-favicon.ico" sizes="any" media="(prefers-color-scheme: dark)" />
        <link rel="icon" href="/light-favicon.svg" type="image/svg+xml" media="(prefers-color-scheme: light)" />
        <link rel="icon" href="/dark-favicon.svg" type="image/svg+xml" media="(prefers-color-scheme: dark)" />
        <link rel="apple-touch-icon" href="/light-apple-touch-icon.png" media="(prefers-color-scheme: light)" />
        <link rel="apple-touch-icon" href="/dark-apple-touch-icon.png" media="(prefers-color-scheme: dark)" />
        <link
          rel="preconnect"
          href="https://dhbbgfzbyatzvqafnsqp.supabase.co"
          crossOrigin="anonymous"
        />
      </head>
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <ThemeProvider>
          <ToastProvider>
            <TooltipProvider delayDuration={200}>
              {children}
              <AgentationWrapper />
              <CookieConsent />
            </TooltipProvider>
          </ToastProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
