// ================================================================
// Analytics DB Layer — Phase 11: AI Engineering Dashboard & Observability
// ================================================================

import { createClient } from "@/lib/supabase/server";
import type {
  RequestMetric, LogRequestInput, ProviderStats, ProviderHealth,
  ErrorLog, DashboardSnapshot, ConversationSession, DashboardOverview,
  TokenAnalytics, RAGAnalytics, EmbeddingAnalytics, TimelineDataPoint,
  ConversationAnalytics, CostEstimate, CostConfig, SystemHealth,
  SystemHealthItem, HealthStatus, ErrorType, TimeGranularity, AIEngineeringReport,
  RequestType, RequestStatus,
} from "./types";

// --- Request Metrics CRUD ---

export async function logRequest(userId: string, input: LogRequestInput): Promise<RequestMetric | null> {
  const supabase = await createClient();

  const row = {
    user_id: userId,
    repository_id: input.repositoryId ?? null,
    request_type: input.requestType,
    provider: input.provider ?? null,
    model: input.model ?? null,
    status: input.status,
    latency_ms: input.latencyMs ?? null,
    prompt_tokens: input.promptTokens ?? null,
    completion_tokens: input.completionTokens ?? null,
    total_tokens: input.totalTokens ?? null,
    tokens_estimated: input.tokensEstimated ?? false,
    error_type: input.errorType ?? null,
    error_message: input.errorMessage ?? null,
    metadata: input.metadata ?? {},
  };

  const { data, error } = await supabase
    .from("ai_request_metrics")
    .insert(row)
    .select()
    .single();

  if (error) {
    if (error.code === "42P01") return null; // table doesn't exist yet
    console.error("Failed to log request metric:", error.message);
    return null;
  }

  // Fire-and-forget: update provider stats
  updateProviderStats(userId, input).catch(() => {});

  return mapRequestMetric(data);
}

export async function getRequestMetrics(
  userId: string,
  options?: { limit?: number; requestType?: string; days?: number }
): Promise<RequestMetric[]> {
  const supabase = await createClient();
  let query = supabase
    .from("ai_request_metrics")
    .select("*")
    .eq("user_id", userId);

  if (options?.requestType) {
    query = query.eq("request_type", options.requestType);
  }
  if (options?.days) {
    const since = new Date(Date.now() - options.days * 86400000).toISOString();
    query = query.gte("created_at", since);
  }

  query = query.order("created_at", { ascending: false }).limit(options?.limit ?? 100);

  const { data, error } = await query;
  if (error) {
    if (error.code === "42P01") return [];
    throw new Error(`Failed to fetch request metrics: ${error.message}`);
  }
  return (data ?? []).map(mapRequestMetric);
}

// --- Provider Statistics ---

async function updateProviderStats(userId: string, input: LogRequestInput): Promise<void> {
  const supabase = await createClient();
  if (!input.provider || !input.model) return;

  const { data: existing } = await supabase
    .from("provider_statistics")
    .select("*")
    .eq("user_id", userId)
    .eq("provider", input.provider)
    .eq("model", input.model)
    .single();

  const isSuccess = input.status === "success";
  const isFailure = input.status === "error";
  const isRateLimited = input.status === "rate_limited";

  if (existing) {
    const prev = existing as Record<string, unknown>;
    const prevTotal = (prev.total_requests as number) || 0;
    const newAvg = prevTotal === 0
      ? (input.latencyMs ?? 0)
      : ((prev.avg_latency_ms as number) * prevTotal + (input.latencyMs ?? 0)) / (prevTotal + 1);

    const updateData: Record<string, unknown> = {
      total_requests: prevTotal + 1,
      successful_requests: (prev.successful_requests as number) + (isSuccess ? 1 : 0),
      failed_requests: (prev.failed_requests as number) + (isFailure ? 1 : 0),
      rate_limited_requests: (prev.rate_limited_requests as number) + (isRateLimited ? 1 : 0),
      total_prompt_tokens: (prev.total_prompt_tokens as number) + (input.promptTokens ?? 0),
      total_completion_tokens: (prev.total_completion_tokens as number) + (input.completionTokens ?? 0),
      total_tokens: (prev.total_tokens as number) + (input.totalTokens ?? 0),
      tokens_estimated: input.tokensEstimated ?? false,
      avg_latency_ms: Math.round(newAvg * 100) / 100,
      min_latency_ms: prevTotal === 0
        ? (input.latencyMs ?? 0)
        : Math.min(prev.min_latency_ms as number, input.latencyMs ?? 0),
      max_latency_ms: prevTotal === 0
        ? (input.latencyMs ?? 0)
        : Math.max(prev.max_latency_ms as number, input.latencyMs ?? 0),
      last_request_at: new Date().toISOString(),
    };

    if (isSuccess) updateData.last_success_at = new Date().toISOString();
    if (isFailure || isRateLimited) updateData.last_failure_at = new Date().toISOString();

    await supabase
      .from("provider_statistics")
      .update(updateData)
      .eq("id", prev.id);
  } else {
    await supabase.from("provider_statistics").insert({
      user_id: userId,
      provider: input.provider,
      model: input.model,
      total_requests: 1,
      successful_requests: isSuccess ? 1 : 0,
      failed_requests: isFailure ? 1 : 0,
      rate_limited_requests: isRateLimited ? 1 : 0,
      total_prompt_tokens: input.promptTokens ?? 0,
      total_completion_tokens: input.completionTokens ?? 0,
      total_tokens: input.totalTokens ?? 0,
      tokens_estimated: input.tokensEstimated ?? false,
      avg_latency_ms: input.latencyMs ?? 0,
      min_latency_ms: input.latencyMs ?? 0,
      max_latency_ms: input.latencyMs ?? 0,
      last_success_at: isSuccess ? new Date().toISOString() : null,
      last_failure_at: (isFailure || isRateLimited) ? new Date().toISOString() : null,
      last_request_at: new Date().toISOString(),
    });
  }
}

