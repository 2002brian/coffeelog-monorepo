import { createGoogleGenerativeAI } from "@ai-sdk/google";
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

const DEFAULT_GEMINI_MODEL = "gemini-2.5-flash";
const SECONDARY_GEMINI_MODEL = "gemini-2.5-flash-lite";

function readEnv(name: string) {
  return process.env[name]?.trim() ?? "";
}

function getGoogleApiKey() {
  return (
    readEnv("GOOGLE_GEMINI_API_KEY") ||
    readEnv("GOOGLE_GENERATIVE_AI_API_KEY")
  );
}

function getGeminiModelConfig() {
  const preferredModel =
    readEnv("GOOGLE_GEMINI_CHAT_MODEL") ||
    readEnv("GOOGLE_GEMINI_MODEL") ||
    DEFAULT_GEMINI_MODEL;
  const configuredFallbackModel = readEnv("GOOGLE_GEMINI_FALLBACK_MODEL");
  const fallbackModel =
    configuredFallbackModel && configuredFallbackModel !== preferredModel
      ? configuredFallbackModel
      : preferredModel === DEFAULT_GEMINI_MODEL
        ? SECONDARY_GEMINI_MODEL
        : DEFAULT_GEMINI_MODEL;

  return {
    preferredModel,
    fallbackModel:
      fallbackModel !== preferredModel ? fallbackModel : null,
  };
}

function getModelCandidates(config: ReturnType<typeof getGeminiModelConfig>) {
  return [config.preferredModel, config.fallbackModel].filter(
    (model): model is string => Boolean(model)
  );
}

const PredictPeakRequestSchema = z
  .object({
    origin: z.string().trim().min(1),
    process: z.string().trim().min(1),
    roastLevel: z.string().trim().min(1),
  })
  .strict();

const PredictPeakResponseSchema = z.object({
  recommendedRestDays: z.number().int().nonnegative(),
  reason: z.string().trim().min(1).max(50),
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
    const apiKey = getGoogleApiKey();
    const modelConfig = getGeminiModelConfig();

    if (!apiKey) {
      return jsonResponse(
        {
          error:
            "Missing Google AI API key. Set GOOGLE_GEMINI_API_KEY or GOOGLE_GENERATIVE_AI_API_KEY.",
        },
        503,
        headers
      );
    }

    const rawBody = (await request.json()) as unknown;
    const { origin: beanOrigin, process, roastLevel } =
      PredictPeakRequestSchema.parse(rawBody);
    const provider = createGoogleGenerativeAI({ apiKey });

    let object: z.infer<typeof PredictPeakResponseSchema> | null = null;
    let lastError: unknown;

    for (const modelName of getModelCandidates(modelConfig)) {
      try {
        const result = await generateObject({
          model: provider(modelName),
          schema: PredictPeakResponseSchema,
          system:
            "Act as a master coffee roaster. Analyze the input to predict resting time.",
          prompt: `你是一位具備科學背景的專業精品咖啡烘豆師。
請根據以下咖啡豆資訊：
- 產區: ${beanOrigin}
- 處理法: ${process}
- 烘焙度: ${roastLevel}

推算最適合的養豆天數。

【輸出規定】
1. reason 欄位必須使用繁體中文（zh-TW）回答。
2. 語氣要專業、簡練、像是在對吧台手說話。
3. 理由請控制在 50 字以內，並點出排氣狀況與風味發展的關鍵。`,
        });

        object = result.object;
        break;
      } catch (error) {
        lastError = error;
      }
    }

    if (!object) {
      throw lastError instanceof Error
        ? lastError
        : new Error("No Gemini model succeeded for peak prediction.");
    }

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
        details:
          process.env.NODE_ENV === "development" && error instanceof Error
            ? error.message
            : undefined,
      },
      500,
      headers
    );
  }
}
