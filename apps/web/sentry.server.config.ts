// This file configures the initialization of Sentry on the server side.
// The config here is used whenever the server handles a request.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs";

const SENTRY_DSN = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (SENTRY_DSN) {
  Sentry.init({
    dsn: SENTRY_DSN,
    environment: process.env.NODE_ENV,
    // Low sample rate for transactions — RPC/DB calls only matter if they error
    tracesSampleRate: process.env.NODE_ENV === "production" ? 0.05 : 0,
    beforeSend(event) {
      // Redact auth headers that may appear in request payloads
      if (event.request?.headers) {
        delete event.request.headers["authorization"];
        delete event.request.headers["cookie"];
        delete event.request.headers["x-internal-user-sig"];
        delete event.request.headers["x-internal-user-id"];
      }
      return event;
    },
  });
}