export async function getProviderStats(userId: string): Promise<ProviderStats[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("provider_statistics")
    .select("*")
    .eq("user_id", userId)
    .order("last_request_at", { ascending: false });

  if (error) {
    if (error.code === "42P01") return [];
    throw new Error(`Failed to fetch provider stats: ${error.message}`);
  }
  return (data ?? []).map(mapProviderStat);
}

export function computeProviderHealth(stats: ProviderStats): ProviderHealth {
  if (stats.totalRequests === 0) {
    return {
      provider: stats.provider,
      model: stats.model,
      status: "unknown",
      avgLatencyMs: 0,
      totalRequests: 0,
      successRate: 0,
      errorRate: 0,
      lastSuccessAt: null,
      lastFailureAt: null,
    };
  }

  const successRate = stats.successfulRequests / stats.totalRequests;
  const errorRate = (stats.failedRequests + stats.rateLimitedRequests) / stats.totalRequests;
  const now = Date.now();
  const lastSuccessAge = stats.lastSuccessAt ? now - new Date(stats.lastSuccessAt).getTime() : Infinity;
  const lastFailureAge = stats.lastFailureAt ? now - new Date(stats.lastFailureAt).getTime() : Infinity;

  let status: ProviderHealth["status"] = "healthy";
  if (successRate < 0.5) status = "critical";
  else if (successRate < 0.8 || errorRate > 0.2) status = "warning";
  else if (lastFailureAge < 300000 && lastFailureAge < lastSuccessAge) status = "warning"; // recent failure

  return {
    provider: stats.provider,
    model: stats.model,
    status,
    avgLatencyMs: stats.avgLatencyMs,
    totalRequests: stats.totalRequests,
    successRate: Math.round(successRate * 10000) / 100,
    errorRate: Math.round(errorRate * 10000) / 100,
    lastSuccessAt: stats.lastSuccessAt,
    lastFailureAt: stats.lastFailureAt,
  };
}

// --- Error Logs ---

export async function logError(
  userId: string,
  errorType: ErrorType,
  errorMessage: string,
  details: {
    repositoryId?: string;
    provider?: string;
    requestType?: LogRequestInput["requestType"];
    errorDetails?: Record<string, unknown>;
  } = {}
): Promise<void> {
  const supabase = await createClient();

  await supabase.from("ai_error_logs").insert({
    user_id: userId,
    repository_id: details.repositoryId ?? null,
    error_type: errorType,
    provider: details.provider ?? null,
    request_type: details.requestType ?? null,
    error_message: errorMessage,
    error_details: details.errorDetails ?? {},
  }); // fire-and-forget (errors silently ignored)
}

export async function getErrorLogs(
  userId: string,
  options?: { limit?: number; errorType?: ErrorType; days?: number }
): Promise<ErrorLog[]> {
  const supabase = await createClient();
  let query = supabase
    .from("ai_error_logs")
    .select("*")
    .eq("user_id", userId);

  if (options?.errorType) query = query.eq("error_type", options.errorType);
  if (options?.days) {
    const since = new Date(Date.now() - options.days * 86400000).toISOString();
    query = query.gte("created_at", since);
  }

  query = query.order("created_at", { ascending: false }).limit(options?.limit ?? 50);

  const { data, error } = await query;
  if (error) {
    if (error.code === "42P01") return [];
    throw new Error(`Failed to fetch error logs: ${error.message}`);
  }
  return (data ?? []).map(mapErrorLog);
}

// --- Dashboard Overview (aggregated from raw metrics) ---

export async function getDashboardOverview(userId: string): Promise<DashboardOverview> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("ai_request_metrics")
    .select("*")
    .eq("user_id", userId);

  if (error || !data || data.length === 0) {
    // Try snapshots as fallback
    return getOverviewFromSnapshots(userId);
  }

  const total = data.length;
  const successes = data.filter((r: Record<string, unknown>) => r.status === "success").length;
  const ragRequests = data.filter((r: Record<string, unknown>) => r.request_type === "rag");
  const embeddingRequests = data.filter((r: Record<string, unknown>) => r.request_type === "embedding");
  const llmLatencies = data
    .filter((r: Record<string, unknown>) => r.latency_ms != null && r.request_type !== "rag" && r.request_type !== "embedding")
    .map((r: Record<string, unknown>) => r.latency_ms as number);
  const ragLatencies = ragRequests
    .filter((r: Record<string, unknown>) => r.latency_ms != null)
    .map((r: Record<string, unknown>) => r.latency_ms as number);

  const uniqueRepos = new Set(
    data
      .filter((r: Record<string, unknown>) => r.repository_id != null)
      .map((r: Record<string, unknown>) => r.repository_id as string)
  );

  // Conversation count from sessions table
  let totalConversations = 0;
  const { data: convData } = await supabase
    .from("conversation_sessions")
    .select("id")
    .eq("user_id", userId);
  if (convData) totalConversations = convData.length;

  const avg = (arr: number[]) => arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;

  return {
    totalAiRequests: total,
    totalRagRequests: ragRequests.length,
    embeddingsGenerated: embeddingRequests.length,
    activeRepositories: uniqueRepos.size,
    totalConversations,
    aiSuccessRate: total > 0 ? Math.round((successes / total) * 10000) / 100 : 0,
    avgResponseTimeMs: Math.round(avg(llmLatencies) * 100) / 100,
    avgRetrievalTimeMs: Math.round(avg(ragLatencies) * 100) / 100,
  };
}

