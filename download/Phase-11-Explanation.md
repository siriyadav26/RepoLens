# Phase 11: AI Engineering Dashboard & Observability — Comprehensive Explanation

> **RepoLens AI** | Next.js 16 · Supabase · Groq LLM
> Phase 11 introduces a full-stack AI observability system — a real-time engineering dashboard that monitors LLM usage, RAG pipeline performance, embedding operations, provider health, token consumption, cost estimation, and error tracking. This document covers every design decision, metric definition, database schema, and implementation detail.

---

## Table of Contents

1. [AI Observability](#1-ai-observability)
2. [Dashboard Architecture](#2-dashboard-architecture)
3. [Metrics](#3-metrics)
4. [File-by-File Explanation](#4-file-by-file-explanation)
5. [Database](#5-database)
6. [Performance](#6-performance)
7. [Security](#7-security)
8. [Future Improvements](#8-future-improvements)
9. [Interview Preparation](#9-interview-preparation)
10. [Revision Guide](#10-revision-guide)

---

## 1. AI Observability

### The Three Pillars of Observability

Observability is the ability to understand the internal state of a system by examining its external outputs. It is built on three foundational pillars:

1. **Metrics** — Quantitative measurements recorded at fixed intervals or per-event. Metrics are numeric values that can be aggregated, averaged, and graphed over time. Examples: request count, latency in milliseconds, error count, tokens consumed. Metrics answer the question *"how much?"* and *"how fast?"*

2. **Logs** — Immutable, timestamped records of discrete events. Logs capture the context around a specific occurrence — what happened, when, and with what parameters. Unlike metrics, logs carry rich, unstructured or semi-structured detail. An error log might include the full stack trace, the request payload, and the provider's response body. Logs answer the question *"what exactly happened?"*

3. **Traces** — End-to-end records of a request's journey through a distributed system. A trace is composed of spans, where each span represents a unit of work (an HTTP call, a database query, an LLM inference). Spans are linked by correlation IDs, allowing you to follow a single user request from the frontend, through the API route, into the RAG retrieval step, through the LLM call, and back. Traces answer the question *"where did the time go?"*

Phase 11 implements **metrics** (request counts, latency, token usage, cost) and **logs** (error logs with type classification, detailed error messages). Traces are listed as a future improvement, though the `withMetrics()` wrapper captures per-request timing that serves as a lightweight tracing primitive.

### Why AI Systems Specifically Need Monitoring

Traditional web applications are deterministic: the same input produces the same output, and performance is bounded by well-understood factors (database query time, network latency, CPU usage). AI systems introduce layers of non-determinism and external dependency that make monitoring not just useful, but essential:

- **Non-determinism**: LLMs produce different outputs for the same input (they are probabilistic). Two identical prompts can return different quality responses, different token counts, and different latencies. You cannot test AI systems the way you test traditional software — you must continuously observe their behavior in production.

- **Latency variance**: A traditional API call might take 50ms ± 10ms. An LLM call to Groq might take 200ms, or it might take 5 seconds during peak load, or it might timeout entirely. This variance is caused by model loading, queue depth at the provider, network conditions, and input complexity (longer prompts take longer to process). Without monitoring, you have no visibility into whether your users are experiencing 200ms or 5-second response times.

- **Cost**: Every LLM token costs money. Prompt tokens and completion tokens are billed separately, and different models have vastly different pricing. A single user running hundreds of RAG queries against a 70B parameter model can rack up significant costs in a matter of hours. Without token-level monitoring, cost overruns are invisible until the monthly bill arrives.

- **Quality**: AI output quality degrades silently. A model might start hallucinating more frequently, or a RAG pipeline might start returning irrelevant documents because the embedding index has drifted. Unlike a traditional bug that crashes the application, quality degradation produces plausible-looking but incorrect output. Monitoring retrieval similarity scores, empty result rates, and success rates provides early warning of quality issues.

### AI Performance Metrics

Phase 11 tracks four categories of AI-specific performance metrics:

1. **Latency** — The time elapsed from when a request is sent to when the response is received, measured in milliseconds. This is the wall-clock time the user experiences. For LLM calls, latency includes network round-trip time, provider queue time, and inference time. For RAG calls, latency additionally includes the vector search time. Phase 11 records `latency_ms` for every request in `ai_request_metrics` and tracks running averages in `provider_statistics`.

2. **Throughput** — The number of requests processed per unit of time. Throughput is a system-level metric that indicates capacity utilization. In Phase 11, throughput is derived from the request volume in the performance timeline (requests per day/week/month) and the overview dashboard (total requests across all time).

3. **Success Rate** — The percentage of AI requests that completed without error. A "success" means the LLM returned a valid response, the RAG pipeline retrieved documents, or the embedding was generated. Phase 11 calculates success rate as `(successful_requests / total_requests) × 100` and stores it both per-provider and as an overall metric.

4. **Token Usage** — The total number of tokens consumed by LLM operations. Tokens are the fundamental billing unit for all modern LLM providers. Phase 11 tracks prompt tokens (input to the model), completion tokens (output from the model), and total tokens (the sum). When the provider does not return token counts, Phase 11 estimates them using the ~4 characters per token heuristic.

### LLM Reliability Concerns

LLM providers are third-party services that introduce unique failure modes:

- **Rate limits**: Every provider enforces requests-per-minute (RPM) and tokens-per-minute (TPM) limits. When these limits are exceeded, the provider returns HTTP 429. Phase 11 classifies these as `rate_limited` status and `rate_limit` error type, and tracks `rate_limited_requests` per provider.

- **Model degradation**: LLM providers occasionally deploy model updates that change output quality. A model that previously produced excellent responses might suddenly start hallucinating or returning truncated output. This is invisible without tracking success rates and response quality over time. Phase 11's `computeProviderHealth()` function detects degradation by monitoring the success rate trend — if it drops below 80%, the provider is flagged as "warning"; below 50%, it's flagged as "critical."

- **Context window limits**: Every model has a maximum context window (e.g., 32K or 128K tokens). If a prompt exceeds this limit, the request fails. Phase 11 tracks token usage per request, which allows operators to identify requests approaching the limit and optimize their prompt engineering accordingly.

- **Hallucination risk**: LLMs can generate plausible-sounding but factually incorrect information. While Phase 11 does not directly detect hallucinations (that would require a separate evaluation pipeline), it tracks the RAG pipeline's `avgSimilarityScore` and `emptyRetrievalRate` — two leading indicators of hallucination risk. When the similarity score drops below 0.5, the `generateOptimizationSuggestions()` function recommends re-embedding or adjusting the embedding strategy.

---

## 2. Dashboard Architecture

### Layered Architecture

The AI Engineering Dashboard follows a clean, layered architecture that separates concerns across four distinct layers:

```
User → Dashboard → Analytics Services → LLM Metrics
                                           → RAG Metrics
                                           → Embedding Metrics
                                           → Database
```

**Layer 1 — Presentation (Dashboard Component)**
The `ai-dashboard.tsx` component is the user-facing layer. It fetches data from a single API endpoint, manages local state (active tab, granularity, loading/error states), and renders 11 tabbed sections using Recharts visualizations. This layer is purely a consumer of data — it performs no aggregation, computation, or database access.

**Layer 2 — API Routes**
Two API routes serve the dashboard:
- `GET /api/ai-dashboard` — Returns all dashboard data in a single response. It uses `Promise.all()` to fetch 10 analytics datasets in parallel from the analytics services layer.
- `GET /api/ai-dashboard/report?format=markdown|text|json` — Generates and exports a comprehensive AI engineering report.

Both routes perform authentication (via `supabase.auth.getUser()`) before delegating to the analytics layer.

**Layer 3 — Analytics Services**
The `src/lib/analytics/` module contains the core analytics logic:
- `db.ts` — Database access layer with 20+ functions for CRUD, aggregation, health checks, report generation, and export.
- `collector.ts` — Instrumentation wrapper (`withMetrics()`) that automatically logs metrics for any async AI operation.
- `types.ts` — 30+ TypeScript interfaces and types that define the analytics data model.
- `index.ts` — Barrel export that re-exports everything from `types.ts` and `db.ts`.

**Layer 4 — Database (Supabase/PostgreSQL)**
Five tables store raw metrics, aggregated statistics, error logs, daily snapshots, and conversation sessions. Row Level Security (RLS) ensures tenant isolation. The `generate_daily_snapshot()` PL/pgSQL function enables efficient trend queries without scanning the full raw metrics table.

### Data Flow

The complete data flow from user action to visualization follows this path:

1. **User triggers an AI action** (e.g., asks a question about a repository, triggers a health analysis, runs document generation).
2. **The `withMetrics()` wrapper intercepts the operation**, starting a `Date.now()` timer.
3. **The AI operation executes** (LLM call, RAG retrieval, embedding generation).
4. **On success**, `withMetrics()` extracts token counts from the result (if available), calculates latency, and calls `logRequest()` to insert a row into `ai_request_metrics`. It then fire-and-forgets `updateProviderStats()` to incrementally update the aggregated `provider_statistics` row.
5. **On failure**, `withMetrics()` classifies the error type (rate limit, timeout, network failure, provider error), logs both a request metric (with `status: "error"`) and an error log (in `ai_error_logs`), then re-throws the error.
6. **When the user opens the dashboard**, the component calls `GET /api/ai-dashboard?granularity=daily&days=30`.
7. **The API route authenticates the user**, then fires 10 parallel queries via `Promise.all()`.
8. **Each analytics function** (e.g., `getDashboardOverview()`, `getTokenAnalytics()`, `getRAGAnalytics()`) queries the raw metrics table, computes aggregations in JavaScript, and returns structured data.
9. **The dashboard component** receives all data in a single JSON response and renders it across 11 tabs using Recharts.

---

## 3. Metrics

### Latency

Latency is the time between sending a request and receiving a response, measured in milliseconds. Phase 11 records `latency_ms` for every request in the `ai_request_metrics` table.

**Why averages hide outliers**: Consider 99 requests that complete in 200ms and 1 request that takes 10,000ms. The average is `(99 × 200 + 10,000) / 100 = 298ms`, which looks perfectly fine. But the 100th user waited 10 seconds. This is why production systems use **percentiles** — the p50 (median) tells you what the typical user experiences, the p95 tells you what 95% of users experience, and the p99 tells you the worst-case for all but 1% of users. Phase 11 currently tracks average latency (`avg_latency_ms` in `provider_statistics`) and min/max extremes, but not explicit percentiles. The `getPerformanceTimeline()` function computes per-period averages from raw data, which could be extended to compute percentiles if needed.

**Latency measurement in Phase 11**: The `withMetrics()` wrapper captures latency using `Date.now()` at the start and end of the async operation. This measures end-to-end latency including network round-trip to the provider, provider processing time, and any intermediate steps (such as RAG retrieval before the LLM call). The `provider_statistics` table maintains `avg_latency_ms`, `min_latency_ms`, and `max_latency_ms` — the average is computed incrementally using a running average formula to avoid a full table scan.

### Throughput

Throughput measures the volume of requests processed per unit of time. Phase 11 tracks throughput in three granularities:

- **Requests per day** — The default view in the performance timeline. Each data point represents all AI requests made on a given calendar day.
- **Requests per week** — Aggregated by ISO week start (Sunday). Useful for identifying weekly patterns (e.g., lower usage on weekends).
- **Requests per month** — Aggregated by year-month. Useful for long-term trend analysis and capacity planning.

Throughput is computed by the `getPerformanceTimeline()` function, which groups raw metrics by the selected granularity and counts the number of requests in each period. The result is an array of `TimelineDataPoint` objects, each containing `requestVolume` (the throughput metric) along with response time, error rate, and success rate for that period.

### Success Rate

Success rate is the percentage of requests that completed without error, calculated as:

```
success_rate = (successful_requests / total_requests) × 100
```

In Phase 11, a request's `status` field is one of four values: `"success"`, `"error"`, `"rate_limited"`, or `"timeout"`. Only `"success"` counts toward the numerator. The denominator includes all requests regardless of status.

Success rate is tracked at three levels:
1. **Per-provider** — In `provider_statistics`, computed by `computeProviderHealth()` as `successfulRequests / totalRequests`.
2. **Per-period** — In the timeline, computed as the ratio of success-status requests to total requests in each time bucket.
3. **Overall** — In `DashboardOverview`, computed as the ratio of all successful requests to all requests across all time.

A healthy AI system should maintain a success rate above 95%. Phase 11's health check uses 80% as the "warning" threshold and 50% as the "critical" threshold.

### Error Rate

Error rate is the complement of success rate for non-success statuses, but Phase 11 tracks it more granularly. Error rate is calculated as:

```
error_rate = ((failed_requests + rate_limited_requests) / total_requests) × 100
```

Errors are classified into eight distinct types using the `ErrorType` union:

| Error Type | Description | Example |
|---|---|---|
| `provider_error` | The LLM provider returned an error response | HTTP 500 from Groq with an internal error message |
| `api_failure` | A general API call failure | Malformed response body, unexpected status code |
| `rate_limit` | The provider's rate limit was exceeded | HTTP 429 with "RATE_LIMITED" in the message |
| `retrieval_error` | A RAG retrieval operation failed | Vector search returned no results or threw an exception |
| `embedding_error` | An embedding generation operation failed | Embedding API timeout or malformed input |
| `network_failure` | A network-level failure occurred | `ECONNREFUSED`, `fetch` failed, DNS resolution failed |
| `timeout` | The operation exceeded its time limit | Provider took too long, `AbortSignal.timeout()` fired |
| `unknown` | The error could not be classified | An unexpected error type that doesn't match any category |

The `withMetrics()` collector automatically classifies errors by inspecting the error message string. For example, if the message contains "RATE_LIMITED" or the HTTP status is 429, it's classified as a rate limit error. If the message contains "timeout" or "TIMEOUT", it's classified as a timeout. This heuristic classification covers the most common failure modes without requiring manual error tagging.

### Token Usage

Token usage is the fundamental unit of LLM cost and capacity. Every word or sub-word in a prompt is converted into one or more tokens by the model's tokenizer. Phase 11 tracks three token metrics:

- **Prompt tokens** (`prompt_tokens`): The number of tokens in the input sent to the LLM. This includes the system prompt, conversation history, and any RAG context injected into the prompt. Prompt tokens are typically cheaper than completion tokens because they only require encoding, not generation.

- **Completion tokens** (`completion_tokens`): The number of tokens in the LLM's output. These are typically more expensive because they require the model to generate text autoregressively (one token at a time, with each token depending on all previous tokens).

- **Total tokens** (`total_tokens`): The sum of prompt and completion tokens. This is the primary metric for cost estimation.

**Estimation heuristic**: Not all LLM providers return token counts in their API response. When token counts are unavailable, Phase 11 estimates them using the ~4 characters per token heuristic: `tokens = Math.ceil(text.length / 4)`. This is a rough approximation — the actual tokenization depends on the specific tokenizer used by the model (e.g., GPT's `tiktoken`, Llama's sentencepiece). The `tokens_estimated` boolean flag is set to `true` whenever estimation is used, and the dashboard displays a yellow "estimated" badge to inform the user. The `estimateTokens()` utility function in `collector.ts` implements this heuristic.

**Tokens per request** is computed as `totalTokens / withTokens.length` (the average total tokens across all requests that had token data). This metric is useful for identifying unusually token-heavy operations that could be optimized.

### Cost Estimation

Cost estimation translates token usage into dollar amounts using per-model pricing. Phase 11 maintains a `DEFAULT_COST_CONFIGS` array with pricing for four Groq models:

```typescript
const DEFAULT_COST_CONFIGS: CostConfig[] = [
  { provider: "groq", model: "llama-3.3-70b-versatile", promptCostPer1k: 0.00059, completionCostPer1k: 0.00079 },
  { provider: "groq", model: "llama-3.1-8b-instant", promptCostPer1k: 0.00005, completionCostPer1k: 0.00008 },
  { provider: "groq", model: "mixtral-8x7b-32768", promptCostPer1k: 0.00024, completionCostPer1k: 0.00024 },
  { provider: "groq", model: "gemma2-9b-it", promptCostPer1k: 0.00008, completionCostPer1k: 0.00008 },
];
```

Cost is calculated per-model using the formula:

```
prompt_cost = (total_prompt_tokens / 1000) × prompt_cost_per_1k
completion_cost = (total_completion_tokens / 1000) × completion_cost_per_1k
total_cost = prompt_cost + completion_cost
```

**Why costs are labeled "estimated"**: Costs are estimates for two reasons. First, if token counts were estimated (using the ~4 chars/token heuristic), the token counts themselves are approximate, making the cost calculation approximate. Second, LLM providers frequently update their pricing — the `DEFAULT_COST_CONFIGS` values are hardcoded and may not reflect the current pricing at any given moment. The `isEstimated` boolean on each `CostEstimate` object is set to `true` if either condition applies. The dashboard displays costs with a yellow "(est.)" badge when appropriate.

The cost differential between prompt and completion tokens is significant. For `llama-3.3-70b-versatile`, completion tokens cost 34% more than prompt tokens ($0.00079 vs $0.00059 per 1K). This means that optimizing prompt length (e.g., by reducing RAG context or truncating conversation history) has a direct and measurable impact on cost.

---

## 4. File-by-File Explanation

### New Files

#### `scripts/phase-11-sql.sql` — SQL Migration

This is the database migration script that must be run in the Supabase SQL Editor to create the analytics infrastructure. It contains:

- **5 table definitions** with column constraints, defaults, and CHECK constraints for enumerated types (e.g., `request_type IN ('llm', 'rag', 'embedding', ...)`).
- **13 indexes** optimized for the most common query patterns (user_id lookups, type filtering, date range queries, composite indexes for provider+model lookups).
- **15 RLS policies** (3 per table: SELECT, INSERT, UPDATE) ensuring each user can only access their own data.
- **1 trigger** that automatically updates the `updated_at` column on `provider_statistics`.
- **1 PL/pgSQL function** (`generate_daily_snapshot()`) that aggregates raw metrics into daily snapshots.

The script uses `CREATE TABLE IF NOT EXISTS` and `CREATE INDEX IF NOT EXISTS` to be idempotent — it can be re-run without errors.

#### `src/lib/analytics/types.ts` — TypeScript Types

This file defines the complete type system for the analytics module — 30+ interfaces and type aliases. Key types include:

- **Union types for controlled vocabularies**: `RequestType` (7 values: llm, rag, embedding, health_analysis, doc_generation, evolution_analysis, commit_explain), `RequestStatus` (4 values: success, error, rate_limited, timeout), `ErrorType` (8 values: provider_error, api_failure, rate_limit, retrieval_error, embedding_error, network_failure, timeout, unknown).
- **Database row types**: `RequestMetric`, `ProviderStats`, `ErrorLog`, `DashboardSnapshot`, `ConversationSession` — each maps 1:1 to a database table with camelCase property names.
- **Input types**: `LogRequestInput` — the shape of data passed to `logRequest()`. All fields except `requestType` and `status` are optional, making it easy to log minimal or detailed metrics.
- **Aggregated analytics types**: `DashboardOverview`, `TokenAnalytics`, `RAGAnalytics`, `EmbeddingAnalytics`, `ConversationAnalytics` — each contains pre-computed metrics for a specific domain.
- **Derived types**: `ProviderHealth` (computed from `ProviderStats` by `computeProviderHealth()`), `CostEstimate` (computed from `ProviderStats` + `CostConfig`), `SystemHealth` (composite health of all subsystems).
- **Report types**: `AIEngineeringReport` (the complete report structure), `ExportFormat` (markdown | text).
- **Timeline types**: `TimeGranularity` (daily | weekly | monthly), `TimelineDataPoint` (per-period metrics).

#### `src/lib/analytics/db.ts` — Core Analytics DB Layer

This is the largest and most important file in Phase 11 (~1,100 lines). It provides 20+ exported functions organized into categories:

**CRUD Operations**:
- `logRequest(userId, input)` — Inserts a row into `ai_request_metrics` and fire-and-forgets `updateProviderStats()`. Gracefully returns `null` if the table doesn't exist (error code `42P01`).
- `getRequestMetrics(userId, options)` — Fetches raw metrics with optional filtering by type and date range.
- `logError(userId, errorType, errorMessage, details)` — Inserts a row into `ai_error_logs`.
- `getErrorLogs(userId, options)` — Fetches error logs with optional filtering.

**Aggregation Functions**:
- `getDashboardOverview(userId)` — Computes 9 overview metrics from raw data, with a fallback to `dashboard_snapshots` if no raw data exists.
- `getTokenAnalytics(userId)` — Computes total tokens, daily/weekly usage arrays, and tokens-per-request average.
- `getRAGAnalytics(userId)` — Computes RAG-specific metrics: retrieval time, top-K, similarity score, empty rate, success rate.
- `getEmbeddingAnalytics(userId)` — Computes embedding metrics: total count, indexed commits, reindex operations, failure count.
- `getPerformanceTimeline(userId, granularity, days)` — Groups raw metrics by time period and computes per-period volume, response time, error rate, and success rate.
- `getConversationAnalytics(userId)` — Aggregates conversation session data with most-active-repository ranking.

**Health Check Functions**:
- `getSystemHealth(userId)` — Runs 5 parallel health checks using `Promise.allSettled()` and aggregates the results.
- `checkLLMProvidersHealth(userId)` — Derives provider health from `computeProviderHealth()`.
- `checkRAGHealth(userId)` — Evaluates RAG pipeline health based on success rate and empty retrieval rate.
- `checkEmbeddingHealth(userId)` — Evaluates embedding health based on failure rate.
- `checkSupabaseHealth()` — Performs a lightweight query and measures round-trip latency.
- `checkGithubHealth()` — Calls GitHub's `/rate_limit` endpoint and checks remaining quota.

**Cost Functions**:
- `getCostEstimates(userId, customConfigs?)` — Matches provider stats against pricing configs and computes per-model costs.

**Report Functions**:
- `generateEngineeringReport(userId)` — Aggregates all analytics into a single `AIEngineeringReport` object, including optimization suggestions.
- `generateOptimizationSuggestions(...)` — Applies rule-based heuristics to identify actionable improvements (e.g., "success rate below 90%", "avg response time above 3s", "RAG empty rate above 30%").
- `exportReportAsMarkdown(report)` — Serializes the report as a formatted Markdown document with tables, bullet lists, and section headers.
- `exportReportAsText(report)` — Converts the Markdown report to plain text by stripping formatting characters.

**Internal Helpers**:
- `updateProviderStats(userId, input)` — Incrementally updates the `provider_statistics` row using a running average formula. Called fire-and-forget from `logRequest()`.
- `computeProviderHealth(stats)` — Pure function that converts `ProviderStats` into a `ProviderHealth` object with status classification (healthy/warning/critical/unknown).
- `mapRequestMetric(row)`, `mapProviderStat(row)`, `mapErrorLog(row)` — Mapper functions that convert database rows (snake_case) into TypeScript objects (camelCase).
- `emptyTokenAnalytics()`, `emptyRAGAnalytics()`, `emptyConversationAnalytics()` — Factory functions that return zero-filled default objects.
- `unknownHealth(name)` — Creates an "unknown" health item for subsystems that cannot be assessed.

#### `src/lib/analytics/collector.ts` — Metrics Instrumentation Wrapper

This file exports two functions:

- **`withMetrics<T>(userId, requestType, operation, options)`**: A generic async wrapper that instruments any AI operation. It captures the start time, executes the operation, measures latency, extracts token counts (via the optional `extractTokens` callback), logs the result to `ai_request_metrics`, and returns the original result unchanged. On error, it classifies the error type based on message heuristics, logs both a request metric and an error log, then re-throws the error. The key design decision is that logging is always **fire-and-forget** (`.catch(() => {})`) — metric logging failure never affects the user's operation.

- **`estimateTokens(text)`**: A utility that estimates token count using `Math.ceil(text.length / 4)`. This is the ~4 characters per token heuristic used when the provider doesn't return token counts.

The `withMetrics()` wrapper is designed to be added to existing LLM/RAG calls without changing their return type or error behavior. It's a non-invasive instrumentation pattern — you wrap an existing function call, and metrics are collected as a side effect.

#### `src/lib/analytics/index.ts` — Barrel Export

A single line: `export * from "./types"` and `export * from "./db"`. This allows consumers to import from `@/lib/analytics` instead of specifying the sub-module path. The `collector.ts` module is intentionally **not** re-exported — it's an internal utility that should be imported directly where needed.

#### `src/app/api/ai-dashboard/route.ts` — Main Dashboard API Route

This is the primary API endpoint for the dashboard. It handles `GET` requests with two optional query parameters:
- `granularity` (daily | weekly | monthly) — Controls the time bucketing for the performance timeline.
- `days` (number, default 30) — Controls how far back to look for timeline data.

The route:
1. Authenticates the user via `supabase.auth.getUser()`. Returns 401 if not authenticated.
2. Fires 10 parallel queries using `Promise.all()`: overview, provider stats (with health computation), token analytics, RAG analytics, embedding analytics, timeline, conversation analytics, error logs, cost estimates, and system health.
3. Returns all data in a single JSON response.

Error handling distinguishes between "tables not found" (returns 503 with a specific `TABLES_MISSING` code so the frontend can show a helpful message) and other errors (returns 500).

#### `src/app/api/ai-dashboard/report/route.ts` — Report Generation API Route

This route handles `GET` requests for report generation and export. It accepts a `format` query parameter:
- `json` (default) — Returns the report as a JSON object.
- `markdown` — Returns the report as a `.md` file with `Content-Disposition: attachment` header.
- `text` — Returns the report as a `.txt` file with `Content-Disposition: attachment` header.

The route authenticates the user, generates the report via `generateEngineeringReport()`, then serializes it in the requested format. The Markdown and Text formats use `NextResponse` with appropriate `Content-Type` headers, triggering a file download in the browser.

#### `src/components/observability/ai-dashboard.tsx` — Main Dashboard Component

This is the largest component in Phase 11 (~933 lines). It is a `"use client"` component that renders the full dashboard with 11 tabbed sections. Key design decisions:

- **Single data fetch**: The component calls `GET /api/ai-dashboard` once on mount and once whenever the granularity changes. All 10 datasets are returned in a single response.
- **Tab-based navigation**: 11 tabs (Overview, Providers, Tokens, RAG, Embeddings, Timeline, Conversations, Errors, Cost, Health, Reports) each render a dedicated sub-component.
- **Recharts visualizations**: The component uses 6 chart types from Recharts — `BarChart` (token usage, cost distribution), `LineChart` (response time timeline), `AreaChart` (request volume, success rate, error rate), `PieChart` (provider distribution, error distribution, RAG outcomes, embedding outcomes), with `ResponsiveContainer` for responsive sizing and `CartesianGrid`/`Tooltip`/`Legend` for readability.
- **State management**: Uses `useState` for `data`, `loading`, `error`, `activeTab`, and `granularity`. Uses `useCallback` for `fetchDashboard` and `handleExport` to avoid unnecessary re-renders.
- **Error handling**: Three distinct error states — loading spinner, "tables not found" message with instructions, and generic error display.
- **Export functionality**: The `handleExport` callback fetches the report from the API, creates a Blob URL, programmatically clicks a download link, and cleans up the URL.
- **Helper functions**: `formatNum()` (abbreviates large numbers: 1.5K, 2.3M), `formatMs()` (converts ms to human-readable: 1.5s, 250ms), `timeAgo()` (relative time: 5m ago, 2h ago, 3d ago).

#### `src/app/(dashboard)/dashboard/ai-dashboard/page.tsx` — Next.js Page Entry Point

A minimal page component that imports and renders the `AIDashboard` component. It's placed in the `(dashboard)` route group so it inherits the dashboard layout (sidebar, authentication guard).

#### `src/app/observability-styles.css` — Dashboard Styles

All CSS for the dashboard (~640 lines). The styles use a consistent `obs-` prefix to avoid collisions with other component styles. Key sections:

- **Page shell** (`.obs-page`, `.obs-page-header`): Max-width container, header typography.
- **Tabs** (`.obs-tabs`, `.obs-tab`): Horizontal scrollable tab bar with active state underline.
- **Cards** (`.obs-card`, `.obs-overview-grid`): 4-column responsive grid (2-col on tablet, 1-col on mobile).
- **Tables** (`.obs-provider-table`, `.obs-cost-table`, `.obs-table-wrap`): Clean table styles with hover states and scrollable wrapper.
- **Status badges** (`.obs-badge-*`): Color-coded pills for healthy (green), warning (yellow), critical (red), unknown (gray).
- **Health grid** (`.obs-health-grid`, `.obs-health-item.*`): Auto-fill grid with status-colored backgrounds and borders.
- **Error list** (`.obs-error-list`, `.obs-error-item`): Stacked error cards with type badges, messages, and timestamps.
- **Charts** (`.obs-chart-wrap`, `.obs-chart-empty`): Bordered chart containers with centered empty states.
- **Controls** (`.obs-btn`, `.obs-timeline-btn`): Button styles with primary variant.
- **States** (`.obs-loading`, `.obs-spinner`, `.obs-empty`, `.obs-error-state`): Loading spinner animation, empty state, error state.
- **Utilities** (`.obs-estimated`, `.obs-two-col`, `.obs-metric-row`): Estimated badge, two-column layout, metric detail rows.

### Modified Files

#### `src/app/globals.css`

A single line was added: `@import "./observability-styles.css";` — This imports the observability styles into the global stylesheet, making all `.obs-*` classes available throughout the application.

#### `src/components/dashboard/dashboard-content.tsx`

A new feature card was added to the dashboard grid:
- Imports the `Activity` icon from `lucide-react` (alongside existing imports like `LogOut`, `ChevronRight`, `FolderGit2`).
- Adds a new `FeatureCard` with `title="AI Engineering Dashboard"`, `description="Monitor LLM usage, RAG performance, provider health, and system observability."`, `icon={Activity}`, `phase={11}`, and `href="/dashboard/ai-dashboard"`.
- The card is rendered with an animation delay of `0.63s` (consistent with the staggered animation pattern used by other feature cards).

---

## 5. Database

### Table: `ai_request_metrics`

This is the primary metrics table — every AI request (LLM, RAG, embedding, or specialized analysis) logs a row here.

| Column | Type | Purpose |
|---|---|---|
| `id` | UUID (PK) | Unique identifier |
| `user_id` | UUID (FK → auth.users) | Tenant isolation |
| `repository_id` | UUID (nullable) | Which repository the request was for |
| `request_type` | VARCHAR(20) | One of: llm, rag, embedding, health_analysis, doc_generation, evolution_analysis, commit_explain |
| `provider` | VARCHAR(50) | LLM provider name (e.g., "groq") |
| `model` | VARCHAR(100) | Model name (e.g., "llama-3.3-70b-versatile") |
| `status` | VARCHAR(20) | One of: success, error, rate_limited, timeout |
| `latency_ms` | INTEGER | End-to-end latency in milliseconds |
| `prompt_tokens` | INTEGER | Tokens in the input prompt |
| `completion_tokens` | INTEGER | Tokens in the LLM output |
| `total_tokens` | INTEGER | Sum of prompt and completion tokens |
| `tokens_estimated` | BOOLEAN | Whether token counts were estimated |
| `error_type` | VARCHAR(50) | Classified error type (nullable on success) |
| `error_message` | TEXT | Full error message (nullable on success) |
| `metadata` | JSONB | Arbitrary key-value data (top-K, similarity scores, etc.) |
| `created_at` | TIMESTAMPTZ | When the request was made |

The CHECK constraint on `request_type` ensures only valid values are inserted. The `metadata` JSONB column is the extensibility mechanism — it allows logging arbitrary structured data without schema changes. For example, RAG requests store `topK` and `avgSimilarity` in metadata, and embedding requests store `reindex: true` for re-indexing operations.

### Table: `provider_statistics`

This table maintains **aggregated per-provider, per-model statistics** that are updated incrementally on every request. Rather than recomputing aggregates from the full `ai_request_metrics` table on every dashboard load, this table provides O(1) access to current stats.

| Column | Type | Purpose |
|---|---|---|
| `id` | UUID (PK) | Unique identifier |
| `user_id` | UUID (FK) | Tenant isolation |
| `provider` | VARCHAR(50) | Provider name |
| `model` | VARCHAR(100) | Model name |
| `total_requests` | INTEGER | Cumulative request count |
| `successful_requests` | INTEGER | Cumulative success count |
| `failed_requests` | INTEGER | Cumulative failure count |
| `rate_limited_requests` | INTEGER | Cumulative rate limit count |
| `total_prompt_tokens` | BIGINT | Cumulative prompt tokens |
| `total_completion_tokens` | BIGINT | Cumulative completion tokens |
| `total_tokens` | BIGINT | Cumulative total tokens |
| `tokens_estimated` | BOOLEAN | Whether any tokens were estimated |
| `avg_latency_ms` | NUMERIC(10,2) | Running average latency |
| `min_latency_ms` | INTEGER | Minimum observed latency |
| `max_latency_ms` | INTEGER | Maximum observed latency |
| `last_success_at` | TIMESTAMPTZ | Timestamp of last successful request |
| `last_failure_at` | TIMESTAMPTZ | Timestamp of last failed request |
| `last_request_at` | TIMESTAMPTZ | Timestamp of most recent request |
| `created_at` | TIMESTAMPTZ | Row creation time |
| `updated_at` | TIMESTAMPTZ | Last update time (auto-updated by trigger) |

The `UNIQUE(user_id, provider, model)` constraint ensures exactly one row per provider-model combination per user. The `updateProviderStats()` function in `db.ts` implements an **incremental update pattern**: it reads the existing row, computes the new running average, and updates in place. This avoids the O(n) cost of `SELECT AVG(...) FROM ai_request_metrics GROUP BY provider, model` on every request.

### Table: `ai_error_logs`

This table stores detailed error records for investigation and debugging.

| Column | Type | Purpose |
|---|---|---|
| `id` | UUID (PK) | Unique identifier |
| `user_id` | UUID (FK) | Tenant isolation |
| `repository_id` | UUID (nullable) | Associated repository |
| `error_type` | VARCHAR(50) | Classified error type (8 possible values) |
| `provider` | VARCHAR(50) | Provider that caused the error |
| `request_type` | VARCHAR(20) | Type of request that failed |
| `error_message` | TEXT | Full error message |
| `error_details` | JSONB | Structured error context |
| `resolved` | BOOLEAN | Whether the error has been investigated |
| `created_at` | TIMESTAMPTZ | When the error occurred |

The `resolved` boolean enables a future workflow where operators can mark errors as investigated. The `error_details` JSONB column can store provider-specific error codes, HTTP status codes, or stack traces.

### Table: `dashboard_snapshots`

This table stores daily aggregated snapshots for efficient trend queries. Instead of scanning millions of raw metrics rows to compute a 30-day trend, the dashboard can query 30 snapshot rows.

| Column | Type | Purpose |
|---|---|---|
| `id` | UUID (PK) | Unique identifier |
| `user_id` | UUID (FK) | Tenant isolation |
| `snapshot_date` | DATE | The date this snapshot covers |
| `total_ai_requests` | INTEGER | Total AI requests that day |
| `total_rag_requests` | INTEGER | RAG-specific count |
| `total_embeddings` | INTEGER | Embedding count |
| `total_llm_requests` | INTEGER | LLM and analysis count |
| `total_health_analyses` | INTEGER | Health analysis count |
| `total_doc_generations` | INTEGER | Document generation count |
| `total_evolution_analyses` | INTEGER | Evolution analysis count |
| `total_commit_explains` | INTEGER | Commit explanation count |
| `active_repositories` | INTEGER | Distinct repos with AI activity |
| `total_conversations` | INTEGER | New conversation sessions |
| `ai_success_rate` | NUMERIC(5,4) | Success rate (0.0000 to 1.0000) |
| `avg_response_time_ms` | NUMERIC(10,2) | Average LLM response time |
| `avg_retrieval_time_ms` | NUMERIC(10,2) | Average RAG retrieval time |
| `total_prompt_tokens` | BIGINT | Total prompt tokens |
| `total_completion_tokens` | BIGINT | Total completion tokens |
| `total_tokens` | BIGINT | Total tokens |
| `total_errors` | INTEGER | Total error count |
| `provider_breakdown` | JSONB | `{provider_name: count}` map |
| `error_breakdown` | JSONB | `{error_type: count}` map |
| `created_at` | TIMESTAMPTZ | Snapshot creation time |

The `UNIQUE(user_id, snapshot_date)` constraint ensures one snapshot per user per day. The `ON CONFLICT DO UPDATE` clause in the `generate_daily_snapshot()` function allows re-running for the same date (idempotent upsert).

### Table: `conversation_sessions`

This table tracks conversation sessions — a "session" is a series of messages between a user and the AI about a specific repository.

| Column | Type | Purpose |
|---|---|---|
| `id` | UUID (PK) | Unique identifier |
| `user_id` | UUID (FK) | Tenant isolation |
| `repository_id` | UUID (FK) | Which repository |
| `message_count` | INTEGER | Total messages in the session |
| `total_ai_responses` | INTEGER | Number of AI-generated responses |
| `avg_response_length` | INTEGER | Average AI response length in characters |
| `total_tokens_used` | INTEGER | Total tokens consumed |
| `started_at` | TIMESTAMPTZ | Session start time |
| `last_activity_at` | TIMESTAMPTZ | Last message timestamp |

### Row Level Security (RLS)

All five tables have RLS enabled with the same pattern: each user can only SELECT, INSERT, and UPDATE rows where `user_id` matches `auth.uid()`. This is enforced at the database level — even if a bug in the application code accidentally queries another user's data, the database will return an empty result set.

The RLS policies follow a consistent naming convention: `"Users can view own [table]"`, `"Users can insert own [table]"`, `"Users can update own [table]"`. No DELETE policies are created — metrics data is never deleted by users (only by administrative cleanup jobs, which would bypass RLS using a service role key).

### Indexes

13 indexes are created to optimize the most common query patterns:

| Index | Table | Columns | Rationale |
|---|---|---|---|
| `idx_ai_request_metrics_user_id` | ai_request_metrics | `(user_id)` | Every query filters by user_id |
| `idx_ai_request_metrics_created_at` | ai_request_metrics | `(created_at)` | Timeline queries filter by date range |
| `idx_ai_request_metrics_type` | ai_request_metrics | `(user_id, request_type)` | RAG/embedding analytics filter by type |
| `idx_ai_request_metrics_status` | ai_request_metrics | `(user_id, status)` | Error rate queries filter by status |
| `idx_provider_stats_user` | provider_statistics | `(user_id)` | Dashboard queries filter by user |
| `idx_provider_stats_provider` | provider_statistics | `(user_id, provider)` | Provider-specific queries |
| `idx_error_logs_user` | ai_error_logs | `(user_id)` | Error log queries filter by user |
| `idx_error_logs_type` | ai_error_logs | `(user_id, error_type)` | Error type filtering |
| `idx_error_logs_created` | ai_error_logs | `(created_at)` | Date range queries on errors |
| `idx_snapshots_user_date` | dashboard_snapshots | `(user_id, snapshot_date)` | Snapshot lookups by user+date |
| `idx_conversations_user` | conversation_sessions | `(user_id)` | Conversation queries by user |
| `idx_conversations_repo` | conversation_sessions | `(user_id, repository_id)` | Per-repo conversation queries |

The composite indexes (e.g., `(user_id, request_type)`) are more efficient than single-column indexes because PostgreSQL can use them for queries that filter on both columns, and they also serve queries that filter on just the first column (leftmost prefix rule).

### The `generate_daily_snapshot()` Function

This PL/pgSQL function aggregates a single day's raw metrics into a `dashboard_snapshots` row. It takes two parameters: `p_user_id` (UUID) and `p_date` (DATE).

The function performs 7 aggregation queries against `ai_request_metrics` (filtered to the given user and date range) and 1 query against `conversation_sessions`. It computes:
- Request counts by type (total, RAG, embedding, LLM, health analysis, doc generation, evolution analysis, commit explain) using `COUNT(*) FILTER (WHERE ...)` syntax.
- Success rate as a ratio of successful requests to total requests.
- Average response time and average retrieval time using `AVG()`.
- Token sums using `COALESCE(SUM(...), 0)`.
- Error count as requests with status in (error, rate_limited, timeout).
- Active repository count using `COUNT(DISTINCT repository_id)`.
- Conversation count from the sessions table.
- Provider breakdown and error breakdown as JSONB objects using `jsonb_object_agg()`.

The final `INSERT ... ON CONFLICT DO UPDATE` makes the function idempotent — running it twice for the same user+date produces the same result. This function is designed to be called by a scheduled job (e.g., a pg_cron task running at midnight each day) to pre-compute daily snapshots.

### The Incremental `updateProviderStats()` Pattern

The `updateProviderStats()` function in `db.ts` implements an **incremental aggregation** pattern. Instead of recomputing provider statistics from scratch on every request, it:

1. Queries the existing row for the `(user_id, provider, model)` combination.
2. If the row exists, computes a new running average: `newAvg = (oldAvg × oldCount + newValue) / (oldCount + 1)`.
3. Increments counters (total_requests, successful_requests, etc.) by 1 or 0 depending on the current request's status.
4. Updates `min_latency_ms` and `max_latency_ms` by comparing against the current request's latency.
5. Updates timestamp fields (`last_request_at`, `last_success_at`, `last_failure_at`).
6. If the row doesn't exist, inserts a new row with all values initialized from the current request.

This pattern provides O(1) update cost per request, compared to O(n) for a full table scan aggregation. The trade-off is that the running average is a numerical approximation (it doesn't account for data skew in the same way a true `AVG()` over all rows would), but for monitoring purposes, the approximation is more than sufficient.

### Why Fire-and-Forget for Metric Logging

Metric logging uses the fire-and-forget pattern throughout Phase 11. When `logRequest()` is called, it inserts the metric row, then calls `updateProviderStats()` with `.catch(() => {})` — meaning any error in the stats update is silently swallowed. Similarly, `withMetrics()` calls `logRequest().catch(() => {})` and `logError().catch(() => {})`.

The rationale is simple: **metric logging must never affect the user's operation**. If the metrics database is down, or the insert fails, or the provider stats update times out, the user's LLM response should still be returned successfully. Metric logging is a side effect, not a critical path. The `.catch(() => {})` ensures that a rejected promise doesn't propagate as an unhandled rejection.

---

## 6. Performance

### Efficient Metric Collection

The metric collection pipeline is designed for minimal overhead:

1. **Fire-and-forget logging**: As discussed, all metric writes are non-blocking. The `logRequest()` call is awaited (to get the inserted row's ID), but `updateProviderStats()` and `logError()` are fire-and-forget. The `withMetrics()` wrapper awaits the user's operation and the primary metric log, but not the secondary side effects.

2. **Incremental provider stats updates**: The `updateProviderStats()` function performs a read-modify-write cycle on a single row (keyed by `user_id + provider + model`). This is O(1) — it doesn't scale with the total number of metrics.

3. **No external dependencies for collection**: The collector uses only `Date.now()` for timing and standard error message inspection for classification. No external tracing libraries, no message queues, no background workers.

### Aggregation Strategy

The system uses a two-tier aggregation strategy:

**Tier 1 — Raw metrics** (`ai_request_metrics`): Every request writes a row. These rows are used for:
- Dashboard overview (all-time aggregates)
- Token analytics (daily/weekly usage charts)
- RAG analytics (per-request metadata extraction)
- Performance timeline (per-period grouping)

**Tier 2 — Daily snapshots** (`dashboard_snapshots`): Pre-computed daily aggregates stored by the `generate_daily_snapshot()` function. These are used as a **fallback** when raw metrics are unavailable (e.g., if the raw table is empty or hasn't been populated yet). They're also the intended primary source for long-term trend queries (e.g., "show me the last 365 days of usage") — querying 365 snapshot rows is dramatically faster than querying potentially millions of raw metric rows.

Currently, the dashboard primarily queries raw metrics (Tier 1) for all analytics. The `getDashboardOverview()` function falls back to snapshots if raw data is empty. In a production system with high volume, the dashboard would be optimized to query snapshots for historical data and raw metrics only for recent data (e.g., today's data that hasn't been snapshotted yet).

### Historical Analytics

The performance timeline supports three granularities, each computed by grouping raw metrics by a time key:

- **Daily**: Groups by `date.toISOString().slice(0, 10)` (e.g., "2025-01-15"). Each group represents one calendar day.
- **Weekly**: Groups by the ISO week start date (Sunday). Computed by `weekStart.setDate(d.getDate() - d.getDay())`.
- **Monthly**: Groups by `YYYY-MM` (e.g., "2025-01"). Each group represents one calendar month.

The `getPerformanceTimeline()` function accepts a `days` parameter (default 30) that limits the raw data fetch to the recent period, preventing unnecessary full-table scans. For each time bucket, it computes `requestVolume`, `responseTimeMs`, `retrievalTimeMs`, `errorRate`, and `successRate`.

### Dashboard Refresh Strategy

The dashboard uses a **single API call** strategy: `GET /api/ai-dashboard` returns all 10 analytics datasets in one response. This avoids the N+1 query pattern (where the frontend makes separate API calls for each section).

On the server side, the API route uses `Promise.all()` to fetch all 10 datasets in **parallel**. This means the total response time is determined by the slowest individual query, not the sum of all query times. For example, if the overview takes 50ms, token analytics takes 80ms, and system health takes 300ms (because it makes an external HTTP call to GitHub), the total response time is ~300ms — not 430ms.

The frontend re-fetches data when the user changes the timeline granularity (daily/weekly/monthly), but does not implement automatic polling or real-time updates. This is a deliberate simplification for Phase 11 — real-time updates would require WebSocket or SSE connections, which are listed as a future improvement.

### Why We Query Raw Metrics for Overview and Use Snapshots as Fallback

The `getDashboardOverview()` function first attempts to query `ai_request_metrics` directly. If the query returns no data (empty table or query error), it falls back to `dashboard_snapshots`. This design decision was made because:

1. **Accuracy**: Raw metrics are always more accurate than snapshots. Snapshots are pre-computed and may be stale if the daily aggregation job hasn't run yet.
2. **Simplicity**: For a system with moderate volume (thousands of requests, not millions), querying all raw metrics for a single user is fast enough — Supabase's PostgreSQL handles this in milliseconds.
3. **Graceful degradation**: If the raw metrics table doesn't exist (e.g., the migration hasn't been run), the function gracefully falls back to snapshots. This prevents the dashboard from crashing during initial setup.

In a high-volume production system, this strategy would be inverted: snapshots would be the primary source, and raw metrics would only be queried for "today's" data that hasn't been snapshotted yet.

---

## 7. Security

### Metric Isolation via RLS

Every analytics table has Row Level Security enabled with policies that restrict access to the authenticated user's own data. The policy pattern is consistent across all tables:

```sql
CREATE POLICY "Users can view own [table]" ON [table]
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own [table]" ON [table]
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own [table]" ON [table]
  FOR UPDATE USING (auth.uid() = user_id);
```

This means:
- A user can only read their own metrics, never another user's.
- A user can only insert metrics with their own `user_id`. Even if a malicious client sends a request with a different `user_id`, the database will reject it.
- A user can only update their own rows (relevant for the `resolved` flag on error logs).

RLS operates at the database level, below the application layer. This is a defense-in-depth measure — even if the application has a bug that leaks data, the database will still enforce isolation.

### Authorization Check in Every API Route

Both API routes (`/api/ai-dashboard` and `/api/ai-dashboard/report`) perform authentication before any data access:

```typescript
const supabase = await createClient();
const { data: { user } } = await supabase.auth.getUser();
if (!user) {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}
```

This uses Supabase's server-side auth to validate the user's session cookie. If the user is not authenticated, the route returns HTTP 401 before executing any database queries. This is the first line of defense — RLS is the second line.

### Safe Logging

Metric logging is designed to avoid capturing Personally Identifiable Information (PII):

- **No user content in metrics**: The `ai_request_metrics` table stores `request_type`, `provider`, `model`, and `latency_ms` — not the actual prompt text or LLM response. The `error_message` field stores the technical error message from the provider, not user input.
- **Error messages are sanitized by the provider**: LLM providers return generic error messages (e.g., "Rate limit exceeded") that don't contain user data.
- **Metadata is controlled**: The `metadata` JSONB field is populated by the application code (e.g., `topK`, `avgSimilarity`), not by user input. No user-supplied data is written to metadata without explicit application-level filtering.
- **No repository content**: Repository names, file contents, and commit messages are not stored in the metrics tables. Only the `repository_id` UUID is stored, which is meaningless without access to the `repositories` table.

### Environment Variable Management

No API keys, secrets, or configuration values are exposed to the client. The dashboard component fetches data from API routes, which run server-side where environment variables are accessible. The cost configuration (`DEFAULT_COST_CONFIGS`) is hardcoded in `db.ts` (server-side only), not in the client component. The Groq API key, Supabase service role key, and other secrets remain in environment variables and are never sent to the browser.

### Export Security

Report exports are generated entirely server-side. The `exportReportAsMarkdown()` and `exportReportAsText()` functions run in the API route handler (server-side), and the resulting file is returned as an HTTP response with `Content-Disposition: attachment`. The client never has access to the raw report data in a manipulable form — it receives the file as a binary blob. This prevents a malicious client from modifying the report content before saving it.

---

## 8. Future Improvements

### 1. Real-Time Monitoring via WebSocket/SSE

The current dashboard polls data on mount and on granularity change. A significant improvement would be implementing real-time metric updates using Server-Sent Events (SSE) or WebSockets. When a new metric is logged, the server would push the updated data to all connected dashboard clients. This would enable live-updating charts, instant error notifications, and real-time health status changes. SSE is simpler to implement (unidirectional, HTTP-based) and is the recommended starting point. WebSockets add bidirectional communication capability, which would be needed if the dashboard also needs to send commands (e.g., "pause metric collection").

### 2. Threshold-Based Alerting

The current system is passive — it shows you what happened, but doesn't tell you when something needs attention. Alerting would add active notification when metrics cross defined thresholds. For example: "alert when success rate drops below 90% for 5 consecutive minutes," or "alert when estimated daily cost exceeds $5." Alerts could be delivered via email (using Supabase's auth.emails), webhooks (POST to a user-configured URL), or in-app notifications. The `generateOptimizationSuggestions()` function already implements rule-based heuristics — these could be extended into a formal alerting engine with configurable thresholds and notification channels.

### 3. Outbound Webhooks for Critical Events

Webhooks would allow the system to notify external services (Slack, PagerDuty, custom dashboards) when critical events occur. A webhook configuration table would store user-defined URLs and event subscriptions. When a critical error is logged (e.g., provider returns 500), the system would POST a JSON payload to the configured webhook URL. This integrates the observability system into the team's existing incident response workflow.

### 4. Distributed Tracing with Correlation IDs

The current system tracks per-request latency but doesn't trace requests across service boundaries. A distributed tracing system would assign a unique correlation ID to each user request and propagate it through the entire chain: frontend → API route → RAG retrieval → vector DB query → LLM call → response. Each step would log a "span" with its own timing, creating a trace tree that shows exactly where time was spent. This is particularly valuable for RAG requests, where latency is the sum of embedding computation, vector search, context assembly, and LLM inference — knowing which step is slow enables targeted optimization.

### 5. Multi-Region Analytics for Distributed Teams

For teams with members in different geographic regions, a multi-region analytics system would aggregate metrics across regions and provide a global dashboard. This requires a central analytics database that receives metrics from all regional deployments, or a federated query system that aggregates results from regional databases. The current single-tenant-per-user model would need to be extended to support organization-level rollups, where a team admin can see aggregated metrics across all team members.

### 6. PDF Report Export

The current export layer supports Markdown and plain text. Adding PDF export would involve rendering the report to a PDF document on the server side. This could be implemented using a library like Puppeteer (headless Chrome), jsPDF, or a server-side PDF generation service. The `exportReportAsMarkdown()` function already produces structured content — a PDF renderer would need to parse this structure and produce a professionally formatted document with headers, tables, and charts. The existing `ExportFormat` type would be extended to include `"pdf"`, and the report route would handle the new format.

### 7. Custom Metric Dashboards

The current dashboard has 11 fixed tabs. A significant improvement would allow users to create custom dashboards with configurable widgets. Each widget would be bound to a specific metric (e.g., "success rate over time," "token usage by model," "error count by type") with user-configured parameters (time range, filters, visualization type). This requires a widget configuration schema stored in the database, a widget rendering engine that maps configuration to chart components, and a drag-and-drop layout editor. This transforms the dashboard from a fixed monitoring view into a flexible analytics platform.

### 8. ML-Based Anomaly Detection

The current health check system uses static thresholds (e.g., "success rate below 80% = warning"). Anomaly detection would replace these static thresholds with machine learning models that learn the normal behavior patterns for each metric and flag deviations. For example, a sudden spike in latency that doesn't cross any static threshold but is statistically anomalous (e.g., 3 standard deviations above the rolling 7-day average) would be flagged. This could be implemented using simple statistical methods (Z-score, IQR), time-series models (ARIMA, exponential smoothing), or more sophisticated approaches (isolation forests, autoencoders). The `dashboard_snapshots` table provides the historical data needed for training these models.

### 9. A/B Testing for Model Performance

When multiple LLM models are available (e.g., llama-3.3-70b-versatile vs. llama-3.1-8b-instant), A/B testing would route a percentage of traffic to each model and compare their performance on key metrics: latency, success rate, token usage, and (most importantly) output quality. This requires a traffic splitter that assigns a model variant to each request, stores the variant assignment in `metadata`, and provides statistical comparison tools (confidence intervals, p-values) in the dashboard. The `provider_statistics` table already tracks per-model metrics — A/B testing would add the traffic routing layer and statistical analysis on top.

---

## 9. Interview Preparation

### AI Observability Concepts

**Q1: What is observability, and how does it differ from monitoring?**
Observability is the property of a system that allows its internal state to be inferred from its external outputs, while monitoring is the act of collecting and analyzing those outputs. Observability is a system property — you design for it — whereas monitoring is an operational activity that relies on the system being observable. A system with good observability lets you ask arbitrary questions about its state without deploying new code (e.g., "why did this specific request take 5 seconds?"), whereas a system with poor observability only lets you check predefined dashboards and alerts.

**Q2: What are the three pillars of observability, and what does each one tell you?**
The three pillars are metrics (quantitative measurements like latency and throughput that answer "how much?" and "how fast?"), logs (timestamped event records that answer "what exactly happened?"), and traces (end-to-end request journeys that answer "where did the time go?"). Metrics are best for trend analysis and alerting, logs are best for debugging specific incidents, and traces are best for understanding performance bottlenecks in distributed systems. A mature observability system uses all three pillars together — metrics detect the problem, logs explain the problem, and traces pinpoint the problem's location.

**Q3: Why do AI systems need different observability than traditional web applications?**
AI systems introduce non-determinism (the same input can produce different outputs and different latencies), external dependency on third-party providers (rate limits, model degradation, outages), token-based billing (costs scale with usage and are hard to predict), and quality degradation (hallucinations, retrieval failures) that doesn't manifest as crashes. Traditional monitoring focuses on uptime and error rates, but AI observability must additionally track output quality, token consumption, cost trends, and provider reliability — all of which are unique to AI workloads.

**Q4: What is the difference between a metric and a log?**
A metric is a numeric value that can be aggregated, averaged, and graphed — it's a point measurement (e.g., "latency was 250ms"). A log is a structured or unstructured text record of an event — it carries context and detail (e.g., "request to Groq llama-3.3-70b failed with HTTP 429: rate limit exceeded, retry after 30s"). Metrics are efficient to store and query at scale (you can aggregate millions of data points into a single average), while logs are expensive to store but irreplaceable for debugging. In practice, you use metrics to detect problems and logs to diagnose them.

**Q5: What is a Service Level Objective (SLO), and how would you define one for an AI system?**
An SLO is a target value for a service level indicator (SLI) measured over a time window, expressing the expected reliability of a service. For an AI system, an SLO might be "99% of LLM requests will complete with a latency below 3 seconds over a 30-day rolling window" or "the RAG pipeline will return non-empty results for at least 85% of queries over any 7-day period." SLOs translate abstract reliability goals into measurable commitments, and they drive alerting thresholds — you alert when you're at risk of breaching the SLO, not when the SLO has already been breached.

### LLM Monitoring

**Q6: How would you monitor token usage to control LLM costs?**
I would track prompt tokens, completion tokens, and total tokens per request, per model, and per time period. By maintaining per-model cost configurations (prompt cost per 1K tokens, completion cost per 1K tokens), I can compute estimated costs in real time. I would set daily and monthly cost budgets and alert when usage trends project an overrun. The most impactful optimization is reducing prompt token usage — by caching frequent RAG queries, truncating conversation history, or using smaller context windows — because prompt tokens often account for 60-80% of total token consumption in RAG systems.

**Q7: What causes latency variance in LLM calls, and how do you diagnose it?**
LLM latency varies due to provider queue depth (more concurrent users = longer queue times), input complexity (longer prompts and more tokens take longer to process), model size (70B parameter models are slower than 8B models), network conditions (intermittent congestion between your server and the provider), and provider-side issues (model loading, server maintenance). To diagnose, I would track p50, p95, and p99 latency percentiles by provider and model, correlate latency spikes with error rates (a spike in both suggests provider issues), and check if latency correlates with prompt length (suggesting the model is the bottleneck rather than the network).

**Q8: How would you detect if an LLM model has degraded in quality?**
I would track proxy metrics that correlate with output quality: success rate (if the model starts returning malformed responses), hallucination rate (if downstream validation catches factual errors), user satisfaction signals (thumbs up/down, re-query rate), and response length (a sudden change in average response length might indicate model drift). For RAG systems, I would monitor the average similarity score of retrieved documents — a declining score suggests the embedding model or index has drifted. I would also compare metrics across model versions to detect regressions after provider updates.

**Q9: What is rate limiting, and how do you handle it in an AI pipeline?**
Rate limiting is a provider-side mechanism that restricts the number of requests (RPM) or tokens (TPM) a client can send within a time window. When the limit is exceeded, the provider returns HTTP 429. I handle this by classifying 429 responses as `rate_limited` (not `error`), tracking rate-limited request counts per provider, implementing exponential backoff with jitter for retries, and displaying the rate limit status in the dashboard. If rate limiting becomes frequent, I would consider caching frequent responses, batching requests, or upgrading the provider plan.

**Q10: Why is it important to track prompt tokens and completion tokens separately?**
They have different cost structures — completion tokens are typically 2-10x more expensive than prompt tokens because generation is computationally more intensive than encoding. They also have different optimization strategies — prompt tokens can be reduced by shortening system prompts, truncating conversation history, or improving RAG retrieval relevance, while completion tokens can be reduced by using more specific prompts that elicit concise responses. Tracking them separately lets you identify which side of the equation is driving costs and target your optimization efforts accordingly.

### Performance Engineering

**Q11: Why are percentile metrics (p50, p95, p99) better than averages for latency monitoring?**
Averages are sensitive to outliers in a way that hides the user experience. If 99 requests take 200ms and 1 takes 10,000ms, the average is 298ms — which looks fine — but the p99 of 10,000ms reveals that 1% of users had a terrible experience. Percentiles tell you the real distribution: p50 (median) is what the typical user experiences, p95 is what most users experience, and p99 is the worst-case for all but 1% of users. SLOs should be defined on percentiles, not averages, because users don't experience the average — they experience a single request.

**Q12: What is the fire-and-forget pattern, and when is it appropriate?**
Fire-and-forget is a pattern where an asynchronous operation is initiated but its result is not awaited — typically by calling `.catch(() => {})` on the returned promise. It's appropriate for non-critical side effects that must not block or fail the primary operation. In Phase 11, metric logging uses fire-and-forget because a metrics database failure should never prevent the user from receiving their AI response. The trade-off is that you lose the ability to handle errors from the fire-and-forget operation — if the metrics write fails, it fails silently. This is acceptable for telemetry but not for operations where the side effect is critical (e.g., sending a confirmation email).

**Q13: How does `Promise.all()` improve dashboard loading performance?**
`Promise.all()` executes multiple asynchronous operations in parallel and resolves when all of them complete. Without it, you would need to `await` each query sequentially, and the total time would be the sum of all individual query times. With `Promise.all()`, the total time is the maximum of the individual query times (the slowest one). For Phase 11's dashboard, which fires 10 queries, `Promise.all()` reduces the theoretical total from `t1 + t2 + ... + t10` to `max(t1, t2, ..., t10)`. In practice, the database connection pool and PostgreSQL's query parallelism provide additional concurrency benefits.

**Q14: What is incremental aggregation, and when would you use it instead of a full table scan?**
Incremental aggregation maintains a running aggregate (count, average, sum) that is updated on each new data point, rather than recomputing from scratch. It's O(1) per update versus O(n) for a full scan. Phase 11's `updateProviderStats()` uses this pattern — each new request updates the running average and counters in the `provider_statistics` table. The trade-off is that incremental aggregation requires an existing summary row to update (you need the read-modify-write cycle), and it's less accurate than a full scan for certain statistics (e.g., median, which can't be computed incrementally). For high-frequency updates (every request), incremental aggregation is essential; for periodic reporting (daily snapshots), a full scan is acceptable.

**Q15: How would you optimize a dashboard that queries millions of rows?**
I would use a combination of strategies: (1) pre-aggregate raw data into daily/hourly summary tables (materialized views or snapshot tables), (2) use covering indexes that include all columns needed by the query (avoiding heap lookups), (3) partition the raw metrics table by date range (enabling partition pruning for time-bounded queries), (4) implement server-side caching with a short TTL (e.g., Redis with 30-second expiration), (5) use `Promise.all()` for parallel queries, and (6) paginate or limit results client-side. Phase 11 implements strategies 1 (snapshots), 3 (date-based filtering with indexes), 5 (parallel queries), and 6 (limits on error logs and timeline data).

### Analytics System Design

**Q16: How would you design a metrics collection system that doesn't impact request latency?**
I would use the fire-and-forget pattern for all metric writes — the request handler starts the metric write asynchronously and immediately returns the response to the user. For higher throughput, I would buffer metrics in memory and flush them in batches (e.g., every 100 metrics or every 5 seconds) to reduce database round-trips. For very high throughput, I would use a message queue (e.g., Kafka, Redis Streams) between the request handlers and the metrics consumer, completely decoupling metric collection from request processing. Phase 11 uses the simplest approach — fire-and-forget direct database writes — which is sufficient for moderate throughput.

**Q17: What is the difference between a snapshot table and a raw metrics table?**
A raw metrics table stores one row per event (e.g., one row per AI request), providing granular detail but growing unboundedly. A snapshot table stores one row per time period (e.g., one row per day per user), providing pre-computed aggregates that are much smaller and faster to query. Snapshots are computed from raw data on a schedule (e.g., daily via pg_cron). The trade-off is that snapshots lose granularity — you can't drill down to individual requests from a snapshot. In practice, you keep raw data for a limited retention period (e.g., 90 days) and snapshots indefinitely, using raw data for detailed debugging and snapshots for long-term trend analysis.

**Q18: How would you handle metrics data retention at scale?**
I would implement a tiered retention strategy: raw metrics are kept for 90 days (sufficient for debugging recent incidents), daily snapshots are kept indefinitely, and hourly or minutely aggregates are kept for 1 year. A scheduled job (pg_cron or an external cron) would delete raw metrics older than the retention period. For cost efficiency, I would consider partitioning the raw metrics table by month and dropping old partitions (which is a metadata-only operation in PostgreSQL, much faster than row-by-row deletion). The `dashboard_snapshots` table serves as the long-term storage tier in Phase 11.

**Q19: What is Row Level Security, and why is it important for multi-tenant analytics?**
Row Level Security (RLS) is a PostgreSQL feature that restricts which rows a user can access based on a policy, operating at the database level below the application layer. For multi-tenant analytics, RLS ensures that each user can only see their own metrics — even if the application code has a bug that queries the wrong user_id, the database will return an empty result set. This is a defense-in-depth measure that complements application-level authorization checks. Without RLS, a single SQL injection vulnerability or ORM bug could expose one user's metrics to another.

**Q20: How would you design an export system that supports multiple formats?**
I would use the Strategy pattern, where each export format is implemented as a separate strategy function that takes a common data structure (e.g., `AIEngineeringReport`) and returns a formatted string. A format registry maps format identifiers to strategy functions. The API route reads the requested format, looks up the corresponding strategy, and returns the result. Phase 11 implements this pattern: `exportReportAsMarkdown()` and `exportReportAsText()` are strategy functions, and the report route dispatches based on the `format` query parameter. Adding a new format (e.g., PDF, CSV, HTML) requires only adding a new strategy function and a new case in the route handler.

### Production AI Systems

**Q21: How do you decide when to cache an LLM response vs. making a fresh call?**
Caching is appropriate when the same input is likely to produce the same (or a sufficiently similar) output, and when the cost of a cache miss (serving stale data) is acceptable. For factual questions about a repository (e.g., "what does this function do?"), caching is safe because the code hasn't changed. For creative tasks (e.g., "generate a summary"), caching is risky because the user might expect a fresh perspective. Cache keys should be derived from the full prompt (including RAG context) to ensure consistency. Cache invalidation should be triggered by repository updates (new commits, file changes). Phase 11 doesn't implement caching, but the cost estimation and token analytics would help identify which queries are most worth caching (high frequency, high token usage).

**Q22: What is a circuit breaker, and how would you use it with LLM providers?**
A circuit breaker is a design pattern that prevents cascading failures by temporarily stopping calls to a failing service. It has three states: closed (normal operation), open (all calls are rejected immediately), and half-open (a limited number of test calls are allowed). For LLM providers, I would implement a circuit breaker that opens when the error rate exceeds a threshold (e.g., 50% over 5 minutes) for a cooldown period (e.g., 60 seconds). While open, requests would be routed to a fallback provider or returned with a graceful error. Phase 11's `computeProviderHealth()` function provides the health assessment that would feed into a circuit breaker — a "critical" status would trigger the open state.

**Q23: How would you implement graceful degradation when an AI provider is unavailable?**
I would implement a multi-layered degradation strategy: (1) try the primary provider, (2) on failure, try a fallback provider (e.g., switch from llama-3.3-70b to llama-3.1-8b), (3) if all providers fail, return a cached response if available, (4) if no cache exists, return a graceful error message that explains the situation and suggests the user try again later. Throughout this process, all failures are logged to the error tracking system. The dashboard's health check tab would show the current provider status, enabling operators to see degradation in real time. Phase 11 logs all failures but doesn't implement automatic failover — the `computeProviderHealth()` function provides the data needed to build it.

**Q24: What is the ~4 characters per token heuristic, and why is it only an approximation?**
The heuristic estimates that roughly 4 characters of English text correspond to 1 token. This is based on the observation that most English words are 4-5 characters long and that subword tokenizers (like BPE or SentencePiece) typically produce 1-2 tokens per word. However, the actual ratio varies significantly: code has more punctuation and symbols (closer to 3-4 chars/token), non-English text can have very different ratios, and special tokens (like `<|im_start|>`) consume tokens without corresponding to characters. The heuristic is useful for order-of-magnitude cost estimation when the provider doesn't return token counts, but it should never be used for precise billing or capacity planning.

**Q25: How do you balance observability overhead with application performance?**
I balance this by: (1) making all metric writes asynchronous and non-blocking (fire-and-forget), (2) avoiding expensive computations during request handling (deferring aggregation to snapshot jobs), (3) batching metric writes when possible (reducing database round-trips), (4) keeping the instrumentation lightweight (a `Date.now()` call and an object allocation are negligible compared to a 200ms LLM call), and (5) setting resource limits on the metrics infrastructure (connection pool size, query timeouts). The overhead of Phase 11's `withMetrics()` wrapper is approximately 1-2ms per request (timer + object creation + async DB insert start), which is <1% of a typical 200-500ms LLM call.

### Database Design for Analytics

**Q26: Why does the `provider_statistics` table exist instead of computing aggregates on the fly?**
Computing aggregates on the fly from `ai_request_metrics` requires scanning all rows for a given user and provider, which is O(n) and gets slower as data grows. The `provider_statistics` table maintains pre-computed aggregates that can be read in O(1) — a single row lookup by `(user_id, provider, model)`. This transforms dashboard loading from "scan millions of rows and GROUP BY" to "read 3-4 rows." The incremental update pattern ensures the pre-computed values stay current without periodic batch recomputation. The trade-off is storage overhead (one extra row per provider-model combination per user) and slight inaccuracy in the running average (which is negligible for monitoring purposes).

**Q27: What is the purpose of the `UNIQUE(user_id, provider, model)` constraint on `provider_statistics`?**
This constraint ensures that exactly one row exists for each user-provider-model combination. Without it, the `updateProviderStats()` function would need to handle the case where multiple rows exist for the same combination (which would indicate a bug). The constraint also creates a unique index, which makes the "upsert" operation (read existing → update or insert) efficient. When the function queries for an existing row with `.eq("user_id", userId).eq("provider", provider).eq("model", model).single()`, the unique index ensures this query is a fast index scan, not a full table scan.

**Q28: Why are there separate tables for `ai_request_metrics` and `ai_error_logs`?**
Separation of concerns. `ai_request_metrics` stores one row per request (including successful ones) and is optimized for aggregate queries (count, average, grouping by type/status). `ai_error_logs` stores only errors and is optimized for investigation (detailed error messages, error type classification, resolution tracking). If we stored errors only in the metrics table, error investigation would require filtering `WHERE status != 'success'` on a much larger table. If we stored all requests in the error table, it would bloat with successful requests. The two-table design allows each table to have indexes optimized for its primary access pattern.

**Q29: How does the `generate_daily_snapshot()` PL/pgSQL function work, and why is it written in SQL instead of JavaScript?**
The function aggregates one day's raw metrics into a single snapshot row. It performs 8 queries against the raw metrics table (request counts by type, success rate, average latencies, token sums, error count, active repos, provider/error breakdowns) and 1 query against the conversation sessions table. It's written in PL/pgSQL (not JavaScript) for three reasons: (1) it runs inside the database, avoiding network round-trips between the application and database for each aggregation query, (2) it can be scheduled as a pg_cron job that runs independently of the application, and (3) PL/pgSQL's `FILTER (WHERE ...)` clause and `jsonb_object_agg()` function provide expressive aggregation capabilities that would require more verbose JavaScript code.

**Q30: Why does the `ai_request_metrics` table use a JSONB `metadata` column instead of separate columns for RAG-specific fields?**
Extensibility without schema migrations. RAG-specific metadata (topK, avgSimilarity, emptyResult) and embedding-specific metadata (reindex flag) don't apply to all request types. Adding separate columns for each would bloat the table schema with mostly-NULL columns and require a migration every time a new metadata field is needed. JSONB allows each request type to store its own structured metadata without schema changes. The trade-off is that JSONB fields can't be indexed as efficiently as dedicated columns (though PostgreSQL does support GIN indexes on JSONB) and type safety is enforced at the application layer, not the database layer.

### System Design

**Q31: How would you design the dashboard to scale to thousands of concurrent users?**
I would implement several scaling strategies: (1) server-side caching of aggregated results with a short TTL (e.g., 30 seconds), so concurrent users hitting the dashboard at the same time share the same query results, (2) materialized views that are refreshed periodically instead of computing aggregates on every request, (3) read replicas for analytics queries (offloading the primary database), (4) a CDN or edge cache for the API response (since the data is user-specific, this would require cache keys that include the user ID), (5) pagination and lazy loading (only fetch detailed data when the user navigates to a specific tab), and (6) WebSocket-based incremental updates (push only changed data instead of re-fetching the entire dashboard).

**Q32: What is the Strategy pattern, and how is it used in Phase 11's export system?**
The Strategy pattern defines a family of interchangeable algorithms and lets the caller select one at runtime. In Phase 11, the export system uses this pattern: `exportReportAsMarkdown()` and `exportReportAsText()` are two strategies that both take an `AIEngineeringReport` and return a string. The API route selects the strategy based on the `format` query parameter. This makes the system extensible — adding a new format (e.g., CSV, PDF, HTML) requires only adding a new strategy function and a new branch in the route handler, without modifying the existing strategies or the report generation logic.

**Q33: How would you add real-time updates to the dashboard without polling?**
I would implement Server-Sent Events (SSE) for unidirectional real-time updates. The server would maintain an event emitter that broadcasts metric events (new request logged, error occurred, health status changed) to all connected clients. The frontend would establish an SSE connection on mount and update the relevant chart components when events arrive. For bidirectional communication (e.g., the user clicking "acknowledge alert"), WebSockets would be more appropriate. In Next.js, SSE can be implemented with a streaming API route that uses `ReadableStream` to push events. The existing `withMetrics()` collector would be extended to emit events to the SSE stream after logging each metric.

**Q34: What is a correlation ID, and why is it important for AI system debugging?**
A correlation ID is a unique identifier assigned to a user request that propagates through all downstream service calls — API route → RAG retrieval → vector DB → LLM call → response assembly. Every log entry, metric, and trace span includes this ID, allowing you to reconstruct the complete journey of a single request across multiple services and databases. Without correlation IDs, debugging a failed RAG request requires manually matching timestamps across different log streams. With correlation IDs, you filter all logs by the ID and see the exact sequence of operations. Phase 11 doesn't implement correlation IDs (each metric has its own `id` but no parent-child relationship), but the `metadata` JSONB column could store a correlation ID if added.

**Q35: How would you design a cost optimization system on top of the existing analytics?**
I would build a three-layer cost optimization system: (1) **Visibility** (already implemented) — track token usage and estimated costs per model per request, (2) **Analysis** — identify the highest-cost operations (which models, which request types, which repositories consume the most tokens) and compute the cost impact of switching models or caching queries, and (3) **Automation** — implement automatic model selection based on query complexity (use the cheap 8B model for simple questions, the expensive 70B model for complex analysis), query result caching with TTL-based invalidation, and prompt optimization (truncate RAG context to the minimum necessary, summarize conversation history). The `generateOptimizationSuggestions()` function in Phase 11 implements a basic version of layer 2 with rule-based heuristics.

---

## 10. Revision Guide

### Key Terms Glossary

| Term | Definition |
|---|---|
| **Observability** | The ability to understand a system's internal state from its external outputs (metrics, logs, traces) |
| **Metric** | A numeric measurement recorded per-event or at fixed intervals (e.g., latency, throughput, token count) |
| **Log** | A timestamped, immutable record of a discrete event with contextual detail |
| **Trace** | An end-to-end record of a request's journey through a distributed system, composed of spans |
| **Latency** | Time from sending a request to receiving a response, measured in milliseconds |
| **Throughput** | Number of requests processed per unit of time (per second/minute/hour/day) |
| **Success Rate** | Percentage of requests that completed without error: `successes / total × 100` |
| **Error Rate** | Percentage of requests that failed: `failures / total × 100` |
| **Token** | The fundamental unit of LLM billing — a subword or word segment processed by the tokenizer |
| **Prompt Tokens** | Tokens in the input sent to the LLM (system prompt + context + user message) |
| **Completion Tokens** | Tokens in the LLM's generated output |
| **RLS (Row Level Security)** | PostgreSQL feature that restricts row access based on a policy (e.g., `user_id = auth.uid()`) |
| **Fire-and-Forget** | Pattern where an async operation is initiated without awaiting its result (`promise.catch(() => {})`) |
| **Incremental Aggregation** | Maintaining running aggregates (count, average) updated on each new data point instead of recomputing from scratch |
| **Snapshot** | A pre-computed aggregate of raw data for a time period, stored in a summary table |
| **Circuit Breaker** | Pattern that stops calling a failing service after a threshold, preventing cascading failures |
| **Percentile (p50/p95/p99)** | Value below which a given percentage of observations fall; used instead of averages to capture distribution tails |
| ~4 chars/token heuristic | Rough approximation for estimating token count from character count when provider doesn't return actual tokens |
| **Cost Estimation** | Computing approximate LLM costs using `tokens / 1000 × price_per_1k` per model |
| **Strategy Pattern** | Design pattern where a family of algorithms are made interchangeable at runtime |
| **Correlation ID** | Unique identifier that propagates through all service calls for a single request, enabling end-to-end tracing |

### Architecture Decision Records

| Decision | Rationale |
|---|---|
| Separate `provider_statistics` table instead of on-the-fly aggregation | O(1) read vs O(n) scan; enables sub-second dashboard loads even with millions of raw metrics |
| Fire-and-forget for metric logging | Metric collection must never impact user-facing request latency or reliability |
| JSONB `metadata` column instead of dedicated columns | Extensibility without schema migrations; each request type stores its own structured metadata |
| 5 separate tables instead of a single wide table | Separation of concerns; each table has indexes optimized for its primary access pattern |
| RLS on all analytics tables | Defense-in-depth; database-level isolation that survives application-level bugs |
| `Promise.all()` for parallel dashboard queries | Total response time = max(individual times), not sum(individual times) |
| Raw metrics as primary, snapshots as fallback | More accurate; snapshots may be stale if daily job hasn't run yet |
| Incremental running average for `avg_latency_ms` | O(1) update per request; acceptable approximation for monitoring |
| Recharts for visualizations | React-native charting library; zero-config responsive containers; supports all needed chart types |
| CSS with `obs-` prefix instead of CSS modules or Tailwind | Avoids naming collisions; no build-time class name mangling; consistent with the project's existing CSS pattern |
| Barrel export (`index.ts`) for analytics module | Clean import paths (`@/lib/analytics` instead of `@/lib/analytics/db`); hides internal structure |
| Report export server-side (not client-side) | Server has access to all data and secrets; client receives a file blob, not raw data |
| Strategy pattern for export formats | Extensible design; adding a new format requires only a new function, no changes to existing code |

### Metric Formulas

```
Success Rate (%)        = (successful_requests / total_requests) × 100
Error Rate (%)          = ((failed + rate_limited) / total_requests) × 100
Tokens per Request      = total_tokens / requests_with_token_data
Running Average         = (old_avg × old_count + new_value) / (old_count + 1)
Estimated Cost (USD)    = (prompt_tokens / 1000) × prompt_price_per_1k
                        + (completion_tokens / 1000) × completion_price_per_1k
Token Estimate          = Math.ceil(text.length / 4)
Provider Health         = healthy  if success_rate >= 80% and no recent failures
                        = warning  if success_rate < 80% or recent failure within 5 min
                        = critical if success_rate < 50%
```

### Design Patterns Used

1. **Fire-and-Forget**: Metric logging (`logRequest().catch(() => {})`, `updateProviderStats().catch(() => {})`, `logError().catch(() => {})`). Ensures metric collection never affects user operations.

2. **Incremental Aggregation**: `updateProviderStats()` maintains running averages and counters in `provider_statistics` without full table scans. O(1) per update.

3. **Strategy Pattern**: Export system — `exportReportAsMarkdown()` and `exportReportAsText()` are interchangeable strategies selected at runtime based on the `format` parameter.

4. **Fallback Pattern**: `getDashboardOverview()` tries raw metrics first, falls back to `dashboard_snapshots` if no raw data exists. Graceful degradation when tables are empty.

5. **Error Classification Heuristic**: `withMetrics()` classifies errors by inspecting message strings (429 → rate_limit, "timeout" → timeout, "network"/"fetch" → network_failure). Simple pattern matching that covers the most common failure modes.

6. **Graceful Degradation**: Every analytics function returns empty/default data when the table doesn't exist (error code `42P01`) or when no data is available. The dashboard renders empty states with helpful messages instead of crashing.

7. **Single API Call**: The dashboard fetches all data from one endpoint (`GET /api/ai-dashboard`), which internally parallelizes 10 queries. Avoids client-side waterfall requests.

8. **Barrel Export**: `index.ts` re-exports all public types and functions from a single module, providing a clean public API.

### Quick Reference for Interview Preparation

- **Three pillars of observability**: Metrics (how much/how fast), Logs (what happened), Traces (where did time go)
- **AI-specific concerns**: Non-determinism, latency variance, token-based cost, quality degradation
- **Percentiles vs averages**: p50 = typical user, p95 = most users, p99 = worst 1%. Averages hide outliers.
- **Fire-and-forget**: Non-blocking async operations for non-critical side effects. `.catch(() => {})` prevents unhandled rejections.
- **Incremental aggregation**: O(1) per update. Running average = `(old_avg × n + new_val) / (n + 1)`.
- **RLS**: Database-level row access control. Complements application-level auth. Defense in depth.
- **Token heuristic**: ~4 chars/token. Rough approximation. Actual ratio varies by language and tokenizer.
- **Cost formula**: `(tokens / 1000) × price_per_1k`. Separate prompt and completion costs.
- **Promise.all()**: Parallel execution. Total time = max(individual times). Used for dashboard data fetching.
- **Snapshot tables**: Pre-computed daily aggregates. Fast for trend queries. Computed by `generate_daily_snapshot()`.
- **Strategy pattern**: Interchangeable algorithms selected at runtime. Used for report export formats.
- **Correlation ID**: Unique identifier propagating through all service calls for a single request. Enables end-to-end tracing.
- **Circuit breaker**: Prevents cascading failures. Three states: closed, open, half-open. Opens on error rate threshold.
- **SLO**: Service Level Objective. Target value for an SLI over a time window. E.g., "99% of requests under 3s."