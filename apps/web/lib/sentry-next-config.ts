import type { NextConfig } from "next";

type WithSentryConfig = (
  nextConfig: NextConfig,
  options?: Record<string, unknown>
) => NextConfig;

export function withOptionalSentryConfig(
  nextConfig: NextConfig,
  options: Record<string, unknown>
) {
  try {
    const { withSentryConfig } = require("@sentry/nextjs") as {
      withSentryConfig: WithSentryConfig;
    };

    return withSentryConfig(nextConfig, options);
  } catch {
    return nextConfig;
  }
}