async function getOverviewFromSnapshots(userId: string): Promise<DashboardOverview> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("dashboard_snapshots")
    .select("*")
    .eq("user_id", userId)
    .order("snapshot_date", { ascending: false })
    .limit(1)
    .single();

  if (error || !data) {
    return {
      totalAiRequests: 0,
      totalRagRequests: 0,
      embeddingsGenerated: 0,
      activeRepositories: 0,
      totalConversations: 0,
      aiSuccessRate: 0,
      avgResponseTimeMs: 0,
      avgRetrievalTimeMs: 0,
    };
  }

  return {
    totalAiRequests: (data.total_ai_requests as number) || 0,
    totalRagRequests: (data.total_rag_requests as number) || 0,
    embeddingsGenerated: (data.total_embeddings as number) || 0,
    activeRepositories: (data.active_repositories as number) || 0,
    totalConversations: (data.total_conversations as number) || 0,
    aiSuccessRate: Math.round(((data.ai_success_rate as number) || 0) * 10000) / 100,
    avgResponseTimeMs: (data.avg_response_time_ms as number) || 0,
    avgRetrievalTimeMs: (data.avg_retrieval_time_ms as number) || 0,
  };
}

// --- Token Analytics ---

export async function getTokenAnalytics(userId: string): Promise<TokenAnalytics> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("ai_request_metrics")
    .select("*")
    .eq("user_id", userId);

  if (error || !data || data.length === 0) {
    return emptyTokenAnalytics();
  }

  const withTokens = data.filter((r: Record<string, unknown>) => r.total_tokens != null);
  const totalPrompt = withTokens.reduce((s: number, r: Record<string, unknown>) => s + (r.prompt_tokens as number || 0), 0);
  const totalCompletion = withTokens.reduce((s: number, r: Record<string, unknown>) => s + (r.completion_tokens as number || 0), 0);
  const totalTokens = withTokens.reduce((s: number, r: Record<string, unknown>) => s + (r.total_tokens as number || 0), 0);
  const anyEstimated = data.some((r: Record<string, unknown>) => r.tokens_estimated === true);

  // Daily usage
  const dailyMap = new Map<string, number>();
  for (const r of data) {
    const day = (r.created_at as string).slice(0, 10);
    dailyMap.set(day, (dailyMap.get(day) || 0) + (r.total_tokens as number || 0));
  }
  const dailyUsage = Array.from(dailyMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, tokens]) => ({ date, tokens }))
    .slice(-30);

  // Weekly usage
  const weeklyMap = new Map<string, number>();
  for (const r of data) {
    const d = new Date(r.created_at as string);
    const weekStart = new Date(d);
    weekStart.setDate(d.getDate() - d.getDay());
    const key = weekStart.toISOString().slice(0, 10);
    weeklyMap.set(key, (weeklyMap.get(key) || 0) + (r.total_tokens as number || 0));
  }
  const weeklyUsage = Array.from(weeklyMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([week, tokens]) => ({ week, tokens }))
    .slice(-12);

  return {
    totalPromptTokens: totalPrompt,
    totalCompletionTokens: totalCompletion,
    totalTokens,
    tokensPerRequest: withTokens.length > 0 ? Math.round(totalTokens / withTokens.length) : 0,
    dailyUsage,
    weeklyUsage,
    tokensEstimated: anyEstimated,
  };
}

function emptyTokenAnalytics(): TokenAnalytics {
  return {
    totalPromptTokens: 0,
    totalCompletionTokens: 0,
    totalTokens: 0,
    tokensPerRequest: 0,
    dailyUsage: [],
    weeklyUsage: [],
    tokensEstimated: false,
  };
}

// --- RAG Analytics ---

export async function getRAGAnalytics(userId: string): Promise<RAGAnalytics> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("ai_request_metrics")
    .select("*")
    .eq("user_id", userId)
    .eq("request_type", "rag");

  if (error || !data || data.length === 0) {
    return emptyRAGAnalytics();
  }

  const successes = data.filter((r: Record<string, unknown>) => r.status === "success");
  const emptyResults = data.filter((r: Record<string, unknown>) =>
    (r.metadata as Record<string, unknown>)?.emptyResult === true
  );
  const latencies = data
    .filter((r: Record<string, unknown>) => r.latency_ms != null)
    .map((r: Record<string, unknown>) => r.latency_ms as number);
  const topKs = data
    .map((r: Record<string, unknown>) => (r.metadata as Record<string, unknown>)?.topK as number | undefined)
    .filter((v): v is number => v != null);
  const similarities = data
    .map((r: Record<string, unknown>) => (r.metadata as Record<string, unknown>)?.avgSimilarity as number | undefined)
    .filter((v): v is number => v != null);

  const avg = (arr: number[]) => arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;

  return {
    avgRetrievalTimeMs: Math.round(avg(latencies) * 100) / 100,
    avgTopK: Math.round(avg(topKs) * 10) / 10,
    avgSimilarityScore: Math.round(avg(similarities) * 1000) / 1000,
    emptyRetrievalRate: data.length > 0 ? Math.round((emptyResults.length / data.length) * 10000) / 100 : 0,
    retrievalSuccessRate: data.length > 0 ? Math.round((successes.length / data.length) * 10000) / 100 : 0,
    totalRetrievals: data.length,
  };
}

