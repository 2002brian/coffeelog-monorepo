import {
  GoogleGenerativeAI,
  TaskType,
} from "@google/generative-ai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createClient } from "@supabase/supabase-js";
import {
  createUIMessageStream,
  createUIMessageStreamResponse,
  generateText,
  streamText,
} from "ai";
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
export const maxDuration = 60;

const DEFAULT_GEMINI_CHAT_MODEL = "gemini-2.5-flash";
const SECONDARY_GEMINI_CHAT_MODEL = "gemini-2.5-flash-lite";
const GEMINI_EMBEDDING_MODEL = "gemini-embedding-001";
const EMBEDDING_DIMENSION = 1536;
const KNOWLEDGE_MATCH_COUNT = 3;
const KNOWLEDGE_SIMILARITY_THRESHOLD = 0.72;
const COACH_TEMPERATURE = 0.2;
const IS_DEVELOPMENT = process.env.NODE_ENV === "development";
const LOCAL_CONTEXT_MAX_DEPTH = 4;
const LOCAL_CONTEXT_MAX_ARRAY_ITEMS = 4;
const LOCAL_CONTEXT_MAX_STRING_LENGTH = 240;
const LOCAL_CONTEXT_MAX_SERIALIZED_LENGTH = 5000;

const ChatPartSchema = z
  .object({
    type: z.string(),
    text: z.string().optional(),
  })
  .passthrough();

const ChatMessageSchema = z
  .object({
    id: z.string().optional(),
    role: z.string(),
    parts: z.array(ChatPartSchema).min(1),
  })
  .passthrough();

const ChatRequestSchema = z.object({
  messages: z.array(ChatMessageSchema).min(1),
  localContext: z.unknown().optional(),
  isStream: z.boolean().optional().default(true),
});

const KnowledgeMatchSchema = z
  .object({
    content: z.string().min(1),
    similarity: z.number().optional(),
    source: z.string().optional(),
    title: z.string().optional(),
    path: z.string().optional(),
  })
  .passthrough();

type ChatMessage = z.infer<typeof ChatMessageSchema>;
type GeminiConfig = {
  apiKey: string;
  chatModel: string;
  fallbackChatModel: string | null;
};
type RagConfig = {
  googleApiKey: string;
  supabaseUrl: string;
  supabaseAnonKey: string;
};
type KnowledgeMatch = z.infer<typeof KnowledgeMatchSchema>;
type RagDebugSummary = {
  query: string;
  ragEnabled: boolean;
  embeddingCreated: boolean;
  retrievedChunkCount: number;
  retrievedSources: string[];
  chatModel: string;
  isStream: boolean;
};

function readRequiredEnv(name: string) {
  return process.env[name]?.trim() ?? "";
}

function getGeminiConfig():
  | { ok: true; config: GeminiConfig }
  | { ok: false; missingKeys: string[]; message: string } {
  const googleApiKey = readRequiredEnv("GOOGLE_GEMINI_API_KEY");

  if (!googleApiKey) {
    return {
      ok: false,
      missingKeys: ["GOOGLE_GEMINI_API_KEY"],
      message:
        "AI 教練目前尚未完成伺服器設定，因此暫時停用。請補齊必要金鑰後再試一次。",
    };
  }

  const preferredChatModel =
    readRequiredEnv("GOOGLE_GEMINI_CHAT_MODEL") ||
    readRequiredEnv("GOOGLE_GEMINI_MODEL") ||
    DEFAULT_GEMINI_CHAT_MODEL;
  const configuredFallbackChatModel = readRequiredEnv(
    "GOOGLE_GEMINI_FALLBACK_MODEL"
  );
  const fallbackChatModel =
    configuredFallbackChatModel && configuredFallbackChatModel !== preferredChatModel
      ? configuredFallbackChatModel
      : preferredChatModel === DEFAULT_GEMINI_CHAT_MODEL
        ? SECONDARY_GEMINI_CHAT_MODEL
        : DEFAULT_GEMINI_CHAT_MODEL;

  return {
    ok: true,
    config: {
      apiKey: googleApiKey,
      chatModel: preferredChatModel,
      fallbackChatModel:
        fallbackChatModel !== preferredChatModel ? fallbackChatModel : null,
    },
  };
}

