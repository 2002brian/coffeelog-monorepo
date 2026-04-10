import * as Sentry from "@/lib/sentry";

if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
    tracesSampleRate: 1.0,
    sendDefaultPii: false,
    environment: process.env.NODE_ENV,
  });
}