function emptyRAGAnalytics(): RAGAnalytics {
  return {
    avgRetrievalTimeMs: 0,
    avgTopK: 0,
    avgSimilarityScore: 0,
    emptyRetrievalRate: 0,
    retrievalSuccessRate: 0,
    totalRetrievals: 0,
  };
}

// --- Embedding Analytics ---

export async function getEmbeddingAnalytics(userId: string): Promise<EmbeddingAnalytics> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("ai_request_metrics")
    .select("*")
    .eq("user_id", userId)
    .eq("request_type", "embedding");

  const totalEmbeddings = data?.length ?? 0;
  const failedEmbeddings = data?.filter((r: Record<string, unknown>) => r.status === "error").length ?? 0;
  const latencies = (data ?? [])
    .filter((r: Record<string, unknown>) => r.latency_ms != null)
    .map((r: Record<string, unknown>) => r.latency_ms as number);
  const avgTime = latencies.length > 0 ? latencies.reduce((a, b) => a + b, 0) / latencies.length : 0;

  // Get indexed commit count from commits table with embeddings
  let indexedCommits = 0;
  const { count: commitCount } = await supabase
    .from("commits")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .not("embedding", "is", null);
  indexedCommits = commitCount ?? 0;

  // Count reindex operations from metadata
  const reindexOps = (data ?? []).filter(
    (r: Record<string, unknown>) => (r.metadata as Record<string, unknown>)?.reindex === true
  ).length;

  return {
    totalEmbeddings,
    indexedCommits,
    reindexOperations: reindexOps,
    failedEmbeddings,
    embeddingProvider: "groq", // Current only provider
    avgEmbeddingTimeMs: Math.round(avgTime * 100) / 100,
  };
}

// --- Performance Timeline ---

export async function getPerformanceTimeline(
  userId: string,
  granularity: TimeGranularity,
  days: number = 30
): Promise<TimelineDataPoint[]> {
  const supabase = await createClient();

  const since = new Date(Date.now() - days * 86400000).toISOString();
  const { data, error } = await supabase
    .from("ai_request_metrics")
    .select("*")
    .eq("user_id", userId)
    .gte("created_at", since);

  if (error || !data || data.length === 0) return [];

  // Group by period
  const groups = new Map<string, Record<string, unknown>[]>();
  for (const r of data) {
    const d = new Date(r.created_at as string);
    let key: string;
    if (granularity === "daily") {
      key = d.toISOString().slice(0, 10);
    } else if (granularity === "weekly") {
      const weekStart = new Date(d);
      weekStart.setDate(d.getDate() - d.getDay());
      key = weekStart.toISOString().slice(0, 10);
    } else {
      key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    }
    const arr = groups.get(key) ?? [];
    arr.push(r);
    groups.set(key, arr);
  }

  return Array.from(groups.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([period, items]) => {
      const total = items.length;
      const successes = items.filter((r: Record<string, unknown>) => r.status === "success").length;
      const errors = items.filter((r: Record<string, unknown>) =>
        r.status === "error" || r.status === "rate_limited" || r.status === "timeout"
      ).length;

      const allLatencies = items
        .filter((r: Record<string, unknown>) => r.latency_ms != null)
        .map((r: Record<string, unknown>) => r.latency_ms as number);
      const ragLatencies = items
        .filter((r: Record<string, unknown>) => r.request_type === "rag" && r.latency_ms != null)
        .map((r: Record<string, unknown>) => r.latency_ms as number);

      const avg = (arr: number[]) => arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;

      return {
        period,
        requestVolume: total,
        responseTimeMs: Math.round(avg(allLatencies) * 100) / 100,
        retrievalTimeMs: Math.round(avg(ragLatencies) * 100) / 100,
        errorRate: total > 0 ? Math.round((errors / total) * 10000) / 100 : 0,
        successRate: total > 0 ? Math.round((successes / total) * 10000) / 100 : 0,
      };
    });
}

// --- Conversation Analytics ---

export async function getConversationAnalytics(userId: string): Promise<ConversationAnalytics> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("conversation_sessions")
    .select("*, repositories!inner(name)")
    .eq("user_id", userId);

  if (error || !data || data.length === 0) {
    return emptyConversationAnalytics();
  }

  const sessions = data as Array<Record<string, unknown> & { repositories: { name: string } }>;
  const totalConversations = sessions.length;
  const totalMessages = sessions.reduce((s: number, r) => s + (r.message_count as number || 0), 0);
  const avgLength = totalConversations > 0 ? Math.round(totalMessages / totalConversations) : 0;
  const avgResponseLength = totalConversations > 0
    ? Math.round(sessions.reduce((s: number, r) => s + (r.avg_response_length as number || 0), 0) / totalConversations)
    : 0;

  // Most active repos
  const repoMap = new Map<string, number>();
  for (const s of sessions) {
    const name = (s.repositories as Record<string, unknown>)?.name as string || "Unknown";
    repoMap.set(name, (repoMap.get(name) || 0) + 1);
  }
  const mostActiveRepositories = Array.from(repoMap.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([repoName, count]) => ({ repoName, count }));

  // Unique repos for avg questions per repo
  const uniqueRepos = new Set(sessions.map((r) => r.repository_id as string)).size;

  return {
    totalConversations,
    avgConversationLength: avgLength,
    avgQuestionsPerRepository: uniqueRepos > 0 ? Math.round((totalMessages / uniqueRepos) * 10) / 10 : 0,
    mostActiveRepositories,
    avgAiResponseLength: avgResponseLength,
  };
}

