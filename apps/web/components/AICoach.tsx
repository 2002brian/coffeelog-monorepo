"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import * as Sentry from "@/lib/sentry";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { Capacitor } from "@capacitor/core";
import { RefreshCw } from "lucide-react";
import ReactMarkdown from "react-markdown";
import type { LocalBrewContext } from "@/lib/db";
import {
  triggerLightImpact,
  triggerWarningNotification,
} from "@/lib/haptics";

type NativeChatResponse = {
  text?: string;
  error?: string;
};

type NativeRequestMessage = {
  id: string;
  role: "user" | "assistant";
  parts: Array<{
    type: "text";
    text: string;
  }>;
};

const NATIVE_LOADING_TOKEN = "__AI_LOADING__";

function getMessageText(message: UIMessage) {
  return message.parts
    .filter((part) => part.type === "text")
    .map((part) => part.text)
    .join("");
}

function serializeConversation(messages: UIMessage[]) {
  return messages
    .map((message) => {
      if (message.role !== "user" && message.role !== "assistant") {
        return null;
      }

      const content = getMessageText(message).trim();
      if (!content || content === NATIVE_LOADING_TOKEN) {
        return null;
      }

      return {
        id: message.id,
        role: message.role,
        parts: [
          {
            type: "text",
            text: content,
          },
        ],
      } satisfies NativeRequestMessage;
    })
    .filter((message): message is NativeRequestMessage => message !== null);
}

type DiagnosticError = {
  title: string;
  summary: string;
  hint: string;
};

function getDiagnosticErrorMessage(error: Error | undefined) {
  if (!error) {
    return null;
  }

  const rawMessage = error.message.trim() || "Unknown error";
  const normalizedMessage = rawMessage.toLowerCase();
  if (
    normalizedMessage.includes("load failed") ||
    normalizedMessage.includes("failed to fetch") ||
    normalizedMessage.includes("network request failed") ||
    normalizedMessage.includes("networkerror")
  ) {
    return {
      title: "咖啡因傳輸中斷",
      summary: "目前沒有順利連上 AI 教練，可能是網路不穩或雲端服務暫時不可達。",
      hint: "請確認網路連線正常後，再試一次。",
    } satisfies DiagnosticError;
  }

  if (
    normalizedMessage.includes("timeout") ||
    normalizedMessage.includes("timed out") ||
    normalizedMessage.includes("aborted") ||
    normalizedMessage.includes("deadline")
  ) {
    return {
      title: "這杯等太久了",
      summary: "AI 教練這次思考時間過長，系統先停止等待，避免畫面一直卡住。",
      hint: "可以直接再試一次，或把問題縮短一點讓回應更穩定。",
    } satisfies DiagnosticError;
  }

  if (
    normalizedMessage.includes("unauthorized") ||
    normalizedMessage.includes("server error") ||
    normalizedMessage.includes("internal server error") ||
    normalizedMessage.includes("500") ||
    normalizedMessage.includes("502") ||
    normalizedMessage.includes("503") ||
    normalizedMessage.includes("504")
  ) {
    return {
      title: "AI 教練暫時忙碌",
      summary: "雲端服務已收到請求，但這次沒有順利完成回應。",
      hint: "這通常是暫時性狀況，稍後按下再試一次即可。",
    } satisfies DiagnosticError;
  }

  return {
    title: "這次建議沒有送達",
    summary: "對話流程中途被打斷了，但你的提問內容還可以重新送出。",
    hint: "請直接再試一次；如果多次失敗，再檢查 Cloud Brain 狀態。",
  } satisfies DiagnosticError;
}

