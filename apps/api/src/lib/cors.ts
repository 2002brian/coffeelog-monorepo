const defaultAllowedOrigins = [
  "capacitor://localhost",
  "http://localhost",
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  "https://localhost",
];

function getAllowedOrigins() {
  const allowedOrigins = new Set(defaultAllowedOrigins);
  const envAllowedOrigins = process.env.ALLOWED_ORIGINS?.split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

  for (const origin of envAllowedOrigins ?? []) {
    allowedOrigins.add(origin);
  }

  return allowedOrigins;
}

export function isAllowedOrigin(origin: string | null) {
  if (origin === null) {
    return true;
  }

  const normalizedOrigin = origin.trim();

  if (!normalizedOrigin) {
    return false;
  }

  return getAllowedOrigins().has(normalizedOrigin);
}

export function buildCorsHeaders(origin: string | null) {
  const headers = new Headers();

  if (origin && isAllowedOrigin(origin)) {
    headers.set("Access-Control-Allow-Origin", origin.trim());
  }

  headers.set("Access-Control-Allow-Methods", "OPTIONS, POST, GET");
  headers.set(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, x-vercel-ai-data-stream"
  );
  headers.set("Access-Control-Max-Age", "86400");
  headers.set("Vary", "Origin");

  return headers;
}

export function jsonResponse(
  body: Record<string, unknown>,
  status: number,
  headers: Headers
) {
  const responseHeaders = new Headers(headers);
  responseHeaders.set("Content-Type", "application/json; charset=utf-8");

  return new Response(JSON.stringify(body), {
    status,
    headers: responseHeaders,
  });
}

export function logCorsCheck(origin: string | null) {
  console.log("[CORS Check] Incoming origin:", origin);
}

export function blockedOriginResponse(origin: string | null) {
  console.warn("[CORS Blocked] Origin not allowed:", origin);

  return jsonResponse(
    { error: "Origin not allowed" },
    403,
    buildCorsHeaders(null)
  );
}
