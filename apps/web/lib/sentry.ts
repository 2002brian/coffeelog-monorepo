type CaptureContext = {
  tags?: Record<string, string>;
  level?: string;
  extra?: Record<string, unknown>;
  [key: string]: unknown;
};

export function init(_options?: Record<string, unknown>) {}

export function captureException(
  error: unknown,
  _context?: CaptureContext
) {
  if (process.env.NODE_ENV !== "production") {
    console.error(error);
  }
}

export function captureMessage(
  message: string,
  _context?: CaptureContext
) {
  if (process.env.NODE_ENV !== "production") {
    console.warn(message);
  }
}

export function captureRequestError(..._args: unknown[]) {}

export function captureRouterTransitionStart(..._args: unknown[]) {}