function getRagConfig(): RagConfig | null {
  const googleApiKey = readRequiredEnv("GOOGLE_GEMINI_API_KEY");
  const supabaseUrl = readRequiredEnv("NEXT_PUBLIC_SUPABASE_URL");
  const supabaseAnonKey = readRequiredEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");

  if (!googleApiKey || !supabaseUrl || !supabaseAnonKey) {
    console.warn(
      "[AI RAG Warning]: Missing environment variables, degrading to no-RAG mode."
    );
    return null;
  }

  return {
    googleApiKey,
    supabaseUrl,
    supabaseAnonKey,
  };
}

function extractText(parts: ChatMessage["parts"]) {
  return parts
    .filter((part) => part.type === "text" && typeof part.text === "string")
    .map((part) => part.text?.trim() ?? "")
    .filter(Boolean)
    .join("\n")
    .trim();
}

function getLastUserQuery(messages: ChatMessage[]) {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];

    if (message.role !== "user") {
      continue;
    }

    const text = extractText(message.parts);

    if (text) {
      return text;
    }
  }

  return "";
}

function truncateText(value: string, maxLength = LOCAL_CONTEXT_MAX_STRING_LENGTH) {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, maxLength - 1)}…`;
}

function sanitizeLocalContextValue(value: unknown, depth = 0): unknown {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === "string") {
    return truncateText(value);
  }

  if (
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return value;
  }

  if (Array.isArray(value)) {
    return value
      .slice(0, LOCAL_CONTEXT_MAX_ARRAY_ITEMS)
      .map((item) => sanitizeLocalContextValue(item, depth + 1));
  }

  if (typeof value === "object") {
    if (depth >= LOCAL_CONTEXT_MAX_DEPTH) {
      return "[truncated]";
    }

    return Object.fromEntries(
      Object.entries(value)
        .filter(([, entryValue]) => entryValue !== null && entryValue !== undefined)
        .filter(([key]) => key !== "id" && !key.endsWith("Id"))
        .map(([key, entryValue]) => [
          key,
          sanitizeLocalContextValue(entryValue, depth + 1),
        ])
    );
  }

  return String(value);
}

function formatLocalContext(localContext: unknown) {
  if (!localContext) {
    return "目前沒有提供這杯的本地沖煮紀錄。";
  }

  const serialized = JSON.stringify(
    sanitizeLocalContextValue(localContext),
    null,
    2
  );

  if (serialized.length <= LOCAL_CONTEXT_MAX_SERIALIZED_LENGTH) {
    return serialized;
  }

  return `${serialized.slice(0, LOCAL_CONTEXT_MAX_SERIALIZED_LENGTH)}\n... (local context truncated)`;
}

function getLocalRecord(localContext: unknown) {
  if (!localContext || typeof localContext !== "object") {
    return null;
  }

  if (
    "record" in localContext &&
    localContext.record &&
    typeof localContext.record === "object"
  ) {
    return localContext.record as Record<string, unknown>;
  }

  return localContext as Record<string, unknown>;
}

function formatLocalEvidenceSignals(localContext: unknown) {
  const record = getLocalRecord(localContext);

  if (!record) {
    return "目前沒有可引用的本地感官分數或沖煮參數。";
  }

  const lines: string[] = [];

  if (typeof record.sweetness === "number") {
    lines.push(`甜感: ${record.sweetness}/5`);
  }

  if (typeof record.acidity === "number") {
    lines.push(`酸感: ${record.acidity}/5`);
  }

  if (typeof record.body === "number") {
    lines.push(`厚醇度: ${record.body}/5`);
  }

  if (typeof record.bitterness === "number") {
    lines.push(`苦感: ${record.bitterness}/5`);
  }

  if (typeof record.temperature === "number") {
    lines.push(`水溫: ${record.temperature}°C`);
  }

  if (typeof record.brewTime === "number") {
    lines.push(`總時間: ${record.brewTime} 秒`);
  }

  if (typeof record.dose === "number" && typeof record.water === "number") {
    lines.push(`粉水比: ${record.dose}g / ${record.water}g`);
  }

  if (typeof record.grindSize === "string" && record.grindSize.trim()) {
    lines.push(`研磨: ${record.grindSize.trim()}`);
  }

  return lines.length > 0
    ? lines.join("\n")
    : "目前沒有可引用的本地感官分數或沖煮參數。";
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

function isGeminiHighDemandError(message: string) {
  return (
    /503/.test(message) ||
    /service unavailable/i.test(message) ||
    /high demand/i.test(message) ||
    /try again later/i.test(message)
  );
}

function isGeminiRateLimitError(message: string) {
  return (
    /429/.test(message) ||
    /rate limit/i.test(message) ||
    /quota/i.test(message) ||
    /resource exhausted/i.test(message)
  );
}

function isGeminiContextTooLargeError(message: string) {
  return (
    /token/i.test(message) ||
    /context/i.test(message) ||
    /too large/i.test(message) ||
    /too many/i.test(message) ||
    /request payload/i.test(message) ||
    /invalid argument/i.test(message)
  );
}

function shouldRetryWithFallback(error: unknown) {
  const message = getErrorMessage(error);

  return isGeminiHighDemandError(message) || isGeminiRateLimitError(message);
}

function toFriendlyErrorMessage(error: unknown) {
  if (error instanceof z.ZodError) {
    return "AI 請求格式不正確，請重新整理後再試一次。";
  }

  const message = getErrorMessage(error);

  if (isGeminiHighDemandError(message) || isGeminiRateLimitError(message)) {
    return "AI 教練目前較忙，這次沒有順利完成回應。請稍後再試一次。";
  }

  if (isGeminiContextTooLargeError(message)) {
    return "這次附帶的本地沖煮資訊太多，系統已縮減內容。請重新再試一次。";
  }

  return "AI 教練暫時無法提供建議，請稍後再試一次。";
}

function ensureGeneratedText(text: string, model: string) {
  const trimmed = text.trim();

  if (!trimmed) {
    throw new Error(`Model "${model}" returned an empty response`);
  }

  return trimmed;
}

function buildResponseHeaders(
  origin: string | null,
  extraHeaders?: HeadersInit
) {
  const headers = new Headers(buildCorsHeaders(origin));

  if (!extraHeaders) {
    return headers;
  }

  const merged = new Headers(extraHeaders);

  merged.forEach((value, key) => {
    headers.set(key, value);
  });

  return headers;
}

function toModelMessages(messages: ChatMessage[]) {
  return messages.flatMap((message) => {
    const text = extractText(message.parts);

    if (!text) {
      return [];
    }

    if (message.role !== "user" && message.role !== "assistant") {
      return [];
    }

    return [
      {
        role: message.role,
        content: text,
      } as const,
    ];
  });
}

function getChatModelCandidates(config: GeminiConfig) {
  return [config.chatModel, config.fallbackChatModel].filter(
    (modelName, index, models): modelName is string =>
      Boolean(modelName) && models.indexOf(modelName) === index
  );
}

async function createGeminiEmbedding(
  query: string,
  ragConfig: RagConfig
): Promise<number[] | null> {
  try {
    const google = new GoogleGenerativeAI(ragConfig.googleApiKey);
    const model = google.getGenerativeModel({
      model: GEMINI_EMBEDDING_MODEL,
    });

    const result = await model.embedContent({
      content: {
        role: "user",
        parts: [{ text: query }],
      },
      taskType: TaskType.RETRIEVAL_QUERY,
      outputDimensionality: EMBEDDING_DIMENSION,
    } as Parameters<typeof model.embedContent>[0] & {
      outputDimensionality: number;
    });

    const values = result.embedding.values;

    if (
      !Array.isArray(values) ||
      values.length !== EMBEDDING_DIMENSION ||
      values.some((value) => !Number.isFinite(value))
    ) {
      throw new Error("Gemini embedding returned an invalid vector.");
    }

    return values;
  } catch (error) {
    console.error("[AI RAG] Gemini embedding failed:", error);
    return null;
  }
}

async function retrieveKnowledgeMatches(
  embedding: number[],
  ragConfig: RagConfig
): Promise<KnowledgeMatch[]> {
  const supabase = createClient(ragConfig.supabaseUrl, ragConfig.supabaseAnonKey);

  const rpcPayloads = [
    {
      query_embedding: embedding,
      match_count: KNOWLEDGE_MATCH_COUNT,
      similarity_threshold: KNOWLEDGE_SIMILARITY_THRESHOLD,
    },
    {
      query_embedding: embedding,
      match_count: KNOWLEDGE_MATCH_COUNT,
      match_threshold: KNOWLEDGE_SIMILARITY_THRESHOLD,
    },
    {
      query_embedding: embedding,
      match_count: KNOWLEDGE_MATCH_COUNT,
    },
  ];

  for (const payload of rpcPayloads) {
    try {
      const { data, error } = await supabase.rpc(
        "match_knowledge_chunks",
        payload
      );

      if (error) {
        throw error;
      }

      const parsed = z.array(KnowledgeMatchSchema).safeParse(data ?? []);

      if (!parsed.success) {
        throw parsed.error;
      }

      return parsed.data;
    } catch (error) {
      console.error("[AI RAG] Supabase retrieval attempt failed:", error);
    }
  }

  return [];
}

function formatKnowledgeContext(matches: KnowledgeMatch[]) {
  if (matches.length === 0) {
    return "目前沒有檢索到可用的咖啡知識片段。";
  }

  return matches
    .map((match, index) => {
      const label =
        match.title || match.source || match.path || `知識片段 ${index + 1}`;

      return [`### ${label}`, match.content.trim()].filter(Boolean).join("\n");
    })
    .join("\n\n");
}

