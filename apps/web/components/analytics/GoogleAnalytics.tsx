"use client";

import { useEffect, Suspense } from "react";
import Script from "next/script";
import { usePathname, useSearchParams } from "next/navigation";
import {
  GA_MEASUREMENT_ID,
  trackPageView,
  trackOutboundLink,
  trackFileDownload,
  trackCtaClick,
  trackEvent,
} from "@/lib/analytics";

/**
 * Route & Query Parameter Change Tracker
 * Uses Next.js App Router hooks to report single-page navigation to GA4.
 */
function AnalyticsRouteTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (!pathname) return;

    const queryString = searchParams?.toString();
    const fullPath = queryString ? `${pathname}?${queryString}` : pathname;

    // Small delay to allow Next.js metadata / document.title to update
    const timer = setTimeout(() => {
      trackPageView({
        url: fullPath,
        title: document.title,
        location: window.location.href,
      });
    }, 50);

    return () => clearTimeout(timer);
  }, [pathname, searchParams]);

  return null;
}

/**
 * Global Automatic Event Delegation Listener
 * Automatically intercepts outbound links, file downloads, and data-analytics-* attributes.
 */
function GlobalAnalyticsListener() {
  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;

      // 1. Declarative Custom Event Attributes: [data-analytics-event]
      const eventEl = target.closest<HTMLElement>("[data-analytics-event]");
      if (eventEl) {
        const eventName = eventEl.getAttribute("data-analytics-event");
        if (eventName) {
          const category = eventEl.getAttribute("data-analytics-category") || undefined;
          const label = eventEl.getAttribute("data-analytics-label") || eventEl.innerText?.slice(0, 50);
          trackEvent(eventName, {
            category,
            label,
            element_id: eventEl.id || undefined,
          });
        }
      }

      // 2. Declarative CTA Click Attributes: [data-analytics-click]
      const ctaEl = target.closest<HTMLElement>("[data-analytics-click]");
      if (ctaEl && !eventEl) {
        const ctaName = ctaEl.getAttribute("data-analytics-click");
        if (ctaName) {
          trackCtaClick(
            ctaName,
            ctaEl.getAttribute("data-analytics-location") || window.location.pathname
          );
        }
      }

      // 3. Anchor tags: Outbound Links & File Downloads
      const anchor = target.closest<HTMLAnchorElement>("a[href]");
      if (anchor && anchor.href) {
        const href = anchor.href;

        // Check for file download (.pdf, .xlsx, .csv, .docx, .zip)
        const downloadMatch = href.match(/\.(pdf|xlsx|xls|csv|docx|zip|tar\.gz)$/i);
        if (downloadMatch) {
          const fileName = href.split("/").pop() || "unknown";
          trackFileDownload(fileName, downloadMatch[1].toLowerCase());
          return;
        }

        // Check for outbound external links
        try {
          const url = new URL(href, window.location.origin);
          const isExternal =
            url.protocol.startsWith("http") &&
            url.hostname !== window.location.hostname &&
            !url.hostname.includes("reachinternational.co.in") &&
            !url.hostname.includes("vercel.app");

          if (isExternal) {
            trackOutboundLink(href, anchor.innerText?.trim() || anchor.title || href);
          }
        } catch {
          // Invalid URL ignore
        }
      }
    };

    const handleSubmit = (e: SubmitEvent) => {
      const form = e.target as HTMLFormElement | null;
      if (!form) return;

      const formName = form.getAttribute("data-analytics-form") || form.name || form.id;
      if (formName) {
        trackEvent("form_submit", {
          form_name: formName,
          form_action: form.action || window.location.pathname,
        });
      }
    };

    document.addEventListener("click", handleClick, { capture: true, passive: true });
    document.addEventListener("submit", handleSubmit, { capture: true, passive: true });

    return () => {
      document.removeEventListener("click", handleClick, { capture: true });
      document.removeEventListener("submit", handleSubmit, { capture: true });
    };
  }, []);

  return null;
}

/**
 * GoogleAnalytics Root Component
 * Injects Google Tag script with Consent Mode v2 and SPA route tracking.
 */
export function GoogleAnalytics() {
  if (!GA_MEASUREMENT_ID) {
    return null;
  }

  return (
    <>
      {/* 1. Official Google Tag Script */}
      <Script
        strategy="afterInteractive"
        src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`}
      />

      {/* 2. Google Tag Initialization & Consent Mode v2 Configuration */}
      <Script
        id="google-analytics-init"
        strategy="afterInteractive"
        dangerouslySetInnerHTML={{
          __html: `
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}

            // Configure Consent Mode v2 based on stored consent status
            var defaultConsent = 'denied';
            try {
              if (localStorage.getItem('cookie-consent') === 'accepted') {
                defaultConsent = 'granted';
              }
            } catch(e) {}

            gtag('consent', 'default', {
              'analytics_storage': defaultConsent,
              'ad_storage': defaultConsent,
              'ad_user_data': defaultConsent,
              'ad_personalization': defaultConsent
            });

            gtag('js', new Date());

            // Initialize GA4 without auto pageview; managed via React App Router tracker
            gtag('config', '${GA_MEASUREMENT_ID}', {
              send_page_view: false
            });
          `,
        }}
      />

      {/* 3. Client-Side SPA Route Navigation Tracker */}
      <Suspense fallback={null}>
        <AnalyticsRouteTracker />
      </Suspense>

      {/* 4. Global Interactivity & Outbound Link Listener */}
      <GlobalAnalyticsListener />
    </>
  );
}
