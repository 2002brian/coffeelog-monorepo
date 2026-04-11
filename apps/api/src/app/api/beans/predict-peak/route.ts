import { BeanSchema } from "@coffeelog/shared";
import { google } from "@ai-sdk/google";
import { generateObject } from "ai";
import { z } from "zod";
import {
  blockedOriginResponse,
  buildCorsHeaders,
  isAllowedOrigin,
  jsonResponse,
  logCorsCheck,
} from "@/lib/cors";
import * as Sentry from "@/lib/sentry";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const PredictPeakRequestSchema = z
  .object({
    origin: BeanSchema.shape.origin,
    process: BeanSchema.shape.process,
    roastLevel: BeanSchema.shape.roastLevel,
  })
  .strict();

const PredictPeakResponseSchema = z.object({
  recommendedRestDays: z.number().int().nonnegative(),
  reason: z.string().trim().min(1),
});

export async function OPTIONS(request: Request) {
  const origin = request.headers.get("origin");
  const headers = buildCorsHeaders(origin);

  if (!isAllowedOrigin(origin)) {
    return blockedOriginResponse(origin);
  }

  return new Response(null, {
    status: 204,
    headers,
  });
}

export async function POST(request: Request) {
  const requestOrigin = request.headers.get("origin");
  logCorsCheck(requestOrigin);

  if (!isAllowedOrigin(requestOrigin)) {
    return blockedOriginResponse(requestOrigin);
  }

  const headers = buildCorsHeaders(requestOrigin);

  try {
    const rawBody = (await request.json()) as unknown;
    const { origin: beanOrigin, process, roastLevel } =
      PredictPeakRequestSchema.parse(rawBody);
    const { object } = await generateObject({
      model: google("gemini-1.5-flash"),
      schema: PredictPeakResponseSchema,
      system:
        "Act as a master coffee roaster. Analyze the input to predict resting time.",
      prompt: [
        "Predict the optimal resting window for a coffee bean.",
        `Origin: ${beanOrigin}`,
        `Process: ${process}`,
        `Roast level: ${roastLevel}`,
        "Return a practical resting recommendation for home brewers.",
      ].join("\n"),
    });

    return jsonResponse(object, 200, headers);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return jsonResponse(
        {
          error: "Invalid request payload.",
          details: error.issues,
        },
        400,
        headers
      );
    }

    Sentry.captureException(error, {
      tags: {
        feature: "beans_predict_peak",
      },
    });

    return jsonResponse(
      {
        error: "Failed to generate peak flavor prediction.",
      },
      500,
      headers
    );
  }
}
