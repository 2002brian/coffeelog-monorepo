type CaptureExceptionContext = {
  tags?: Record<string, string>;
  extra?: Record<string, unknown>;
};

/**
 * Minimal Sentry-compatible shim to keep production builds working
 * until a real Sentry SDK integration is added.
 */
export function captureException(
  error: unknown,
  context?: CaptureExceptionContext
) {
  console.error("[Sentry Shim] captureException", {
    error,
    context,
  });
}
