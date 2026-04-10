import {
  blockedOriginResponse,
  buildCorsHeaders,
  isAllowedOrigin,
  jsonResponse,
  logCorsCheck,
} from "@/lib/cors";

export const runtime = "nodejs";

const payload = {
  status: "ok",
  version: "1.0.0",
};

export async function OPTIONS(req: Request) {
  const origin = req.headers.get("origin");
  logCorsCheck(origin);

  if (!isAllowedOrigin(origin)) {
    return blockedOriginResponse(origin);
  }

  return new Response(null, {
    status: 204,
    headers: buildCorsHeaders(origin),
  });
}

export async function GET(req: Request) {
  const origin = req.headers.get("origin");
  logCorsCheck(origin);

  if (!isAllowedOrigin(origin)) {
    return blockedOriginResponse(origin);
  }

  return jsonResponse(payload, 200, buildCorsHeaders(origin));
}
