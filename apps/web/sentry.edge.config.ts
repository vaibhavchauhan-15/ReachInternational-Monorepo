// This file configures the initialization of Sentry for edge features (middleware, Edge API routes).
// The config here is used whenever one of the edge features is loaded.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs";

const SENTRY_DSN = process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN;

if (SENTRY_DSN) {
  Sentry.init({
    dsn: SENTRY_DSN,
    environment: process.env.NODE_ENV,
    // Very low edge transaction sample — edge runtime is high-throughput
    tracesSampleRate: process.env.NODE_ENV === "production" ? 0.02 : 0,
  });
}