function emptyConversationAnalytics(): ConversationAnalytics {
  return {
    totalConversations: 0,
    avgConversationLength: 0,
    avgQuestionsPerRepository: 0,
    mostActiveRepositories: [],
    avgAiResponseLength: 0,
  };
}

// --- Cost Estimation ---

const DEFAULT_COST_CONFIGS: CostConfig[] = [
  { provider: "groq", model: "llama-3.3-70b-versatile", promptCostPer1k: 0.00059, completionCostPer1k: 0.00079 },
  { provider: "groq", model: "llama-3.1-8b-instant", promptCostPer1k: 0.00005, completionCostPer1k: 0.00008 },
  { provider: "groq", model: "mixtral-8x7b-32768", promptCostPer1k: 0.00024, completionCostPer1k: 0.00024 },
  { provider: "groq", model: "gemma2-9b-it", promptCostPer1k: 0.00008, completionCostPer1k: 0.00008 },
];

export async function getCostEstimates(userId: string, customConfigs?: CostConfig[]): Promise<CostEstimate[]> {
  const stats = await getProviderStats(userId);
  const configs = customConfigs ?? DEFAULT_COST_CONFIGS;

  return stats.map((s) => {
    const config = configs.find(
      (c) => c.provider === s.provider && c.model === s.model
    );
    const promptCost = config
      ? (s.totalPromptTokens / 1000) * config.promptCostPer1k
      : 0;
    const completionCost = config
      ? (s.totalCompletionTokens / 1000) * config.completionCostPer1k
      : 0;

    return {
      provider: s.provider,
      model: s.model,
      totalTokens: s.totalTokens,
      promptTokens: s.totalPromptTokens,
      completionTokens: s.totalCompletionTokens,
      estimatedCostUsd: Math.round((promptCost + completionCost) * 10000) / 10000,
      currency: config?.currency ?? "USD",
      isEstimated: s.tokensEstimated || !config,
    };
  });
}

// --- System Health ---

export async function getSystemHealth(userId: string): Promise<SystemHealth> {
  const results = await Promise.allSettled([
    checkLLMProvidersHealth(userId),
    checkRAGHealth(userId),
    checkEmbeddingHealth(userId),
    checkSupabaseHealth(),
    checkGithubHealth(),
  ]);

  const llmProviders: SystemHealthItem[] = results[0].status === "fulfilled" ? results[0].value : [];
  const ragPipeline: SystemHealthItem = results[1].status === "fulfilled" ? results[1].value : unknownHealth("RAG Pipeline");
  const embeddingService: SystemHealthItem = results[2].status === "fulfilled" ? results[2].value : unknownHealth("Embedding Service");
  const supabaseHealth: SystemHealthItem = results[3].status === "fulfilled" ? results[3].value : unknownHealth("Supabase");
  const githubApi: SystemHealthItem = results[4].status === "fulfilled" ? results[4].value : unknownHealth("GitHub API");

  const allStatuses: HealthStatus[] = [
    ...llmProviders.map((p) => p.status),
    ragPipeline.status,
    embeddingService.status,
    supabaseHealth.status,
    githubApi.status,
  ];

  let overallStatus: HealthStatus = "healthy";
  if (allStatuses.includes("critical")) overallStatus = "critical";
  else if (allStatuses.includes("warning")) overallStatus = "warning";
  else if (allStatuses.every((s) => s === "unknown")) overallStatus = "unknown";

  return {
    llmProviders,
    ragPipeline,
    embeddingService,
    supabase: supabaseHealth,
    githubApi: githubApi,
    overallStatus,
  };
}

async function checkLLMProvidersHealth(userId: string): Promise<SystemHealthItem[]> {
  const stats = await getProviderStats(userId);
  if (stats.length === 0) return [{ name: "No providers configured", status: "unknown", latencyMs: null, lastChecked: new Date().toISOString(), details: "No provider requests recorded yet." }];

  return stats.map((s) => {
    const health = computeProviderHealth(s);
    const details = health.status === "healthy"
      ? `Running normally. ${s.totalRequests} requests processed.`
      : health.status === "warning"
        ? `Success rate: ${health.successRate}%. ${health.totalRequests} total requests.`
        : health.status === "critical"
          ? `Success rate critically low: ${health.successRate}%. Investigate immediately.`
          : "No recent activity.";

    return {
      name: `${s.provider} / ${s.model}`,
      status: health.status,
      latencyMs: s.avgLatencyMs,
      lastChecked: new Date().toISOString(),
      details,
    };
  });
}