function formatContextPrompt({
  knowledgeMatches,
  localContext,
}: {
  knowledgeMatches: KnowledgeMatch[];
  localContext: unknown;
}) {
  return [
    "<ROLE_AND_TONE>",
    "你是 CoffeeLog 的冠軍級沖煮教練。",
    "語氣必須直接、冷靜、專業、短句、零廢話。",
    "禁止寒暄、禁止鼓勵語、禁止客套、禁止過渡句、禁止任何 filler words。",
    "只回答咖啡、沖煮技術、咖啡豆、水質、器材與感官品鑑相關問題。",
    "分析風味時只能使用：甜感、酸感、苦感、厚醇度。",
    "禁止使用「明亮」、「均衡」等模糊詞。",
    "</ROLE_AND_TONE>",
    "",
    "<DECISION_POLICY>",
    "優先信任 KNOWLEDGE_CONTEXT，其次才使用通用專業知識。",
    "不可捏造數據、參數、來源或知識片段。",
    "診斷必須先下判斷，再描述結果。不要只重述症狀。",
    "優先把診斷落在：萃取不足、萃取偏高、流速過快、濃度過低、粉水接觸不足、溶出不足，或其他等價的沖煮機制。",
    "如果 LOCAL_EVIDENCE_SIGNALS 有分數或參數，診斷必須優先引用其中最明確的 1 到 2 個跡象。",
    "如果資訊不足，也要做出最合理的單一判斷，不要給多個方案。",
    "CRITICAL: NEVER provide a secondary fix. Strictly prescribe ONE single actionable variable adjustment.",
    "只允許提出一個最高優先級的可操作調整，不得列出備選方案，不得附加『也可以』、『另一種作法』、『如果不行再』。",
    "下一步只能改一個變因，並明確說其餘參數先維持不變。",
    "如果 grinder click / notch 不存在，就只使用『一格』這種穩定描述，不要假裝更精準。",
    "診斷與處方方向必須一致，不得互相矛盾。",
    "如果判斷為萃取不足、流速過快、甜感低且酸感高，優先使用『調細一格』這類提高萃取的指令，不可改成調粗。",
    "如果判斷為萃取偏高、苦感高、乾澀、厚重而甜感被壓住，優先使用『調粗一格』這類降低萃取的指令。",
    "描述研磨方向時，只能使用『調細』或『調粗』，不要使用『提高研磨度』或『降低研磨度』。",
    "</DECISION_POLICY>",
    "",
    "<OUTPUT_CONTRACT>",
    "MUST ONLY output these exact markdown headings in this exact order:",
    "### 診斷",
    "### 下一步",
    "### 原因",
    "Each heading must appear exactly once.",
    "Do not add parentheses.",
    "Do not add English translations.",
    "Do not add extra headings.",
    "Do not add greetings.",
    "Do not add filler words.",
    "Do not add bullet lists or numbered lists.",
    "Under each heading, write only 1 to 2 short sentences.",
    "### 診斷 must identify the brewing mechanism, not only the flavor symptom.",
    "### 下一步 must contain exactly one imperative instruction and explicitly state that the other variables stay unchanged.",
    "### 原因 must explain why this single adjustment works and what sensory shift the user should expect in the next cup.",
    "Do not append trailing notes, summaries, or sign-offs.",
    "</OUTPUT_CONTRACT>",
    "",
    "<KNOWLEDGE_CONTEXT>",
    formatKnowledgeContext(knowledgeMatches),
    "</KNOWLEDGE_CONTEXT>",
    "",
    "<LOCAL_EVIDENCE_SIGNALS>",
    formatLocalEvidenceSignals(localContext),
    "</LOCAL_EVIDENCE_SIGNALS>",
    "",
    "<LOCAL_BREW_CONTEXT>",
    formatLocalContext(localContext),
    "</LOCAL_BREW_CONTEXT>",
  ].join("\n");
}

