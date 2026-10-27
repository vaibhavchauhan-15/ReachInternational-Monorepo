// This file configures the initialization of Sentry for edge features (middleware, Edge API routes).
// The config here is used whenever one of the edge features is loaded.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs";

const SENTRY_DSN = process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN;
const isProduction = process.env.NODE_ENV === "production";

// Sentry is strictly active in production; completely deactivated in local development
if (isProduction && SENTRY_DSN) {
  Sentry.init({
    dsn: SENTRY_DSN,
    enabled: true,
    environment: "production",
    // Very low edge transaction sample — edge runtime is high-throughput
    tracesSampleRate: 0.02,
  });
}