async function checkRAGHealth(userId: string): Promise<SystemHealthItem> {
  const rag = await getRAGAnalytics(userId);
  let status: HealthStatus = "unknown";
  let details = "No RAG requests recorded.";

  if (rag.totalRetrievals > 0) {
    if (rag.retrievalSuccessRate >= 90 && rag.emptyRetrievalRate < 20) {
      status = "healthy";
      details = `${rag.totalRetrievals} retrievals. Success rate: ${rag.retrievalSuccessRate}%. Avg similarity: ${rag.avgSimilarityScore}.`;
    } else if (rag.retrievalSuccessRate >= 70) {
      status = "warning";
      details = `Success rate: ${rag.retrievalSuccessRate}%. Empty result rate: ${rag.emptyRetrievalRate}%. Consider improving embeddings or queries.`;
    } else {
      status = "critical";
      details = `Success rate critically low: ${rag.retrievalSuccessRate}%. Empty result rate: ${rag.emptyRetrievalRate}%.`;
    }
  }

  return {
    name: "RAG Pipeline",
    status,
    latencyMs: rag.avgRetrievalTimeMs || null,
    lastChecked: new Date().toISOString(),
    details,
  };
}

async function checkEmbeddingHealth(userId: string): Promise<SystemHealthItem> {
  const emb = await getEmbeddingAnalytics(userId);
  let status: HealthStatus = "unknown";
  let details = "No embeddings generated.";

  if (emb.totalEmbeddings > 0) {
    const failRate = emb.failedEmbeddings / emb.totalEmbeddings;
    if (failRate < 0.05) {
      status = "healthy";
      details = `${emb.totalEmbeddings} embeddings generated. ${emb.indexedCommits} commits indexed.`;
    } else if (failRate < 0.2) {
      status = "warning";
      details = `${emb.failedEmbeddings} failed out of ${emb.totalEmbeddings}. Check embedding provider.`;
    } else {
      status = "critical";
      details = `${emb.failedEmbeddings} failed out of ${emb.totalEmbeddings} (${Math.round(failRate * 100)}%).`;
    }
  }

  return {
    name: "Embedding Service",
    status,
    latencyMs: emb.avgEmbeddingTimeMs || null,
    lastChecked: new Date().toISOString(),
    details,
  };
}

async function checkSupabaseHealth(): Promise<SystemHealthItem> {
  const start = Date.now();
  try {
    const supabase = await createClient();
    const { error } = await supabase.from("ai_request_metrics").select("id").limit(1);
    const latency = Date.now() - start;

    if (error) {
      return { name: "Supabase", status: "critical", latencyMs: latency, lastChecked: new Date().toISOString(), details: `Connection error: ${error.message}` };
    }
    return {
      name: "Supabase",
      status: latency < 500 ? "healthy" : latency < 1500 ? "warning" : "critical",
      latencyMs: latency,
      lastChecked: new Date().toISOString(),
      details: `Connection OK. Latency: ${latency}ms.`,
    };
  } catch {
    return { name: "Supabase", status: "critical", latencyMs: Date.now() - start, lastChecked: new Date().toISOString(), details: "Connection failed." };
  }
}

async function checkGithubHealth(): Promise<SystemHealthItem> {
  const start = Date.now();
  try {
    const res = await fetch("https://api.github.com/rate_limit", {
      signal: AbortSignal.timeout(5000),
    });
    const latency = Date.now() - start;

    if (!res.ok) {
      return { name: "GitHub API", status: "warning", latencyMs: latency, lastChecked: new Date().toISOString(), details: `HTTP ${res.status}. Rate limit may be reached.` };
    }

    const data = await res.json();
    const remaining = (data.rate?.remaining ?? 0) as number;
    const limit = (data.rate?.limit ?? 5000) as number;

    return {
      name: "GitHub API",
      status: remaining > 100 ? "healthy" : remaining > 10 ? "warning" : "critical",
      latencyMs: latency,
      lastChecked: new Date().toISOString(),
      details: `${remaining}/${limit} requests remaining. Latency: ${latency}ms.`,
    };
  } catch {
    return { name: "GitHub API", status: "unknown", latencyMs: Date.now() - start, lastChecked: new Date().toISOString(), details: "Could not reach GitHub API." };
  }
}

function unknownHealth(name: string): SystemHealthItem {
  return { name, status: "unknown", latencyMs: null, lastChecked: new Date().toISOString(), details: "Unable to assess." };
}

// --- Report Generation ---

export async function generateEngineeringReport(userId: string): Promise<AIEngineeringReport> {
  const [overview, providerStatsArr, tokenAnalytics, ragAnalytics, embeddingAnalytics, conversationAnalytics, costEstimates, systemHealth, errorLogs] = await Promise.all([
    getDashboardOverview(userId),
    getProviderStats(userId),
    getTokenAnalytics(userId),
    getRAGAnalytics(userId),
    getEmbeddingAnalytics(userId),
    getConversationAnalytics(userId),
    getCostEstimates(userId),
    getSystemHealth(userId),
    getErrorLogs(userId, { limit: 100 }),
  ]);

  const providerHealthItems = providerStatsArr.map(computeProviderHealth);

  // Error summary
  const errorMap = new Map<string, { count: number; lastOccurrence: string }>();
  for (const e of errorLogs) {
    const existing = errorMap.get(e.errorType);
    if (existing) {
      existing.count++;
      if (e.createdAt > existing.lastOccurrence) existing.lastOccurrence = e.createdAt;
    } else {
      errorMap.set(e.errorType, { count: 1, lastOccurrence: e.createdAt });
    }
  }
  const errorSummary = Array.from(errorMap.entries()).map(([type, data]) => ({ type: type as ErrorType, ...data }));

  // Optimization suggestions
  const suggestions = generateOptimizationSuggestions(overview, providerHealthItems, ragAnalytics, tokenAnalytics, costEstimates, systemHealth);

  return {
    generatedAt: new Date().toISOString(),
    period: `Last ${errorLogs.length > 0 ? "30 days" : "all time"}`,
    overview,
    providerStats: providerHealthItems,
    tokenAnalytics,
    ragAnalytics,
    embeddingAnalytics,
    conversationAnalytics,
    costEstimates,
    systemHealth,
    errorSummary,
    optimizationSuggestions: suggestions,
  };
}

