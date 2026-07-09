"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, AreaChart, Area, Legend,
} from "recharts";
import type {
  DashboardOverview, ProviderHealth, TokenAnalytics, RAGAnalytics,
  EmbeddingAnalytics, TimelineDataPoint, ConversationAnalytics,
  CostEstimate, SystemHealth, ErrorLog, TimeGranularity, ErrorType,
} from "@/lib/analytics/types";

// --- Color palette ---
const COLORS = ["#0f8ca3", "#046276", "#eab308", "#22c55e", "#8b5cf6", "#ec4899", "#f97316", "#06b6d4"];
const PIE_COLORS = ["#22c55e", "#eab308", "#ef4444", "#6b7280"];

type TabId = "overview" | "providers" | "tokens" | "rag" | "embeddings" | "timeline" | "conversations" | "errors" | "cost" | "health" | "reports";

const TABS: { id: TabId; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "providers", label: "Providers" },
  { id: "tokens", label: "Tokens" },
  { id: "rag", label: "RAG" },
  { id: "embeddings", label: "Embeddings" },
  { id: "timeline", label: "Timeline" },
  { id: "conversations", label: "Conversations" },
  { id: "errors", label: "Errors" },
  { id: "cost", label: "Cost" },
  { id: "health", label: "Health" },
  { id: "reports", label: "Reports" },
];

interface DashboardData {
  overview: DashboardOverview;
  providerStats: ProviderHealth[];
  tokenAnalytics: TokenAnalytics;
  ragAnalytics: RAGAnalytics;
  embeddingAnalytics: EmbeddingAnalytics;
  timeline: TimelineDataPoint[];
  conversationAnalytics: ConversationAnalytics;
  errorLogs: ErrorLog[];
  costEstimates: CostEstimate[];
  systemHealth: SystemHealth;
}

function formatNum(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "K";
  return n.toLocaleString();
}

