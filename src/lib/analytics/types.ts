// ================================================================
// Analytics Types — Phase 11: AI Engineering Dashboard & Observability
// ================================================================

// --- Request Metrics ---
export type RequestType = "llm" | "rag" | "embedding" | "health_analysis" | "doc_generation" | "evolution_analysis" | "commit_explain";
export type RequestStatus = "success" | "error" | "rate_limited" | "timeout";
export type ErrorType = "provider_error" | "api_failure" | "rate_limit" | "retrieval_error" | "embedding_error" | "network_failure" | "timeout" | "unknown";

export interface RequestMetric {
  id: string;
  userId: string;
  repositoryId: string | null;
  requestType: RequestType;
  provider: string | null;
  model: string | null;
  status: RequestStatus;
  latencyMs: number | null;
  promptTokens: number | null;
  completionTokens: number | null;
  totalTokens: number | null;
  tokensEstimated: boolean;
  errorType: string | null;
  errorMessage: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface LogRequestInput {
  repositoryId?: string;
  requestType: RequestType;
  provider?: string;
  model?: string;
  status: RequestStatus;
  latencyMs?: number;
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
  tokensEstimated?: boolean;
  errorType?: ErrorType;
  errorMessage?: string;
  metadata?: Record<string, unknown>;
}

// --- Provider Statistics ---
export interface ProviderStats {
  id: string;
  userId: string;
  provider: string;
  model: string;
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  rateLimitedRequests: number;
  totalPromptTokens: number;
  totalCompletionTokens: number;
  totalTokens: number;
  tokensEstimated: boolean;
  avgLatencyMs: number;
  minLatencyMs: number;
  maxLatencyMs: number;
  lastSuccessAt: string | null;
  lastFailureAt: string | null;
  lastRequestAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ProviderHealth {
  provider: string;
  model: string;
  status: "healthy" | "warning" | "critical" | "unknown";
  avgLatencyMs: number;
  totalRequests: number;
  successRate: number;
  errorRate: number;
  lastSuccessAt: string | null;
  lastFailureAt: string | null;
}

// --- Error Logs ---
export interface ErrorLog {
  id: string;
  userId: string;
  repositoryId: string | null;
  errorType: ErrorType;
  provider: string | null;
  requestType: RequestType | null;
  errorMessage: string;
  errorDetails: Record<string, unknown>;
  resolved: boolean;
  createdAt: string;
}

// --- Dashboard Snapshot ---
export interface DashboardSnapshot {
  id: string;
  userId: string;
  snapshotDate: string;
  totalAiRequests: number;
  totalRagRequests: number;
  totalEmbeddings: number;
  totalLlmRequests: number;
  totalHealthAnalyses: number;
  totalDocGenerations: number;
  totalEvolutionAnalyses: number;
  totalCommitExplains: number;
  activeRepositories: number;
  totalConversations: number;
  aiSuccessRate: number;
  avgResponseTimeMs: number;
  avgRetrievalTimeMs: number;
  totalPromptTokens: number;
  totalCompletionTokens: number;
  totalTokens: number;
  totalErrors: number;
  providerBreakdown: Record<string, number>;
  errorBreakdown: Record<string, number>;
  createdAt: string;
}

// --- Conversation Sessions ---
export interface ConversationSession {
  id: string;
  userId: string;
  repositoryId: string;
  messageCount: number;
  totalAiResponses: number;
  avgResponseLength: number;
  totalTokensUsed: number;
  startedAt: string;
  lastActivityAt: string;
}

// --- Dashboard Overview Cards ---
export interface DashboardOverview {
  totalAiRequests: number;
  totalRagRequests: number;
  embeddingsGenerated: number;
  activeRepositories: number;
  totalConversations: number;
  aiSuccessRate: number;
  avgResponseTimeMs: number;
  avgRetrievalTimeMs: number;
}

// --- Token Analytics ---
export interface TokenAnalytics {
  totalPromptTokens: number;
  totalCompletionTokens: number;
  totalTokens: number;
  tokensPerRequest: number;
  dailyUsage: { date: string; tokens: number }[];
  weeklyUsage: { week: string; tokens: number }[];
  tokensEstimated: boolean;
}

// --- RAG Analytics ---
export interface RAGAnalytics {
  avgRetrievalTimeMs: number;
  avgTopK: number;
  avgSimilarityScore: number;
  emptyRetrievalRate: number;
  retrievalSuccessRate: number;
  totalRetrievals: number;
}

// --- Embedding Analytics ---
export interface EmbeddingAnalytics {
  totalEmbeddings: number;
  indexedCommits: number;
  reindexOperations: number;
  failedEmbeddings: number;
  embeddingProvider: string;
  avgEmbeddingTimeMs: number;
}

// --- Performance Timeline ---
export type TimeGranularity = "daily" | "weekly" | "monthly";

export interface TimelineDataPoint {
  period: string;
  requestVolume: number;
  responseTimeMs: number;
  retrievalTimeMs: number;
  errorRate: number;
  successRate: number;
}

// --- Conversation Analytics ---
export interface ConversationAnalytics {
  totalConversations: number;
  avgConversationLength: number;
  avgQuestionsPerRepository: number;
  mostActiveRepositories: { repoName: string; count: number }[];
  avgAiResponseLength: number;
}

// --- Cost Estimation ---
export interface CostEstimate {
  provider: string;
  model: string;
  totalTokens: number;
  promptTokens: number;
  completionTokens: number;
  estimatedCostUsd: number;
  currency: string;
  isEstimated: boolean;
}

export interface CostConfig {
  provider: string;
  model: string;
  promptCostPer1k: number;
  completionCostPer1k: number;
  currency?: string;
}

// --- System Health ---
export type HealthStatus = "healthy" | "warning" | "critical" | "unknown";

export interface SystemHealthItem {
  name: string;
  status: HealthStatus;
  latencyMs: number | null;
  lastChecked: string;
  details: string;
}

export interface SystemHealth {
  llmProviders: SystemHealthItem[];
  ragPipeline: SystemHealthItem;
  embeddingService: SystemHealthItem;
  supabase: SystemHealthItem;
  githubApi: SystemHealthItem;
  overallStatus: HealthStatus;
}

// --- Report Types ---
export interface AIEngineeringReport {
  generatedAt: string;
  period: string;
  overview: DashboardOverview;
  providerStats: ProviderHealth[];
  tokenAnalytics: TokenAnalytics;
  ragAnalytics: RAGAnalytics;
  embeddingAnalytics: EmbeddingAnalytics;
  conversationAnalytics: ConversationAnalytics;
  costEstimates: CostEstimate[];
  systemHealth: SystemHealth;
  errorSummary: { type: ErrorType; count: number; lastOccurrence: string }[];
  optimizationSuggestions: string[];
}

export type ExportFormat = "markdown" | "text";