function generateOptimizationSuggestions(
  overview: DashboardOverview,
  providers: ProviderHealth[],
  rag: RAGAnalytics,
  tokens: TokenAnalytics,
  costs: CostEstimate[],
  health: SystemHealth
): string[] {
  const suggestions: string[] = [];

  if (overview.aiSuccessRate < 90) {
    suggestions.push(`AI success rate is ${overview.aiSuccessRate}%. Investigate error patterns and provider reliability.`);
  }
  if (overview.avgResponseTimeMs > 3000) {
    suggestions.push(`Average response time is ${overview.avgResponseTimeMs}ms. Consider using faster models or optimizing prompts.`);
  }
  if (rag.emptyRetrievalRate > 30) {
    suggestions.push(`RAG empty retrieval rate is ${rag.emptyRetrievalRate}%. Improve query embeddings or expand the indexed corpus.`);
  }
  if (rag.avgSimilarityScore < 0.5) {
    suggestions.push(`Average similarity score is ${rag.avgSimilarityScore}. Consider re-embedding with a better model or adjusting the embedding strategy.`);
  }
  if (tokens.tokensPerRequest > 4000) {
    suggestions.push(`Average tokens per request is ${tokens.tokensPerRequest}. Optimize prompt length to reduce costs.`);
  }
  const totalCost = costs.reduce((s, c) => s + c.estimatedCostUsd, 0);
  if (totalCost > 1) {
    suggestions.push(`Estimated total cost is $${totalCost.toFixed(4)}. Consider caching frequent queries or using smaller models for simple tasks.`);
  }
  for (const p of providers) {
    if (p.status === "critical") {
      suggestions.push(`Provider ${p.provider}/${p.model} is critical. Switch to a fallback provider or investigate failures.`);
    }
  }
  if (health.overallStatus !== "healthy") {
    suggestions.push(`System health is "${health.overallStatus}". Review all subsystem statuses and address warnings.`);
  }
  if (suggestions.length === 0) {
    suggestions.push("All systems are performing within expected parameters. Continue monitoring for deviations.");
  }

  return suggestions;
}

// --- Report Export ---

export function exportReportAsMarkdown(report: AIEngineeringReport): string {
  const lines: string[] = [];

  lines.push("# AI Engineering Observability Report");
  lines.push(`\n**Generated:** ${new Date(report.generatedAt).toLocaleString()}`);
  lines.push(`**Period:** ${report.period}\n`);

  lines.push("## Overview\n");
  lines.push(`- Total AI Requests: ${report.overview.totalAiRequests}`);
  lines.push(`- Total RAG Requests: ${report.overview.totalRagRequests}`);
  lines.push(`- Embeddings Generated: ${report.overview.embeddingsGenerated}`);
  lines.push(`- Active Repositories: ${report.overview.activeRepositories}`);
  lines.push(`- Total Conversations: ${report.overview.totalConversations}`);
  lines.push(`- AI Success Rate: ${report.overview.aiSuccessRate}%`);
  lines.push(`- Avg Response Time: ${report.overview.avgResponseTimeMs}ms`);
  lines.push(`- Avg Retrieval Time: ${report.overview.avgRetrievalTimeMs}ms`);

  lines.push("\n## Provider Status\n");
  if (report.providerStats.length === 0) {
    lines.push("No provider data available.");
  } else {
    lines.push("| Provider | Model | Status | Requests | Success Rate | Avg Latency |");
    lines.push("|----------|-------|--------|----------|-------------|-------------|");
    for (const p of report.providerStats) {
      lines.push(`| ${p.provider} | ${p.model} | ${p.status} | ${p.totalRequests} | ${p.successRate}% | ${p.avgLatencyMs}ms |`);
    }
  }

  lines.push("\n## Token Usage\n");
  lines.push(`- Prompt Tokens: ${report.tokenAnalytics.totalPromptTokens.toLocaleString()}`);
  lines.push(`- Completion Tokens: ${report.tokenAnalytics.totalCompletionTokens.toLocaleString()}`);
  lines.push(`- Total Tokens: ${report.tokenAnalytics.totalTokens.toLocaleString()}`);
  lines.push(`- Avg Tokens/Request: ${report.tokenAnalytics.tokensPerRequest}`);
  if (report.tokenAnalytics.tokensEstimated) {
    lines.push("\n> **Note:** Some token counts are estimated.");
  }

  lines.push("\n## RAG Performance\n");
  lines.push(`- Total Retrievals: ${report.ragAnalytics.totalRetrievals}`);
  lines.push(`- Avg Retrieval Time: ${report.ragAnalytics.avgRetrievalTimeMs}ms`);
  lines.push(`- Avg Similarity Score: ${report.ragAnalytics.avgSimilarityScore}`);
  lines.push(`- Empty Retrieval Rate: ${report.ragAnalytics.emptyRetrievalRate}%`);
  lines.push(`- Retrieval Success Rate: ${report.ragAnalytics.retrievalSuccessRate}%`);

  lines.push("\n## Embedding Statistics\n");
  lines.push(`- Total Embeddings: ${report.embeddingAnalytics.totalEmbeddings}`);
  lines.push(`- Indexed Commits: ${report.embeddingAnalytics.indexedCommits}`);
  lines.push(`- Failed Embeddings: ${report.embeddingAnalytics.failedEmbeddings}`);
  lines.push(`- Avg Embedding Time: ${report.embeddingAnalytics.avgEmbeddingTimeMs}ms`);

  lines.push("\n## Cost Estimation\n");
  if (report.costEstimates.length === 0) {
    lines.push("No cost data available.");
  } else {
    lines.push("| Provider | Model | Tokens | Estimated Cost |");
    lines.push("|----------|-------|--------|---------------|");
    for (const c of report.costEstimates) {
      lines.push(`| ${c.provider} | ${c.model} | ${c.totalTokens.toLocaleString()} | $${c.estimatedCostUsd.toFixed(4)} ${c.isEstimated ? "(est.)" : ""} |`);
    }
    const total = report.costEstimates.reduce((s, c) => s + c.estimatedCostUsd, 0);
    lines.push(`\n**Total Estimated Cost: $${total.toFixed(4)}**`);
  }

  lines.push("\n## System Health\n");
  lines.push(`- **Overall:** ${report.systemHealth.overallStatus.toUpperCase()}`);
  for (const item of report.systemHealth.llmProviders) {
    lines.push(`- ${item.name}: ${item.status.toUpperCase()} — ${item.details}`);
  }
  lines.push(`- RAG Pipeline: ${report.systemHealth.ragPipeline.status.toUpperCase()} — ${report.systemHealth.ragPipeline.details}`);
  lines.push(`- Embedding Service: ${report.systemHealth.embeddingService.status.toUpperCase()} — ${report.systemHealth.embeddingService.details}`);
  lines.push(`- Supabase: ${report.systemHealth.supabase.status.toUpperCase()} — ${report.systemHealth.supabase.details}`);
  lines.push(`- GitHub API: ${report.systemHealth.githubApi.status.toUpperCase()} — ${report.systemHealth.githubApi.details}`);

  if (report.errorSummary.length > 0) {
    lines.push("\n## Error Summary\n");
    lines.push("| Error Type | Count | Last Occurrence |");
    lines.push("|------------|-------|-----------------|");
    for (const e of report.errorSummary) {
      lines.push(`| ${e.type} | ${e.count} | ${new Date(e.lastOccurrence).toLocaleString()} |`);
    }
  }

  lines.push("\n## Optimization Suggestions\n");
  for (const s of report.optimizationSuggestions) {
    lines.push(`- ${s}`);
  }

  return lines.join("\n");
}