function renderDiagnosticError(
  diagnosticError: ReturnType<typeof getDiagnosticErrorMessage>,
  onRetry: () => void
) {
  if (!diagnosticError) {
    return null;
  }

  return (
    <div className="mt-4 rounded-[24px] border border-white/5 bg-surface-default p-5 text-sm text-text-secondary shadow-[0_14px_30px_rgba(0,0,0,0.34)]">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-2">
          <p className="font-semibold tracking-tight text-text-primary">
            {diagnosticError.title}
          </p>
          <p className="leading-6 text-text-secondary">{diagnosticError.summary}</p>
          <p className="leading-6 text-text-secondary">{diagnosticError.hint}</p>
        </div>
      </div>
      <div className="mt-4">
        <button
          type="button"
          onClick={onRetry}
          className="inline-flex items-center justify-center gap-2 rounded-full border border-primary-default bg-primary-default px-4 py-2 text-sm font-semibold text-white transition-all duration-300 hover:-translate-y-0.5 hover:brightness-110 active:scale-95"
        >
          <RefreshCw className="h-4 w-4" />
          <span>再試一次</span>
        </button>
      </div>
    </div>
  );
}

export default function AICoach({
  localContext,
}: {
  localContext: LocalBrewContext;
}) {
  const chatEndpoint = process.env.NEXT_PUBLIC_AI_CHAT_ENDPOINT;
  const [input, setInput] = useState("");
  const [nativeMessages, setNativeMessages] = useState<UIMessage[]>([]);
  const [nativeError, setNativeError] = useState<Error | undefined>();
  const [lastSubmittedText, setLastSubmittedText] = useState<string | null>(null);
  const isNativePlatform = useMemo(() => Capacitor.isNativePlatform(), []);

  const transport = useMemo(() => {
    if (!chatEndpoint || isNativePlatform) {
      return undefined;
    }

    return new DefaultChatTransport({
      api: chatEndpoint,
    });
  }, [chatEndpoint, isNativePlatform]);

  const {
    messages: webMessages,
    sendMessage,
    regenerate,
    status: webStatus,
    error: webError,
  } = useChat({
    transport,
  });

  const messages = isNativePlatform ? nativeMessages : webMessages;
  const activeError = isNativePlatform ? nativeError : webError;
  const isLoading =
    isNativePlatform
      ? nativeMessages.at(-1)?.role === "assistant" &&
        getMessageText(nativeMessages.at(-1) as UIMessage) ===
          NATIVE_LOADING_TOKEN
      : webStatus === "submitted" || webStatus === "streaming";
  const canSubmit = !isLoading && input.trim().length > 0 && !!chatEndpoint;
  const diagnosticError = getDiagnosticErrorMessage(activeError);

  useEffect(() => {
    if (!activeError) {
      return;
    }

    void triggerWarningNotification();
  }, [activeError]);

  useEffect(() => {
    if (isNativePlatform || !webError) {
      return;
    }

    Sentry.captureException(webError, {
      tags: {
        feature: "ai_coach",
        channel: "web",
      },
    });
  }, [isNativePlatform, webError]);

  async function sendNativeMessage(
    userText: string,
    options?: { retry?: boolean }
  ) {
    if (!chatEndpoint) {
      await triggerWarningNotification();
      return;
    }

    const isRetry = options?.retry === true;
    const userMessage: UIMessage = {
      id: crypto.randomUUID(),
      role: "user",
      parts: [{ type: "text", text: userText }],
    };

    const pendingAssistantMessage: UIMessage = {
      id: crypto.randomUUID(),
      role: "assistant",
      parts: [{ type: "text", text: NATIVE_LOADING_TOKEN }],
    };

    setNativeError(undefined);
    setLastSubmittedText(userText);
    const nextConversation = serializeConversation(
      isRetry ? nativeMessages : [...nativeMessages, userMessage]
    );

    setNativeMessages((currentMessages) =>
      isRetry
        ? [...currentMessages, pendingAssistantMessage]
        : [...currentMessages, userMessage, pendingAssistantMessage]
    );

    const controller = new AbortController();
    let didTimeout = false;
    const timeoutId = window.setTimeout(() => {
      didTimeout = true;
      controller.abort();
    }, 15000);

    try {
      const response = await fetch(chatEndpoint, {
        method: "POST",
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messages: nextConversation,
          localContext,
          isStream: false,
        }),
      });

      const payload = (await response.json()) as NativeChatResponse;

      if (!response.ok) {
        throw new Error(payload.error || "Native AI request failed");
      }

      const assistantText = payload.text?.trim();

      if (!assistantText) {
        throw new Error("Cloud Brain returned an empty response");
      }

      setNativeMessages((currentMessages) =>
        currentMessages.map((message) =>
          message.id === pendingAssistantMessage.id
            ? {
                ...message,
                parts: [{ type: "text", text: assistantText }],
              }
            : message
        )
      );
    } catch (error) {
      const isAbortError =
        didTimeout ||
        (error instanceof DOMException && error.name === "AbortError");
      const resolvedError =
        isAbortError
          ? new Error("Request timeout")
          : error instanceof Error
            ? error
            : new Error("Native AI request failed");

      if (isAbortError) {
        Sentry.captureMessage("AICoach native request timed out", {
          level: "warning",
          tags: {
            feature: "ai_coach",
            channel: "native",
          },
        });
      } else {
        Sentry.captureException(resolvedError, {
          tags: {
            feature: "ai_coach",
            channel: "native",
          },
          extra: {
            messageCount: nextConversation.length,
          },
        });
      }

      setNativeError(resolvedError);
      await triggerWarningNotification();
      setNativeMessages((currentMessages) =>
        currentMessages.filter(
          (message) => message.id !== pendingAssistantMessage.id
        )
      );
    } finally {
      window.clearTimeout(timeoutId);
    }
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const userText = input.trim();
    if (!userText || !chatEndpoint || isLoading) {
      if (!chatEndpoint) {
        await triggerWarningNotification();
      }
      return;
    }

    await triggerLightImpact();
    setInput("");
    setLastSubmittedText(userText);

    if (isNativePlatform) {
      await sendNativeMessage(userText);
      return;
    }

    await sendMessage(
      { text: userText },
      {
        body: {
          localContext,
          isStream: true,
        },
      }
    );
  }

  async function handleRetry() {
    if (!chatEndpoint || isLoading) {
      return;
    }

    await triggerLightImpact();

    if (isNativePlatform) {
      if (!lastSubmittedText) {
        return;
      }

      await sendNativeMessage(lastSubmittedText, { retry: true });
      return;
    }

    await regenerate({
      body: {
        localContext,
        isStream: true,
      },
    });
  }

  return (
    <section className="rounded-xl border border-white/5 bg-surface-default p-4 shadow-[0_14px_30px_rgba(0,0,0,0.34),inset_0_1px_0_rgba(255,255,255,0.04)]">
      <header className="mb-4 space-y-1.5">
        <h2 className="text-xl font-bold tracking-tight text-text-primary">
          AI 教練對話
        </h2>
        <p className="text-sm leading-6 text-text-secondary">
          直接針對這杯的沖煮表現提問，取得即時調整建議。
        </p>
      </header>

      <div className="h-[320px] overflow-y-auto rounded-xl border border-white/5 bg-bg-base p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
        {messages.length === 0 ? (
          <div className="flex h-full items-center justify-center text-center text-sm leading-7 text-text-secondary">
            先問 AI 一個具體問題，例如「這杯偏酸而且薄，下次先改哪個參數？」
          </div>
        ) : (
          <div className="space-y-3">
            {messages.map((message) => {
              const text = getMessageText(message);
              const isLoadingBubble =
                message.role === "assistant" &&
                isLoading &&
                (text === "" || text === NATIVE_LOADING_TOKEN);

              return (
                <div
                  key={message.id}
                  className={`flex ${
                    message.role === "user" ? "justify-end" : "justify-start"
                  }`}
                >
                  <div
                    className={`max-w-[85%] rounded-xl px-4 py-3 text-sm leading-7 shadow-[0_10px_24px_rgba(0,0,0,0.24)] ${
                      message.role === "user"
                        ? "border border-primary-default/40 bg-primary-default text-white"
                        : "border border-white/5 bg-surface-elevated text-text-primary"
                    }`}
                  >
                    {message.role === "user" ? (
                      <div className="selectable-text whitespace-pre-wrap">
                        {text}
                      </div>
                    ) : isLoadingBubble ? (
                      <div className="flex min-h-9 items-center">
                        <div className="inline-flex items-center gap-2 rounded-full border border-white/5 bg-surface-default px-3 py-2 text-text-primary">
                          <span className="sr-only">AI 正在思考中</span>
                          <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-primary-default [animation-delay:0ms]" />
                          <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-primary-default/80 [animation-delay:180ms]" />
                          <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-text-primary/70 [animation-delay:360ms]" />
                        </div>
                      </div>
                    ) : (
                      <div className="selectable-text prose prose-sm max-w-none leading-relaxed text-text-secondary prose-p:my-2 prose-headings:mb-2 prose-headings:mt-4 prose-headings:font-bold prose-headings:tracking-tight prose-headings:text-text-primary prose-h1:text-lg prose-h2:text-base prose-h3:text-[0.95rem] prose-h3:font-semibold prose-p:text-text-secondary prose-strong:font-bold prose-strong:text-text-primary prose-li:my-0.5 prose-ul:my-2 prose-ol:my-2 prose-ul:pl-5 prose-ol:pl-5 prose-li:text-text-secondary prose-li:marker:text-text-secondary prose-blockquote:my-3 prose-blockquote:rounded-2xl prose-blockquote:border-l-4 prose-blockquote:border-primary-default prose-blockquote:bg-bg-base/70 prose-blockquote:px-4 prose-blockquote:py-3 prose-blockquote:font-normal prose-blockquote:not-italic prose-blockquote:text-text-secondary prose-hr:my-4 prose-hr:border-border-subtle prose-table:my-4 prose-table:w-full prose-table:table-fixed prose-table:overflow-hidden prose-table:rounded-2xl prose-table:border prose-table:border-border-subtle prose-table:bg-bg-base/70 prose-thead:border-b prose-thead:border-border-subtle prose-th:bg-surface-default prose-th:px-3 prose-th:py-2 prose-th:text-left prose-th:text-xs prose-th:font-semibold prose-th:uppercase prose-th:tracking-wide prose-th:text-text-secondary prose-td:px-3 prose-td:py-2 prose-td:text-sm prose-td:text-text-secondary prose-tr:border-b prose-tr:border-border-subtle last:prose-tr:border-b-0 prose-code:rounded prose-code:bg-bg-base/70 prose-code:px-1 prose-code:text-text-primary prose-code:before:content-none prose-code:after:content-none">
                        <ReactMarkdown>
                          {text}
                        </ReactMarkdown>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {!chatEndpoint ? (
        <p className="mt-4 text-sm text-red-300">
          缺少 `NEXT_PUBLIC_AI_CHAT_ENDPOINT`，目前無法連線至雲端 AI 服務。
        </p>
      ) : null}

      {renderDiagnosticError(diagnosticError, handleRetry)}

      <form
        onSubmit={onSubmit}
        className="mt-6 flex items-end gap-3 rounded-[28px] border border-white/5 bg-surface-elevated p-3 shadow-[0_14px_30px_rgba(0,0,0,0.34)] transition focus-within:ring-2 focus-within:ring-glow-indigo/35"
      >
        <input
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder="輸入你想問 AI 教練的問題..."
          className="selectable-text min-w-0 flex-1 bg-transparent px-3 py-2 text-sm text-text-primary placeholder:text-text-secondary focus-visible:outline-none"
        />
        <button
          type="submit"
          disabled={!canSubmit}
          className="inline-flex h-11 items-center justify-center rounded-full border border-primary-default bg-primary-default px-5 text-sm font-semibold text-white shadow-[0_16px_34px_rgba(94,67,255,0.28)] transition-all duration-300 hover:-translate-y-0.5 hover:brightness-110 active:scale-95 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isLoading ? "回應中" : "送出"}
        </button>
      </form>
    </section>
  );
}
