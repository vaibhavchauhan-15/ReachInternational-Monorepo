// This file configures the initialization of Sentry on the client side (browser).
// The config here is used whenever a user loads a page in their browser.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs";
import { getSentryDsn } from "./lib/env/client";

const SENTRY_DSN = getSentryDsn();

if (SENTRY_DSN) {
  Sentry.init({
    dsn: SENTRY_DSN,
    environment: process.env.NODE_ENV,
    // Capture 10% of transactions in production to keep quota low
    tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 0,
    // Replay is useful for UI crash reproduction — capture 1% of sessions, 100% of errors
    replaysSessionSampleRate: 0.01,
    replaysOnErrorSampleRate: 1.0,
    integrations: [
      Sentry.replayIntegration({
        // Mask all text and media to protect operator PII
        maskAllText: true,
        blockAllMedia: true,
      }),
    ],
    // Filter noise: ignore network errors not caused by app code
    ignoreErrors: [
      "ResizeObserver loop limit exceeded",
      "Non-Error promise rejection captured",
      /ChunkLoadError/,
    ],
    beforeSend(event) {
      // Strip any PII that might appear in breadcrumbs or extra data
      if (event.user) {
        delete event.user.ip_address;
      }
      return event;
    },
  });
}