export function exportReportAsText(report: AIEngineeringReport): string {
  const md = exportReportAsMarkdown(report);
  // Strip markdown formatting for plain text
  return md
    .replace(/^#{1,6}\s/gm, "")
    .replace(/\*\*/g, "")
    .replace(/\|/g, "  ")
    .replace(/^-{3,}$/gm, "")
    .replace(/^>\s/gm, "  NOTE: ")
    .replace(/\n{3,}/g, "\n\n");
}

// --- Mappers ---

function mapRequestMetric(row: Record<string, unknown>): RequestMetric {
  return {
    id: row.id as string,
    userId: row.user_id as string,
    repositoryId: row.repository_id as string | null,
    requestType: row.request_type as RequestType,
    provider: row.provider as string | null,
    model: row.model as string | null,
    status: row.status as RequestStatus,
    latencyMs: row.latency_ms as number | null,
    promptTokens: row.prompt_tokens as number | null,
    completionTokens: row.completion_tokens as number | null,
    totalTokens: row.total_tokens as number | null,
    tokensEstimated: row.tokens_estimated as boolean,
    errorType: row.error_type as string | null,
    errorMessage: row.error_message as string | null,
    metadata: (row.metadata as Record<string, unknown>) ?? {},
    createdAt: row.created_at as string,
  };
}

function mapProviderStat(row: Record<string, unknown>): ProviderStats {
  return {
    id: row.id as string,
    userId: row.user_id as string,
    provider: row.provider as string,
    model: row.model as string,
    totalRequests: (row.total_requests as number) || 0,
    successfulRequests: (row.successful_requests as number) || 0,
    failedRequests: (row.failed_requests as number) || 0,
    rateLimitedRequests: (row.rate_limited_requests as number) || 0,
    totalPromptTokens: (row.total_prompt_tokens as number) || 0,
    totalCompletionTokens: (row.total_completion_tokens as number) || 0,
    totalTokens: (row.total_tokens as number) || 0,
    tokensEstimated: row.tokens_estimated as boolean,
    avgLatencyMs: (row.avg_latency_ms as number) || 0,
    minLatencyMs: (row.min_latency_ms as number) || 0,
    maxLatencyMs: (row.max_latency_ms as number) || 0,
    lastSuccessAt: row.last_success_at as string | null,
    lastFailureAt: row.last_failure_at as string | null,
    lastRequestAt: row.last_request_at as string | null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

function mapErrorLog(row: Record<string, unknown>): ErrorLog {
  return {
    id: row.id as string,
    userId: row.user_id as string,
    repositoryId: row.repository_id as string | null,
    errorType: row.error_type as ErrorType,
    provider: row.provider as string | null,
    requestType: row.request_type as RequestType | null,
    errorMessage: row.error_message as string,
    errorDetails: (row.error_details as Record<string, unknown>) ?? {},
    resolved: row.resolved as boolean,
    createdAt: row.created_at as string,
  };
}