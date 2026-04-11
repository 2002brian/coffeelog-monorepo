import type { NextConfig } from "next";
import { withOptionalSentryConfig } from "./lib/sentry-next-config";

const nextConfig: NextConfig = {
  output: "export",
  distDir: "out",
  transpilePackages: ["@coffeelog/shared"],
  images: {
    unoptimized: true,
  },
  trailingSlash: true,
  turbopack: {},
};

export default withOptionalSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: true,
  telemetry: false,
  webpack: {
    treeshake: {
      removeDebugLogging: true,
    },
  },
  sourcemaps: {
    disable: !process.env.SENTRY_AUTH_TOKEN,
  },
});
