// ================================================================
// Metrics Collector — Phase 11: Instrumentation wrapper
// ================================================================
// Wrap existing LLM/RAG calls to automatically log metrics.
// Existing code continues to work unchanged — metrics are logged as side effects.

import { logRequest, logError } from "@/lib/analytics/db";
import type { LogRequestInput, RequestType, RequestStatus, ErrorType } from "@/lib/analytics/types";

/**
 * Wraps an async operation with metric collection.
 * Returns the operation result while logging timing and status.
 */
export async function withMetrics<T>(
  userId: string,
  requestType: RequestType,
  operation: () => Promise<T>,
  options: {
    repositoryId?: string;
    provider?: string;
    model?: string;
    extractTokens?: (result: T) => { promptTokens?: number; completionTokens?: number; totalTokens?: number };
    extractMetadata?: (result: T) => Record<string, unknown>;
  } = {}
): Promise<T> {
  const start = Date.now();
  try {
    const result = await operation();
    const latencyMs = Date.now() - start;
    const tokens = options.extractTokens?.(result);

    const input: LogRequestInput = {
      requestType,
      status: "success",
      latencyMs,
      repositoryId: options.repositoryId,
      provider: options.provider,
      model: options.model,
      promptTokens: tokens?.promptTokens,
      completionTokens: tokens?.completionTokens,
      totalTokens: tokens?.totalTokens,
      tokensEstimated: !tokens,
      metadata: options.extractMetadata?.(result),
    };

    // Fire-and-forget logging
    logRequest(userId, input).catch(() => {});

    return result;
  } catch (error) {
    const latencyMs = Date.now() - start;
    const err = error as Error & { status?: number };
    let status: RequestStatus = "error";
    let errorType: ErrorType = "unknown";
    let errorMessage = err.message || "Unknown error";

    if (err.status === 429 || errorMessage.includes("RATE_LIMITED")) {
      status = "rate_limited";
      errorType = "rate_limit";
    } else if (errorMessage.includes("timeout") || errorMessage.includes("TIMEOUT")) {
      status = "timeout";
      errorType = "timeout";
    } else if (errorMessage.includes("network") || errorMessage.includes("fetch") || errorMessage.includes("ECONNREFUSED")) {
      errorType = "network_failure";
    } else if (requestType === "rag") {
      errorType = "retrieval_error";
    } else if (requestType === "embedding") {
      errorType = "embedding_error";
    } else {
      errorType = "provider_error";
    }

    const input: LogRequestInput = {
      requestType,
      status,
      latencyMs,
      repositoryId: options.repositoryId,
      provider: options.provider,
      model: options.model,
      errorType,
      errorMessage,
    };

    // Fire-and-forget
    logRequest(userId, input).catch(() => {});
    logError(userId, errorType, errorMessage, {
      repositoryId: options.repositoryId,
      provider: options.provider,
      requestType,
    }).catch(() => {});

    throw error;
  }
}

/**
 * Estimate token count for a string (rough: ~4 chars per token).
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}