function formatMs(ms: number): string {
  if (ms >= 1000) return (ms / 1000).toFixed(1) + "s";
  return Math.round(ms) + "ms";
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export default function AIDashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabId>("overview");
  const [granularity, setGranularity] = useState<TimeGranularity>("daily");

  const fetchDashboard = useCallback(async (g: TimeGranularity = "daily") => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`/api/ai-dashboard?granularity=${g}&days=30`);
      const json = await res.json();
      if (!res.ok) {
        if (json.code === "TABLES_MISSING") {
          setError("ANALYTICS_TABLES_MISSING");
          return;
        }
        throw new Error(json.error || "Failed to load dashboard");
      }
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load dashboard data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchDashboard(granularity); }, [fetchDashboard, granularity]);

  // --- Export ---
  const handleExport = useCallback(async (format: "markdown" | "text") => {
    try {
      const res = await fetch(`/api/ai-dashboard/report?format=${format}`);
      if (!res.ok) throw new Error("Export failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `ai-engineering-report.${format === "markdown" ? "md" : "txt"}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      // silent
    }
  }, []);

  // --- Render Helpers ---
  if (loading && !data) {
    return (
      <div className="repo-page">
        <div className="obs-loading"><div className="obs-spinner" /></div>
      </div>
    );
  }

  if (error === "ANALYTICS_TABLES_MISSING") {
    return (
      <div className="repo-page">
        <Link href="/dashboard" className="obs-back-link">← Back to Dashboard</Link>
        <div className="obs-error-state">
          <p>Analytics tables not found</p>
          <p style={{ color: "var(--muted-foreground)", fontSize: "0.8125rem" }}>
            Please run the Phase 11 SQL migration script in your Supabase SQL Editor.
            The script is located at <code>scripts/phase-11-sql.sql</code>.
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="repo-page">
        <Link href="/dashboard" className="obs-back-link">← Back to Dashboard</Link>
        <div className="obs-error-state"><p>{error}</p></div>
      </div>
    );
  }

  const d = data!;

  return (
    <div className="repo-page">
      <Link href="/dashboard" className="obs-back-link">← Back to Dashboard</Link>

      <div className="obs-page-header">
        <h1>AI Engineering Dashboard</h1>
        <p>Monitor LLM usage, RAG performance, provider health, and system reliability</p>
      </div>

      {/* Tabs */}
      <div className="obs-tabs">
        {TABS.map((t) => (
          <button
            key={t.id}
            className={`obs-tab ${activeTab === t.id ? "active" : ""}`}
            onClick={() => setActiveTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === "overview" && <OverviewTab data={d} />}
      {activeTab === "providers" && <ProvidersTab data={d} />}
      {activeTab === "tokens" && <TokensTab data={d} />}
      {activeTab === "rag" && <RAGTab data={d} />}
      {activeTab === "embeddings" && <EmbeddingsTab data={d} />}
      {activeTab === "timeline" && (
        <TimelineTab data={d} granularity={granularity} setGranularity={setGranularity} />
      )}
      {activeTab === "conversations" && <ConversationsTab data={d} />}
      {activeTab === "errors" && <ErrorsTab data={d} />}
      {activeTab === "cost" && <CostTab data={d} />}
      {activeTab === "health" && <HealthTab data={d} />}
      {activeTab === "reports" && <ReportsTab onExport={handleExport} data={d} />}
    </div>
  );
}

// ================================================================
// Tab Components
// ================================================================

function OverviewTab({ data: d }: { data: DashboardData }) {
  const cards = [
    { label: "Total AI Requests", value: formatNum(d.overview.totalAiRequests), sub: null },
    { label: "RAG Requests", value: formatNum(d.overview.totalRagRequests), sub: null },
    { label: "Embeddings", value: formatNum(d.overview.embeddingsGenerated), sub: null },
    { label: "Active Repos", value: String(d.overview.activeRepositories), sub: null },
    { label: "Conversations", value: String(d.overview.totalConversations), sub: null },
    { label: "Success Rate", value: `${d.overview.aiSuccessRate}%`, sub: d.overview.aiSuccessRate >= 90 ? "Good" : d.overview.aiSuccessRate >= 70 ? "Fair" : "Low" },
    { label: "Avg Response Time", value: formatMs(d.overview.avgResponseTimeMs), sub: null },
    { label: "Avg Retrieval Time", value: formatMs(d.overview.avgRetrievalTimeMs), sub: null },
  ];

  return (
    <div>
      <div className="obs-overview-grid">
        {cards.map((c) => (
          <div key={c.label} className="obs-card">
            <div className="obs-card-label">{c.label}</div>
            <div className="obs-card-value">{c.value}</div>
            {c.sub && <div className="obs-card-sub">{c.sub}</div>}
          </div>
        ))}
      </div>

      {/* Quick system health summary */}
      {d.systemHealth && (
        <div className="obs-section">
          <h3 className="obs-section-title">System Health Summary</h3>
          <div className="obs-health-grid">
            {[...d.systemHealth.llmProviders, d.systemHealth.ragPipeline, d.systemHealth.embeddingService, d.systemHealth.supabase, d.systemHealth.githubApi].map((item, i) => (
              <div key={i} className={`obs-health-item ${item.status}`}>
                <div className="obs-health-name">
                  <span className={`obs-dot obs-dot-${item.status}`} /> {item.name}
                </div>
                <div className="obs-health-details">{item.details}</div>
                {item.latencyMs != null && (
                  <div className="obs-health-latency">Latency: {formatMs(item.latencyMs)}</div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ProvidersTab({ data: d }: { data: DashboardData }) {
  if (d.providerStats.length === 0) {
    return <div className="obs-empty"><p>No provider data available yet. Start making AI requests to see provider metrics.</p></div>;
  }

  return (
    <div>
      <div className="obs-section">
        <h3 className="obs-section-title">Provider Monitoring</h3>
        <div className="obs-table-wrap">
          <table className="obs-provider-table">
            <thead>
              <tr>
                <th>Provider</th>
                <th>Model</th>
                <th>Status</th>
                <th>Requests</th>
                <th>Success Rate</th>
                <th>Error Rate</th>
                <th>Avg Latency</th>
                <th>Last Success</th>
                <th>Last Failure</th>
              </tr>
            </thead>
            <tbody>
              {d.providerStats.map((p, i) => (
                <tr key={i}>
                  <td style={{ fontWeight: 600 }}>{p.provider}</td>
                  <td style={{ fontFamily: "monospace", fontSize: "0.75rem" }}>{p.model}</td>
                  <td><span className={`obs-badge obs-badge-${p.status}`}>{p.status}</span></td>
                  <td>{formatNum(p.totalRequests)}</td>
                  <td>{p.successRate}%</td>
                  <td>{p.errorRate}%</td>
                  <td>{formatMs(p.avgLatencyMs)}</td>
                  <td style={{ fontSize: "0.75rem" }}>{p.lastSuccessAt ? timeAgo(p.lastSuccessAt) : "—"}</td>
                  <td style={{ fontSize: "0.75rem" }}>{p.lastFailureAt ? timeAgo(p.lastFailureAt) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Provider request distribution chart */}
      <div className="obs-chart-wrap">
        <div className="obs-chart-title">Request Distribution by Provider</div>
        <ResponsiveContainer width="100%" height={250}>
          <PieChart>
            <Pie
              data={d.providerStats.map((p) => ({ name: `${p.provider}/${p.model}`, value: p.totalRequests }))}
              cx="50%"
              cy="50%"
              outerRadius={80}
              dataKey="value"
              label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
            >
              {d.providerStats.map((_, i) => (
                <Cell key={i} fill={COLORS[i % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function TokensTab({ data: d }: { data: DashboardData }) {
  const t = d.tokenAnalytics;
  const hasData = t.totalTokens > 0 || t.dailyUsage.length > 0;

  return (
    <div>
      <div className="obs-token-grid">
        <div className="obs-token-card">
          <div className="obs-token-value">{formatNum(t.totalPromptTokens)}</div>
          <div className="obs-token-label">Prompt Tokens</div>
        </div>
        <div className="obs-token-card">
          <div className="obs-token-value">{formatNum(t.totalCompletionTokens)}</div>
          <div className="obs-token-label">Completion Tokens</div>
        </div>
        <div className="obs-token-card">
          <div className="obs-token-value">{formatNum(t.totalTokens)}</div>
          <div className="obs-token-label">Total Tokens</div>
        </div>
        <div className="obs-token-card">
          <div className="obs-token-value">{formatNum(t.tokensPerRequest)}</div>
          <div className="obs-token-label">Tokens / Request</div>
        </div>
      </div>

      {t.tokensEstimated && (
        <p className="obs-estimated" style={{ marginBottom: "1rem" }}>
          Some token counts are estimated based on character length (~4 chars/token).
        </p>
      )}

      {hasData ? (
        <div className="obs-two-col">
          {t.dailyUsage.length > 0 && (
            <div className="obs-chart-wrap">
              <div className="obs-chart-title">Daily Token Usage</div>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={t.dailyUsage}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} stroke="var(--muted-foreground)" />
                  <YAxis tick={{ fontSize: 10 }} stroke="var(--muted-foreground)" />
                  <Tooltip
                    contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: "0.5rem", fontSize: "0.75rem" }}
                    labelStyle={{ color: "var(--foreground)" }}
                  />
                  <Bar dataKey="tokens" fill="#0f8ca3" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
          {t.weeklyUsage.length > 0 && (
            <div className="obs-chart-wrap">
              <div className="obs-chart-title">Weekly Token Usage</div>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={t.weeklyUsage}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="week" tick={{ fontSize: 10 }} stroke="var(--muted-foreground)" />
                  <YAxis tick={{ fontSize: 10 }} stroke="var(--muted-foreground)" />
                  <Tooltip
                    contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: "0.5rem", fontSize: "0.75rem" }}
                    labelStyle={{ color: "var(--foreground)" }}
                  />
                  <Bar dataKey="tokens" fill="#046276" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      ) : (
        <div className="obs-empty"><p>No token usage data available yet.</p></div>
      )}
    </div>
  );
}

function RAGTab({ data: d }: { data: DashboardData }) {
  const r = d.ragAnalytics;
  const hasData = r.totalRetrievals > 0;

  return (
    <div>
      <div className="obs-token-grid">
        <div className="obs-token-card">
          <div className="obs-token-value">{formatNum(r.totalRetrievals)}</div>
          <div className="obs-token-label">Total Retrievals</div>
        </div>
        <div className="obs-token-card">
          <div className="obs-token-value">{formatMs(r.avgRetrievalTimeMs)}</div>
          <div className="obs-token-label">Avg Retrieval Time</div>
        </div>
        <div className="obs-token-card">
          <div className="obs-token-value">{r.avgTopK}</div>
          <div className="obs-token-label">Avg Top-K</div>
        </div>
        <div className="obs-token-card">
          <div className="obs-token-value">{r.avgSimilarityScore.toFixed(3)}</div>
          <div className="obs-token-label">Avg Similarity</div>
        </div>
        <div className="obs-token-card">
          <div className="obs-token-value">{r.emptyRetrievalRate}%</div>
          <div className="obs-token-label">Empty Rate</div>
        </div>
        <div className="obs-token-card">
          <div className="obs-token-value">{r.retrievalSuccessRate}%</div>
          <div className="obs-token-label">Success Rate</div>
        </div>
      </div>

      {hasData ? (
        <div className="obs-chart-wrap">
          <div className="obs-chart-title">Retrieval Success vs Empty Rate</div>
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie
                data={[
                  { name: "Successful", value: r.retrievalSuccessRate },
                  { name: "Empty Results", value: r.emptyRetrievalRate },
                  { name: "Failed", value: Math.max(0, 100 - r.retrievalSuccessRate - r.emptyRetrievalRate) },
                ]}
                cx="50%"
                cy="50%"
                outerRadius={80}
                dataKey="value"
              >
                <Cell fill="#22c55e" />
                <Cell fill="#eab308" />
                <Cell fill="#ef4444" />
              </Pie>
              <Tooltip
                formatter={(value: number) => `${value.toFixed(1)}%`}
                contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: "0.5rem", fontSize: "0.75rem" }}
              />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="obs-empty"><p>No RAG analytics data available yet.</p></div>
      )}
    </div>
  );
}

function EmbeddingsTab({ data: d }: { data: DashboardData }) {
  const e = d.embeddingAnalytics;

  return (
    <div>
      <div className="obs-token-grid">
        <div className="obs-token-card">
          <div className="obs-token-value">{formatNum(e.totalEmbeddings)}</div>
          <div className="obs-token-label">Total Embeddings</div>
        </div>
        <div className="obs-token-card">
          <div className="obs-token-value">{formatNum(e.indexedCommits)}</div>
          <div className="obs-token-label">Indexed Commits</div>
        </div>
        <div className="obs-token-card">
          <div className="obs-token-value">{e.reindexOperations}</div>
          <div className="obs-token-label">Re-index Ops</div>
        </div>
        <div className="obs-token-card">
          <div className="obs-token-value">{e.failedEmbeddings}</div>
          <div className="obs-token-label">Failed</div>
        </div>
        <div className="obs-token-card">
          <div className="obs-token-value">{e.embeddingProvider}</div>
          <div className="obs-token-label">Provider</div>
        </div>
        <div className="obs-token-card">
          <div className="obs-token-value">{formatMs(e.avgEmbeddingTimeMs)}</div>
          <div className="obs-token-label">Avg Time</div>
        </div>
      </div>

      {e.totalEmbeddings > 0 ? (
        <div className="obs-chart-wrap">
          <div className="obs-chart-title">Embedding Outcomes</div>
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie
                data={[
                  { name: "Successful", value: e.totalEmbeddings - e.failedEmbeddings },
                  { name: "Failed", value: e.failedEmbeddings },
                ]}
                cx="50%"
                cy="50%"
                outerRadius={80}
                dataKey="value"
              >
                <Cell fill="#22c55e" />
                <Cell fill="#ef4444" />
              </Pie>
              <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: "0.5rem", fontSize: "0.75rem" }} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="obs-empty"><p>No embedding data available yet.</p></div>
      )}
    </div>
  );
}

function TimelineTab({ data: d, granularity, setGranularity }: {
  data: DashboardData;
  granularity: TimeGranularity;
  setGranularity: (g: TimeGranularity) => void;
}) {
  if (d.timeline.length === 0) {
    return <div className="obs-empty"><p>No timeline data available. Make some AI requests and check back.</p></div>;
  }

  return (
    <div>
      <div className="obs-timeline-controls">
        {(["daily", "weekly", "monthly"] as TimeGranularity[]).map((g) => (
          <button
            key={g}
            className={`obs-timeline-btn ${granularity === g ? "active" : ""}`}
            onClick={() => setGranularity(g)}
          >
            {g.charAt(0).toUpperCase() + g.slice(1)}
          </button>
        ))}
      </div>

      <div className="obs-two-col">
        <div className="obs-chart-wrap">
          <div className="obs-chart-title">Request Volume</div>
          <ResponsiveContainer width="100%" height={250}>
            <AreaChart data={d.timeline}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="period" tick={{ fontSize: 10 }} stroke="var(--muted-foreground)" />
              <YAxis tick={{ fontSize: 10 }} stroke="var(--muted-foreground)" />
              <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: "0.5rem", fontSize: "0.75rem" }} />
              <Area type="monotone" dataKey="requestVolume" stroke="#0f8ca3" fill="#0f8ca3" fillOpacity={0.15} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="obs-chart-wrap">
          <div className="obs-chart-title">Response Time (ms)</div>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={d.timeline}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="period" tick={{ fontSize: 10 }} stroke="var(--muted-foreground)" />
              <YAxis tick={{ fontSize: 10 }} stroke="var(--muted-foreground)" />
              <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: "0.5rem", fontSize: "0.75rem" }} />
              <Line type="monotone" dataKey="responseTimeMs" stroke="#0f8ca3" strokeWidth={2} dot={{ r: 3 }} />
              <Line type="monotone" dataKey="retrievalTimeMs" stroke="#046276" strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="obs-chart-wrap">
          <div className="obs-chart-title">Success Rate (%)</div>
          <ResponsiveContainer width="100%" height={250}>
            <AreaChart data={d.timeline}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="period" tick={{ fontSize: 10 }} stroke="var(--muted-foreground)" />
              <YAxis tick={{ fontSize: 10 }} stroke="var(--muted-foreground)" domain={[0, 100]} />
              <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: "0.5rem", fontSize: "0.75rem" }} />
              <Area type="monotone" dataKey="successRate" stroke="#22c55e" fill="#22c55e" fillOpacity={0.15} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="obs-chart-wrap">
          <div className="obs-chart-title">Error Rate (%)</div>
          <ResponsiveContainer width="100%" height={250}>
            <AreaChart data={d.timeline}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="period" tick={{ fontSize: 10 }} stroke="var(--muted-foreground)" />
              <YAxis tick={{ fontSize: 10 }} stroke="var(--muted-foreground)" />
              <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: "0.5rem", fontSize: "0.75rem" }} />
              <Area type="monotone" dataKey="errorRate" stroke="#ef4444" fill="#ef4444" fillOpacity={0.15} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

function ConversationsTab({ data: d }: { data: DashboardData }) {
  const c = d.conversationAnalytics;

  return (
    <div>
      <div className="obs-token-grid">
        <div className="obs-token-card">
          <div className="obs-token-value">{c.totalConversations}</div>
          <div className="obs-token-label">Total Conversations</div>
        </div>
        <div className="obs-token-card">
          <div className="obs-token-value">{c.avgConversationLength}</div>
          <div className="obs-token-label">Avg Length (msgs)</div>
        </div>
        <div className="obs-token-card">
          <div className="obs-token-value">{c.avgQuestionsPerRepository}</div>
          <div className="obs-token-label">Avg Qs / Repo</div>
        </div>
        <div className="obs-token-card">
          <div className="obs-token-value">{formatNum(c.avgAiResponseLength)}</div>
          <div className="obs-token-label">Avg AI Response (chars)</div>
        </div>
      </div>

      {c.mostActiveRepositories.length > 0 ? (
        <div className="obs-section">
          <h3 className="obs-section-title">Most Active Repositories</h3>
          <div className="obs-convo-list">
            {c.mostActiveRepositories.map((repo, i) => (
              <div key={i} className="obs-convo-item">
                <span className="obs-convo-name">{repo.repoName}</span>
                <span className="obs-convo-count">{repo.count} conversations</span>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="obs-empty"><p>No conversation data available yet.</p></div>
      )}
    </div>
  );
}

function ErrorsTab({ data: d }: { data: DashboardData }) {
  if (d.errorLogs.length === 0) {
    return <div className="obs-empty"><p>No errors recorded. Everything is running smoothly.</p></div>;
  }

  // Group errors by type for a summary
  const errorSummary = new Map<string, { count: number; last: string }>();
  for (const e of d.errorLogs) {
    const existing = errorSummary.get(e.errorType);
    if (existing) {
      existing.count++;
      if (e.createdAt > existing.last) existing.last = e.createdAt;
    } else {
      errorSummary.set(e.errorType, { count: 1, last: e.createdAt });
    }
  }

  return (
    <div>
      {/* Summary cards */}
      <div className="obs-token-grid" style={{ marginBottom: "1.5rem" }}>
        {Array.from(errorSummary.entries()).map(([type, info]) => (
          <div key={type} className="obs-token-card">
            <div className="obs-token-value">{info.count}</div>
            <div className="obs-token-label">{type.replace(/_/g, " ")}</div>
          </div>
        ))}
      </div>

      {/* Error chart */}
      <div className="obs-chart-wrap">
        <div className="obs-chart-title">Error Distribution</div>
        <ResponsiveContainer width="100%" height={200}>
          <PieChart>
            <Pie
              data={Array.from(errorSummary.entries()).map(([type, info]) => ({ name: type.replace(/_/g, " "), value: info.count }))}
              cx="50%"
              cy="50%"
              outerRadius={70}
              dataKey="value"
            >
              {Array.from(errorSummary.keys()).map((_, i) => (
                <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
              ))}
            </Pie>
            <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: "0.5rem", fontSize: "0.75rem" }} />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </div>

      {/* Error list */}
      <h3 className="obs-section-title">Recent Errors</h3>
      <div className="obs-error-list">
        {d.errorLogs.slice(0, 50).map((e) => (
          <div key={e.id} className="obs-error-item">
            <span className="obs-error-type">{e.errorType.replace(/_/g, " ")}</span>
            <span className="obs-error-msg">{e.errorMessage}</span>
            <span className="obs-error-time">{timeAgo(e.createdAt)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function CostTab({ data: d }: { data: DashboardData }) {
  if (d.costEstimates.length === 0) {
    return <div className="obs-empty"><p>No cost data available. Start making AI requests to see cost estimates.</p></div>;
  }

  const totalCost = d.costEstimates.reduce((s, c) => s + c.estimatedCostUsd, 0);
  const anyEstimated = d.costEstimates.some((c) => c.isEstimated);

  return (
    <div>
      {anyEstimated && (
        <p className="obs-estimated" style={{ marginBottom: "1rem" }}>
          Cost estimates are based on published pricing. Actual costs may vary.
        </p>
      )}

      <div className="obs-table-wrap">
        <table className="obs-cost-table">
          <thead>
            <tr>
              <th>Provider</th>
              <th>Model</th>
              <th>Prompt Tokens</th>
              <th>Completion Tokens</th>
              <th>Total Tokens</th>
              <th>Estimated Cost</th>
            </tr>
          </thead>
          <tbody>
            {d.costEstimates.map((c, i) => (
              <tr key={i}>
                <td style={{ fontWeight: 600 }}>{c.provider}</td>
                <td style={{ fontFamily: "monospace", fontSize: "0.75rem" }}>{c.model}</td>
                <td>{formatNum(c.promptTokens)}</td>
                <td>{formatNum(c.completionTokens)}</td>
                <td>{formatNum(c.totalTokens)}</td>
                <td className="cost-highlight">
                  ${c.estimatedCostUsd.toFixed(4)}
                  {c.isEstimated && <span className="obs-estimated">(est.)</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="obs-cost-total">
        <span>Total Estimated Cost</span>
        <span className="amount">${totalCost.toFixed(4)}</span>
      </div>

      {/* Cost by model chart */}
      <div className="obs-chart-wrap">
        <div className="obs-chart-title">Cost Distribution by Model</div>
        <ResponsiveContainer width="100%" height={250}>
          <BarChart data={d.costEstimates.map((c) => ({ name: c.model, cost: c.estimatedCostUsd }))} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis type="number" tick={{ fontSize: 10 }} stroke="var(--muted-foreground)" />
            <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} stroke="var(--muted-foreground)" width={160} />
            <Tooltip
              formatter={(value: number) => `$${value.toFixed(4)}`}
              contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: "0.5rem", fontSize: "0.75rem" }}
            />
            <Bar dataKey="cost" fill="#0f8ca3" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function HealthTab({ data: d }: { data: DashboardData }) {
  const h = d.systemHealth;

  return (
    <div>
      {/* Overall status */}
      <div className="obs-card" style={{ marginBottom: "1.5rem", display: "flex", alignItems: "center", gap: "1rem" }}>
        <span className={`obs-badge obs-badge-${h.overallStatus}`} style={{ fontSize: "0.8125rem", padding: "0.4rem 1rem" }}>
          <span className={`obs-dot obs-dot-${h.overallStatus}`} />
          {h.overallStatus.toUpperCase()}
        </span>
        <span style={{ fontSize: "0.9375rem", fontWeight: 600 }}>
          Overall System Health: {h.overallStatus === "healthy" ? "All systems operational" : h.overallStatus === "warning" ? "Some systems need attention" : h.overallStatus === "critical" ? "Critical issues detected" : "Insufficient data"}
        </span>
      </div>

      <div className="obs-health-grid">
        {h.llmProviders.map((item, i) => (
          <div key={`llm-${i}`} className={`obs-health-item ${item.status}`}>
            <div className="obs-health-name">
              <span className={`obs-dot obs-dot-${item.status}`} /> {item.name}
            </div>
            <div className="obs-health-details">{item.details}</div>
            {item.latencyMs != null && (
              <div className="obs-health-latency">Latency: {formatMs(item.latencyMs)}</div>
            )}
          </div>
        ))}

        <div className={`obs-health-item ${h.ragPipeline.status}`}>
          <div className="obs-health-name">
            <span className={`obs-dot obs-dot-${h.ragPipeline.status}`} /> {h.ragPipeline.name}
          </div>
          <div className="obs-health-details">{h.ragPipeline.details}</div>
          {h.ragPipeline.latencyMs != null && (
            <div className="obs-health-latency">Latency: {formatMs(h.ragPipeline.latencyMs)}</div>
          )}
        </div>

        <div className={`obs-health-item ${h.embeddingService.status}`}>
          <div className="obs-health-name">
            <span className={`obs-dot obs-dot-${h.embeddingService.status}`} /> {h.embeddingService.name}
          </div>
          <div className="obs-health-details">{h.embeddingService.details}</div>
          {h.embeddingService.latencyMs != null && (
            <div className="obs-health-latency">Latency: {formatMs(h.embeddingService.latencyMs)}</div>
          )}
        </div>

        <div className={`obs-health-item ${h.supabase.status}`}>
          <div className="obs-health-name">
            <span className={`obs-dot obs-dot-${h.supabase.status}`} /> {h.supabase.name}
          </div>
          <div className="obs-health-details">{h.supabase.details}</div>
          {h.supabase.latencyMs != null && (
            <div className="obs-health-latency">Latency: {formatMs(h.supabase.latencyMs)}</div>
          )}
        </div>

        <div className={`obs-health-item ${h.githubApi.status}`}>
          <div className="obs-health-name">
            <span className={`obs-dot obs-dot-${h.githubApi.status}`} /> {h.githubApi.name}
          </div>
          <div className="obs-health-details">{h.githubApi.details}</div>
          {h.githubApi.latencyMs != null && (
            <div className="obs-health-latency">Latency: {formatMs(h.githubApi.latencyMs)}</div>
          )}
        </div>
      </div>
    </div>
  );
}

function ReportsTab({ onExport, data: d }: { onExport: (f: "markdown" | "text") => void; data: DashboardData }) {
  const [generating, setGenerating] = useState(false);

  const handleGenerate = useCallback(async () => {
    setGenerating(true);
    try {
      await fetch("/api/ai-dashboard/report?format=json", { method: "GET" });
      // Report is generated server-side and can be exported
    } catch {
      // silent
    } finally {
      setGenerating(false);
    }
  }, []);

  return (
    <div>
      <div className="obs-section">
        <h3 className="obs-section-title">Generate AI Engineering Report</h3>
        <p style={{ fontSize: "0.8125rem", color: "var(--muted-foreground)", marginBottom: "1rem" }}>
          Generate a comprehensive report covering usage summary, provider statistics, performance trends,
          error summary, cost estimates, and optimization suggestions. The report aggregates all available
          analytics data and is ready for export.
        </p>
        <div className="obs-report-actions">
          <button className="obs-btn obs-btn-primary" onClick={handleGenerate} disabled={generating}>
            {generating ? "Generating..." : "Generate Report"}
          </button>
          <button className="obs-btn" onClick={() => onExport("markdown")}>
            Export as Markdown
          </button>
          <button className="obs-btn" onClick={() => onExport("text")}>
            Export as Plain Text
          </button>
        </div>
      </div>

      {/* Quick summary preview */}
      <div className="obs-section">
        <h3 className="obs-section-title">Quick Summary Preview</h3>
        <div className="obs-card">
          <div className="obs-metric-row">
            <span className="obs-metric-label">Period</span>
            <span className="obs-metric-value">Last 30 days</span>
          </div>
          <div className="obs-metric-row">
            <span className="obs-metric-label">Total AI Requests</span>
            <span className="obs-metric-value">{formatNum(d.overview.totalAiRequests)}</span>
          </div>
          <div className="obs-metric-row">
            <span className="obs-metric-label">AI Success Rate</span>
            <span className="obs-metric-value">{d.overview.aiSuccessRate}%</span>
          </div>
          <div className="obs-metric-row">
            <span className="obs-metric-label">Total Tokens Used</span>
            <span className="obs-metric-value">{formatNum(d.tokenAnalytics.totalTokens)}</span>
          </div>
          <div className="obs-metric-row">
            <span className="obs-metric-label">Active Providers</span>
            <span className="obs-metric-value">{d.providerStats.length}</span>
          </div>
          <div className="obs-metric-row">
            <span className="obs-metric-label">Total Errors</span>
            <span className="obs-metric-value">{d.errorLogs.length}</span>
          </div>
          <div className="obs-metric-row">
            <span className="obs-metric-label">System Health</span>
            <span className="obs-metric-value" style={{ color: d.systemHealth.overallStatus === "healthy" ? "#22c55e" : d.systemHealth.overallStatus === "warning" ? "#eab308" : "#ef4444" }}>
              {d.systemHealth.overallStatus.toUpperCase()}
            </span>
          </div>
          <div className="obs-metric-row">
            <span className="obs-metric-label">Estimated Cost</span>
            <span className="obs-metric-value">
              ${d.costEstimates.reduce((s, c) => s + c.estimatedCostUsd, 0).toFixed(4)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}