function logRagSummary(summary: RagDebugSummary) {
  const sourcePreview =
    summary.retrievedSources.length > 0
      ? summary.retrievedSources.join(", ")
      : "none";

  console.info(
    [
      "[AI RAG]",
      `query="${summary.query}"`,
      `isStream=${summary.isStream}`,
      `ragEnabled=${summary.ragEnabled}`,
      `embeddingCreated=${summary.embeddingCreated}`,
      `chunks=${summary.retrievedChunkCount}`,
      `sources=${sourcePreview}`,
      `chatModel=${summary.chatModel}`,
    ].join(" ")
  );
}

function buildRagDebugHeaders(summary: RagDebugSummary) {
  if (!IS_DEVELOPMENT) {
    return undefined;
  }

  return {
    "x-ai-rag-enabled": String(summary.ragEnabled),
    "x-ai-rag-embedding-created": String(summary.embeddingCreated),
    "x-ai-rag-chunk-count": String(summary.retrievedChunkCount),
    "x-ai-rag-sources": summary.retrievedSources.join("|").slice(0, 512),
    "x-ai-rag-chat-model": summary.chatModel,
    "x-ai-rag-stream": String(summary.isStream),
  };
}

export async function OPTIONS(request: Request) {
  const origin = request.headers.get("origin");
  logCorsCheck(origin);

  if (!isAllowedOrigin(origin)) {
    return blockedOriginResponse(origin);
  }

  return new Response(null, {
    status: 204,
    headers: buildCorsHeaders(origin),
  });
}

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  logCorsCheck(origin);

  if (!isAllowedOrigin(origin)) {
    return blockedOriginResponse(origin);
  }

  const corsHeaders = buildResponseHeaders(origin);

  try {
    const json = await request.json();
    const { messages, localContext, isStream } = ChatRequestSchema.parse(json);
    const userQuery = getLastUserQuery(messages);

    if (!userQuery) {
      return jsonResponse(
        { error: "缺少最新的使用者問題，無法產生建議。" },
        400,
        corsHeaders
      );
    }

    const configResult = getGeminiConfig();

    if (!configResult.ok) {
      return jsonResponse(
        {
          error: configResult.message,
          missingKeys: configResult.missingKeys,
        },
        503,
        corsHeaders
      );
    }

    const ragConfig = getRagConfig();
    let knowledgeMatches: KnowledgeMatch[] = [];
    let embeddingCreated = false;

    if (ragConfig) {
      const embedding = await createGeminiEmbedding(userQuery, ragConfig);

      if (embedding) {
        embeddingCreated = true;
        knowledgeMatches = await retrieveKnowledgeMatches(embedding, ragConfig);
      }
    }

    const provider = createGoogleGenerativeAI({
      apiKey: configResult.config.apiKey,
    });
    const systemPrompt = formatContextPrompt({
      knowledgeMatches,
      localContext,
    });
    const modelMessages = toModelMessages(messages);

    if (modelMessages.length === 0) {
      return jsonResponse(
        { error: "缺少可用的聊天訊息內容，無法產生建議。" },
        400,
        corsHeaders
      );
    }

    const summary = {
      query: userQuery,
      isStream,
      ragEnabled: ragConfig !== null,
      embeddingCreated,
      retrievedChunkCount: knowledgeMatches.length,
      retrievedSources: knowledgeMatches.map(
        (match) => match.title || match.source || match.path || "untitled"
      ),
      chatModel: configResult.config.chatModel,
    } satisfies RagDebugSummary;

    if (!isStream) {
      let text = "";
      let lastError: unknown;

      for (const modelName of getChatModelCandidates(configResult.config)) {
        try {
          const result = await generateText({
            model: provider(modelName),
            system: systemPrompt,
            messages: modelMessages,
            temperature: COACH_TEMPERATURE,
          });
          text = ensureGeneratedText(result.text, modelName);
          break;
        } catch (error) {
          lastError = error;

          if (
            modelName !== configResult.config.chatModel ||
            !configResult.config.fallbackChatModel ||
            !shouldRetryWithFallback(error)
          ) {
            throw error;
          }

          console.warn("[AI Chat] Primary Gemini model failed, retrying fallback.", {
            primaryModel: configResult.config.chatModel,
            fallbackModel: configResult.config.fallbackChatModel,
            reason: getErrorMessage(error),
          });
        }
      }

      if (!text) {
        throw lastError instanceof Error ? lastError : new Error("Empty AI response");
      }

      logRagSummary(summary);

      return jsonResponse(
        { text },
        200,
        buildResponseHeaders(origin, buildRagDebugHeaders(summary))
      );
    }

    logRagSummary(summary);

    const stream = createUIMessageStream({
      async execute({ writer }) {
        let lastError: unknown;

        for (const modelName of getChatModelCandidates(configResult.config)) {
          let streamedText = "";
          let activeTextId: string | null = null;
          let didEnd = false;

          try {
            const result = streamText({
              model: provider(modelName),
              system: systemPrompt,
              messages: modelMessages,
              temperature: COACH_TEMPERATURE,
            });

            for await (const chunk of result.fullStream) {
              if (chunk.type === "text-start") {
                activeTextId = chunk.id;
                writer.write({
                  type: "text-start",
                  id: chunk.id,
                });
                continue;
              }

              if (chunk.type === "text-delta") {
                if (!chunk.text) {
                  continue;
                }

                streamedText += chunk.text;
                writer.write({
                  type: "text-delta",
                  id: chunk.id,
                  delta: chunk.text,
                });
                continue;
              }

              if (chunk.type === "text-end") {
                activeTextId = chunk.id;
                didEnd = true;
                writer.write({
                  type: "text-end",
                  id: chunk.id,
                });
                continue;
              }

              if (chunk.type === "error") {
                throw chunk.error;
              }

              if (chunk.type === "abort") {
                throw new Error(chunk.reason ?? "Gemini stream aborted.");
              }
            }

            if (!streamedText.trim()) {
              const finalText = ensureGeneratedText(await result.text, modelName);
              const textId = activeTextId ?? crypto.randomUUID();

              if (!activeTextId) {
                writer.write({
                  type: "text-start",
                  id: textId,
                });
              }

              writer.write({
                type: "text-delta",
                id: textId,
                delta: finalText,
              });
              writer.write({
                type: "text-end",
                id: textId,
              });
            } else if (!didEnd && activeTextId) {
              writer.write({
                type: "text-end",
                id: activeTextId,
              });
            }

            return;
          } catch (error) {
            lastError = error;

            if (streamedText.trim()) {
              console.warn(
                "[AI Chat] Gemini stream interrupted after partial output; closing stream gracefully.",
                {
                  model: modelName,
                  reason: getErrorMessage(error),
                }
              );
              if (activeTextId && !didEnd) {
                writer.write({
                  type: "text-end",
                  id: activeTextId,
                });
              }
              return;
            }

            if (
              modelName === configResult.config.chatModel &&
              configResult.config.fallbackChatModel &&
              shouldRetryWithFallback(error)
            ) {
              console.warn("[AI Chat] Primary Gemini model stream failed, retrying fallback.", {
                primaryModel: configResult.config.chatModel,
                fallbackModel: configResult.config.fallbackChatModel,
                reason: getErrorMessage(error),
              });
              continue;
            }

            console.error("[AI Chat] Gemini stream failed:", error);
            Sentry.captureException(error, {
              tags: {
                feature: "ai_chat_route",
                stage: "stream",
              },
              extra: {
                model: modelName,
              },
            });
            throw error;
          }
        }

        throw lastError instanceof Error
          ? lastError
          : new Error("Gemini stream ended without a response.");
      },
      onError: toFriendlyErrorMessage,
    });

    return createUIMessageStreamResponse({
      headers: buildResponseHeaders(origin, buildRagDebugHeaders(summary)),
      stream,
    });
  } catch (error) {
    Sentry.captureException(error, {
      tags: {
        feature: "ai_chat_route",
        stage: "request",
      },
    });

    return jsonResponse(
      { error: toFriendlyErrorMessage(error) },
      500,
      corsHeaders
    );
  }
}
