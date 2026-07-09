"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend,
} from "recharts";
import type {
  RepoSummary, RepoMetrics, TechStack, TechComparison,
  SimilarityScore, ContributorComparison, CrossRepoSearchParams,
  CrossRepoSearchResult, CrossRepoAIAnalysis, CrossRepoReport,
  ExportFormat,
} from "@/lib/cross-repo/types";

// --- Color palette ---
const COLORS = ["#0f8ca3", "#eab308", "#22c55e", "#8b5cf6", "#ec4899", "#f97316", "#06b6d4", "#ef4444"];
const PIE_COLORS = ["#0f8ca3", "#046276", "#eab308", "#22c55e"];

type TabId = "overview" | "comparison" | "tech" | "similarity" | "contributors" | "search" | "ai-analysis" | "rag" | "reports";

const TABS: { id: TabId; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "comparison", label: "Comparison" },
  { id: "tech", label: "Tech Stack" },
  { id: "similarity", label: "Similarity" },
  { id: "contributors", label: "Contributors" },
  { id: "search", label: "Search" },
  { id: "ai-analysis", label: "AI Analysis" },
  { id: "rag", label: "RAG Chat" },
  { id: "reports", label: "Reports" },
];

// --- Helpers ---
function fmtNum(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "K";
  return n.toLocaleString();
}

function timeAgo(d: string): string {
  const diff = Date.now() - new Date(d).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

// --- Similarity ring SVG ---
function SimilarityRing({ score }: { score: number }) {
  const pct = Math.round(score * 100);
  const radius = 58;
  const circ = 2 * Math.PI * radius;
  const offset = circ * (1 - score);
  const color = pct >= 70 ? "#22c55e" : pct >= 40 ? "#eab308" : "#ef4444";

  return (
    <div className="cr-similarity-score">
      <svg width="140" height="140" viewBox="0 0 140 140">
        <circle cx="70" cy="70" r={radius} fill="none" stroke="var(--muted)" strokeWidth="10" />
        <circle cx="70" cy="70" r={radius} fill="none" stroke={color} strokeWidth="10"
          strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 0.8s ease" }} />
      </svg>
      <div className="cr-similarity-value">
        <span className="score">{pct}%</span>
        <span className="label">Similarity</span>
      </div>
    </div>
  );
}

// ================================================================
// Main Component
// ================================================================

export default function CrossRepoDashboard() {
  // --- Core state ---
  const [repos, setRepos] = useState<RepoSummary[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabId>("overview");
  const [tablesMissing, setTablesMissing] = useState(false);

  // --- Analysis state ---
  const [metrics, setMetrics] = useState<RepoMetrics[]>([]);
  const [techStacks, setTechStacks] = useState<TechStack[]>([]);
  const [similarity, setSimilarity] = useState<SimilarityScore | null>(null);
  const [contributorComp, setContributorComp] = useState<ContributorComparison | null>(null);
  const [techComp, setTechComp] = useState<TechComparison | null>(null);
  const [aiAnalysis, setAiAnalysis] = useState<CrossRepoAIAnalysis | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);

  // --- Search state ---
  const [searchQuery, setSearchQuery] = useState("");
  const [searchLang, setSearchLang] = useState("");
  const [searchResults, setSearchResults] = useState<CrossRepoSearchResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);

  // --- RAG state ---
  const [ragMessages, setRagMessages] = useState<{ role: "user" | "ai"; content: string; sources?: { repository: string; sha: string; message: string }[] }[]>([]);
  const [ragInput, setRagInput] = useState("");
  const [ragLoading, setRagLoading] = useState(false);
  const ragEndRef = useRef<HTMLDivElement>(null);

  // --- Reports state ---
  const [previousReports, setPreviousReports] = useState<CrossRepoReport["id" | "repositoryNames" | "comparisonType" | "createdAt"][]>([]);

  // --- Fetch repos ---
  const fetchRepos = useCallback(async () => {
    try {
      const res = await fetch("/api/cross-repo?action=repos");
      const json = await res.json();
      if (!res.ok) {
        if (json.code === "TABLES_MISSING") { setTablesMissing(true); return; }
        throw new Error(json.error || "Failed");
      }
      setRepos(json.repositories || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load repositories");
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchReports = useCallback(async () => {
    try {
      const res = await fetch("/api/cross-repo?action=reports");
      const json = await res.json();
      if (res.ok) setPreviousReports(json.reports || []);
    } catch { /* silent */ }
  }, []);

  useEffect(() => { fetchRepos(); fetchReports(); }, [fetchRepos, fetchReports]);

  // --- RAG auto-scroll ---
  useEffect(() => { ragEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [ragMessages]);

  // --- Repo selection ---
  const toggleRepo = (id: string) => {
    setSelectedIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  };

  // --- Run analysis ---
  const runAnalysis = useCallback(async () => {
    if (selectedIds.length < 2) return;
    setAnalyzing(true);
    setError(null);
    try {
      const ids = selectedIds.join(",");
      const res = await fetch(`/api/cross-repo?action=analyze&repositoryIds=${ids}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Analysis failed");
      setMetrics(json.metrics || []);
      setTechStacks(json.techStacks || []);
      setSimilarity(json.similarity || null);
      setContributorComp(json.contributorComparison || null);
      setTechComp(json.techComparison || null);
      setAiAnalysis(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Analysis failed");
    } finally {
      setAnalyzing(false);
    }
  }, [selectedIds]);

  // --- AI Analysis ---
  const runAIAnalysis = useCallback(async () => {
    if (metrics.length < 2) return;
    setAiLoading(true);
    try {
      const res = await fetch("/api/cross-repo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "ai-analysis",
          metrics, techStacks, similarity,
          contributorComparison: contributorComp,
          techComparison: techComp,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "AI analysis failed");
      setAiAnalysis(json.analysis);
      setActiveTab("ai-analysis");
    } catch (err) {
      setError(err instanceof Error ? err.message : "AI analysis failed");
    } finally {
      setAiLoading(false);
    }
  }, [metrics, techStacks, similarity, contributorComp, techComp]);

  // --- Search ---
  const handleSearch = useCallback(async () => {
    if (!searchQuery.trim()) return;
    setSearchLoading(true);
    try {
      const params = new URLSearchParams({ action: "search", query: searchQuery });
      if (selectedIds.length > 0) params.set("repositoryIds", selectedIds.join(","));
      if (searchLang) params.set("language", searchLang);
      const res = await fetch(`/api/cross-repo?${params}`);
      const json = await res.json();
      if (res.ok) setSearchResults(json.results || []);
    } catch { /* silent */ }
    finally { setSearchLoading(false); }
  }, [searchQuery, selectedIds, searchLang]);

  // --- RAG Chat ---
  const sendRAG = useCallback(async () => {
    if (!ragInput.trim() || selectedIds.length === 0) return;
    const q = ragInput;
    setRagMessages((prev) => [...prev, { role: "user", content: q }]);
    setRagInput("");
    setRagLoading(true);
    try {
      const res = await fetch("/api/cross-repo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "rag", repositoryIds: selectedIds, query: q }),
      });
      const json = await res.json();
      if (res.ok) {
        setRagMessages((prev) => [...prev, { role: "ai", content: json.answer, sources: json.sources }]);
      } else {
        setRagMessages((prev) => [...prev, { role: "ai", content: "Error: " + (json.error || "Request failed") }]);
      }
    } catch {
      setRagMessages((prev) => [...prev, { role: "ai", content: "Network error. Please try again." }]);
    } finally { setRagLoading(false); }
  }, [ragInput, selectedIds]);

  // --- Export report ---
  const exportReport = useCallback(async (format: ExportFormat) => {
    if (selectedIds.length < 2) return;
    try {
      const res = await fetch("/api/cross-repo/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          repositoryIds: selectedIds, format,
          metrics, techStacks, similarity,
          contributorComparison: contributorComp,
          techComparison: techComp, aiAnalysis,
        }),
      });
      if (!res.ok) return;
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `cross-repo-report-${new Date().toISOString().slice(0, 10)}.${format === "markdown" ? "md" : "txt"}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch { /* silent */ }
  }, [selectedIds, metrics, techStacks, similarity, contributorComp, techComp, aiAnalysis]);

  // --- Save report ---
  const saveReport = useCallback(async () => {
    if (selectedIds.length < 2) return;
    try {
      const res = await fetch("/api/cross-repo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "save-report",
          repositoryIds: selectedIds,
          comparisonType: "full",
          aiAnalysis,
          reportMarkdown: null, // server would generate
        }),
      });
      if (res.ok) fetchReports();
    } catch { /* silent */ }
  }, [selectedIds, aiAnalysis, fetchReports]);

  // ================================================================
  // Loading / Error / Empty states
  // ================================================================

  if (loading) {
    return <div className="cr-loading"><div className="cr-spinner" /></div>;
  }

  if (tablesMissing) {
    return (
      <div className="cr-error-state">
        <p>Database tables for Cross-Repository Intelligence are not installed.</p>
        <p style={{ color: "var(--muted-foreground)", fontSize: "0.8125rem" }}>
          Please run the Phase 12 SQL migration in your Supabase SQL Editor, then refresh this page.
        </p>
      </div>
    );
  }

  if (repos.length < 2) {
    return (
      <div className="cr-page">
        <div className="cr-page-header">
          <h1>Cross-Repository Intelligence</h1>
          <p>Analyze, compare, and discover patterns across your repositories</p>
        </div>
        <div className="cr-empty">
          <p style={{ fontSize: "1.25rem", fontWeight: 600, color: "var(--foreground)" }}>
            At least 2 repositories required
          </p>
          <p>Import more repositories from the Repositories page to enable cross-repo analysis.</p>
        </div>
      </div>
    );
  }

  // ================================================================
  // Render
  // ================================================================

  // Group search results by repo
  const groupedResults: Record<string, CrossRepoSearchResult[]> = {};
  for (const r of searchResults) {
    (groupedResults[r.repositoryName] ??= []).push(r);
  }

  // Languages for filter
  const languages = [...new Set(repos.map((r) => r.language).filter(Boolean))];

  return (
    <motion.div 
      className="cr-page"
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
    >
      {/* Header */}
      <div className="cr-page-header">
        <h1>Cross-Repository Intelligence</h1>
        <p>Analyze, compare, and discover patterns across {repos.length} repositories</p>
      </div>

      {/* Repo Selector (always visible) */}
      <div className="cr-selector">
        <div className="cr-selector-title">
          Select Repositories ({selectedIds.length} selected)
        </div>
        <div className="cr-repo-grid">
          {repos.map((repo) => (
            <div
              key={repo.id}
              className={`cr-repo-chip${selectedIds.includes(repo.id) ? " selected" : ""}`}
              onClick={() => toggleRepo(repo.id)}
            >
              <div className="cr-repo-chip-check">
                {selectedIds.includes(repo.id) ? "\u2713" : ""}
              </div>
              <div className="cr-repo-chip-info">
                <div className="cr-repo-chip-name">{repo.name}</div>
                <div className="cr-repo-chip-meta">
                  {repo.language || "Unknown"} &middot; {fmtNum(repo.totalCommits)} commits &middot; {repo.activeContributors} contributors
                </div>
              </div>
            </div>
          ))}
        </div>
        <div className="cr-actions">
          <button className="cr-btn cr-btn-primary" onClick={runAnalysis} disabled={selectedIds.length < 2 || analyzing}>
            {analyzing ? "Analyzing..." : "Analyze Selected"}
          </button>
          {metrics.length >= 2 && (
            <button className="cr-btn" onClick={runAIAnalysis} disabled={aiLoading}>
              {aiLoading ? "Generating AI Analysis..." : "Generate AI Insights"}
            </button>
          )}
          {metrics.length >= 2 && (
            <>
              <button className="cr-btn" onClick={() => exportReport("markdown")}>Export MD</button>
              <button className="cr-btn" onClick={() => exportReport("text")}>Export TXT</button>
              <button className="cr-btn" onClick={saveReport}>Save Report</button>
            </>
          )}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="cr-error-state">
          <p>{error}</p>
        </div>
      )}

      {/* Tabs */}
      <div className="cr-tabs">
        <AnimatePresence>
        {TABS.map((tab) => (
          <button
            key={tab.id}
            className={`cr-tab${activeTab === tab.id ? " active" : ""}`}
            style={{ position: "relative" }}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
            {activeTab === tab.id && (
              <motion.div
                layoutId="activeTab"
                className="cr-tab-indicator"
                style={{
                  position: "absolute",
                  bottom: -1,
                  left: 0,
                  right: 0,
                  height: 3,
                  backgroundColor: "var(--primary)",
                  borderRadius: "3px 3px 0 0"
                }}
              />
            )}
          </button>
        ))}
        </AnimatePresence>
      </div>

      {/* ================================================================
          OVERVIEW TAB
          ================================================================ */}
      {activeTab === "overview" && (
        <div className="cr-section">
          {metrics.length === 0 ? (
            <div className="cr-empty">
              <p>Select 2+ repositories above and click &quot;Analyze Selected&quot; to begin.</p>
            </div>
          ) : (
            <>
              <h2 className="cr-section-title">Repository Overview</h2>
              {/* Summary cards */}
              <div className="cr-cards-grid">
                {metrics.map((m, i) => (
                  <div key={m.repositoryId} className="cr-card">
                    <div className="cr-card-value" style={{ color: COLORS[i % COLORS.length], fontSize: "1rem" }}>
                      {m.repositoryName}
                    </div>
                    <div className="cr-card-label">{m.language || "Unknown"}</div>
                  </div>
                ))}
                <div className="cr-card">
                  <div className="cr-card-value">{metrics.reduce((s, m) => s + m.totalCommits, 0).toLocaleString()}</div>
                  <div className="cr-card-label">Total Commits</div>
                </div>
                <div className="cr-card">
                  <div className="cr-card-value">{metrics.reduce((s, m) => s + m.activeContributors, 0).toLocaleString()}</div>
                  <div className="cr-card-label">Total Contributors</div>
                </div>
                <div className="cr-card">
                  <div className="cr-card-value">{fmtNum(metrics.reduce((s, m) => s + m.totalAdditions, 0))}</div>
                  <div className="cr-card-label">Total Additions</div>
                </div>
                <div className="cr-card">
                  <div className="cr-card-value">{fmtNum(metrics.reduce((s, m) => s + m.totalDeletions, 0))}</div>
                  <div className="cr-card-label">Total Deletions</div>
                </div>
              </div>

              {/* Bar chart: commits + contributors */}
              <div className="cr-chart-wrap">
                <div className="cr-chart-title">Commits &amp; Contributors Comparison</div>
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={metrics.map((m) => ({
                    name: m.repositoryName,
                    Commits: m.totalCommits,
                    Contributors: m.activeContributors,
                    "Avg Size": m.avgCommitSize,
                  }))}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="name" tick={{ fontSize: 12 }} stroke="var(--muted-foreground)" />
                    <YAxis tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" />
                    <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: "8px", fontSize: 12 }} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar dataKey="Commits" fill="#0f8ca3" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="Contributors" fill="#eab308" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="Avg Size" fill="#22c55e" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Quick repo details */}
              <div className="cr-table-wrap">
                <table className="cr-table">
                  <thead>
                    <tr>
                      <th>Repository</th>
                      <th>Language</th>
                      <th>Commits</th>
                      <th>Contributors</th>
                      <th>Avg Size</th>
                      <th>Commits/Week</th>
                      <th>Additions</th>
                      <th>Deletions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {metrics.map((m) => (
                      <tr key={m.repositoryId}>
                        <td className="repo-name-col">{m.repositoryName}</td>
                        <td>{m.language || "N/A"}</td>
                        <td>{m.totalCommits.toLocaleString()}</td>
                        <td>{m.activeContributors}</td>
                        <td>{m.avgCommitSize} lines</td>
                        <td>{m.commitsPerWeek}</td>
                        <td style={{ color: "#22c55e" }}>+{fmtNum(m.totalAdditions)}</td>
                        <td style={{ color: "#ef4444" }}>-{fmtNum(m.totalDeletions)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}

      {/* ================================================================
          COMPARISON TAB
          ================================================================ */}
      {activeTab === "comparison" && (
        <div className="cr-section">
          {metrics.length < 2 ? (
            <div className="cr-empty"><p>Run analysis with 2+ repos first.</p></div>
          ) : (
            <>
              <h2 className="cr-section-title">Detailed Metrics Comparison</h2>
              {/* Additions vs Deletions chart */}
              <div className="cr-chart-wrap">
                <div className="cr-chart-title">Additions vs Deletions</div>
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={metrics.map((m) => ({
                    name: m.repositoryName,
                    Additions: m.totalAdditions,
                    Deletions: m.totalDeletions,
                  }))}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="name" tick={{ fontSize: 12 }} stroke="var(--muted-foreground)" />
                    <YAxis tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" />
                    <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: "8px", fontSize: 12 }} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar dataKey="Additions" fill="#22c55e" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="Deletions" fill="#ef4444" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Top contributors per repo */}
              {metrics.map((m, idx) => (
                <div key={m.repositoryId} className="cr-chart-wrap">
                  <div className="cr-chart-title">Top Contributors — {m.repositoryName}</div>
                  <ResponsiveContainer width="100%" height={Math.max(200, m.topContributors.length * 36)}>
                    <BarChart data={m.topContributors.slice(0, 10).map((c) => ({
                      name: c.name || c.login,
                      Commits: c.count,
                      "Percentage": c.percentage,
                    }))} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                      <XAxis type="number" tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" />
                      <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" />
                      <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: "8px", fontSize: 12 }} />
                      <Bar dataKey="Commits" fill={COLORS[idx % COLORS.length]} radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ))}

              {/* Commit frequency chart */}
              {metrics.some((m) => m.commitFrequency.length > 0) && (
                <div className="cr-chart-wrap">
                  <div className="cr-chart-title">Commit Frequency Over Time</div>
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={(() => {
                      const allPeriods = new Set<string>();
                      for (const m of metrics) for (const p of m.commitFrequency) allPeriods.add(p.period);
                      return Array.from(allPeriods).sort().slice(-12).map((period) => {
                        const row: Record<string, string | number> = { period };
                        for (const m of metrics) {
                          const found = m.commitFrequency.find((p) => p.period === period);
                          row[m.repositoryName] = found?.count ?? 0;
                        }
                        return row;
                      });
                    })()}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                      <XAxis dataKey="period" tick={{ fontSize: 10 }} stroke="var(--muted-foreground)" />
                      <YAxis tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" />
                      <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: "8px", fontSize: 12 }} />
                      <Legend wrapperStyle={{ fontSize: 12 }} />
                      {metrics.map((m, i) => (
                        <Bar key={m.repositoryId} dataKey={m.repositoryName} fill={COLORS[i % COLORS.length]} radius={[4, 4, 0, 0]} />
                      ))}
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ================================================================
          TECH STACK TAB
          ================================================================ */}
      {activeTab === "tech" && (
        <div className="cr-section">
          {techStacks.length < 2 ? (
            <div className="cr-empty"><p>Run analysis with 2+ repos first.</p></div>
          ) : (
            <>
              <h2 className="cr-section-title">Technology Stack Comparison</h2>

              {/* Per-repo tech cards */}
              {techStacks.map((ts, i) => (
                <div key={ts.repositoryId} className="cr-ai-block">
                  <div className="cr-ai-block-title" style={{ color: COLORS[i % COLORS.length] }}>
                    {ts.repositoryName}
                  </div>
                  <div className="cr-tags" style={{ marginBottom: "0.5rem" }}>
                    {ts.languages.map((l) => (
                      <span key={l.name} className="cr-tag cr-tag-tech">{l.name}</span>
                    ))}
                    {ts.frameworks.map((f) => (
                      <span key={f} className="cr-tag cr-tag-tech">{f}</span>
                    ))}
                    {ts.databases.map((d) => (
                      <span key={d} className="cr-tag cr-tag-tech">{d}</span>
                    ))}
                    {ts.packageManagers.map((p) => (
                      <span key={p} className="cr-tag cr-tag-tech">{p}</span>
                    ))}
                    {ts.buildTools.map((b) => (
                      <span key={b} className="cr-tag cr-tag-tech">{b}</span>
                    ))}
                    {ts.deploymentTools.map((d) => (
                      <span key={d} className="cr-tag cr-tag-tech">{d}</span>
                    ))}
                    {ts.frameworks.length === 0 && ts.databases.length === 0 && ts.buildTools.length === 0 && (
                      <span style={{ color: "var(--muted-foreground)", fontSize: "0.8125rem" }}>
                        No technologies detected from topics. Topics help improve detection.
                      </span>
                    )}
                  </div>
                </div>
              ))}

              {/* Comparison section */}
              {techComp && (
                <>
                  <h3 className="cr-section-title" style={{ marginTop: "1.5rem" }}>Venn Comparison</h3>
                  <div className="cr-ai-block">
                    <div className="cr-ai-block-title">Shared Technologies ({techComp.shared.length})</div>
                    {techComp.shared.length > 0 ? (
                      <div className="cr-tags">
                        {techComp.shared.map((t) => (
                          <span key={t} className="cr-tag cr-tag-shared">{t}</span>
                        ))}
                      </div>
                    ) : (
                      <p>No shared technologies detected.</p>
                    )}
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                    <div className="cr-ai-block">
                      <div className="cr-ai-block-title" style={{ color: "#1e40af" }}>
                        Only in {techStacks[0]?.repositoryName} ({techComp.onlyInA.length})
                      </div>
                      {techComp.onlyInA.length > 0 ? (
                        <div className="cr-tags">
                          {techComp.onlyInA.map((t) => (
                            <span key={t} className="cr-tag cr-tag-a">{t}</span>
                          ))}
                        </div>
                      ) : (
                        <p>None</p>
                      )}
                    </div>
                    <div className="cr-ai-block">
                      <div className="cr-ai-block-title" style={{ color: "#92400e" }}>
                        Only in {techStacks[1]?.repositoryName} ({techComp.onlyInB.length})
                      </div>
                      {techComp.onlyInB.length > 0 ? (
                        <div className="cr-tags">
                          {techComp.onlyInB.map((t) => (
                            <span key={t} className="cr-tag cr-tag-b">{t}</span>
                          ))}
                        </div>
                      ) : (
                        <p>None</p>
                      )}
                    </div>
                  </div>

                  {/* Pie chart of tech distribution */}
                  {techComp.allTechnologies.length > 0 && (
                    <div className="cr-chart-wrap">
                      <div className="cr-chart-title">Technology Distribution</div>
                      <ResponsiveContainer width="100%" height={300}>
                        <PieChart>
                          <Pie
                            data={techComp.allTechnologies.map((t) => ({
                              name: t,
                              value: 1,
                              category: techComp.shared.includes(t) ? "Shared" :
                                techComp.onlyInA.includes(t) ? techStacks[0]?.repositoryName || "Repo A" :
                                techStacks[1]?.repositoryName || "Repo B",
                            }))}
                            dataKey="value"
                            nameKey="name"
                            cx="50%"
                            cy="50%"
                            outerRadius={100}
                            label={({ name }: { name: string }) => name}
                            labelLine={{ stroke: "var(--muted-foreground)" }}
                          >
                            {techComp.allTechnologies.map((t, i) => (
                              <Cell
                                key={t}
                                fill={
                                  techComp.shared.includes(t) ? "#22c55e" :
                                  techComp.onlyInA.includes(t) ? "#3b82f6" : "#f59e0b"
                                }
                              />
                            ))}
                          </Pie>
                          <Legend />
                          <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: "8px", fontSize: 12 }} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </div>
      )}

      {/* ================================================================
          SIMILARITY TAB
          ================================================================ */}
      {activeTab === "similarity" && (
        <div className="cr-section">
          {!similarity ? (
            <div className="cr-empty"><p>Run analysis with 2 repos to see similarity.</p></div>
          ) : (
            <>
              <h2 className="cr-section-title">Repository Similarity Analysis</h2>
              <div className="cr-similarity-ring">
                <SimilarityRing score={similarity.overallScore} />
                <div className="cr-similarity-breakdown">
                  {Object.entries(similarity.breakdown).map(([key, val]) => {
                    const labels: Record<string, string> = {
                      language: "Language", topic: "Topics", commitPattern: "Commit Pattern", contributor: "Contributors",
                    };
                    return (
                      <div key={key} className="cr-sim-row">
                        <span className="cr-sim-row-label">{labels[key] || key}</span>
                        <div className="cr-sim-bar">
                          <div className="cr-sim-bar-fill" style={{ width: `${val * 100}%` }} />
                        </div>
                        <span className="cr-sim-row-value">{(val * 100).toFixed(0)}%</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Reasoning */}
              <div className="cr-reasoning-text">{similarity.reasoning}</div>

              {/* Shared concepts */}
              <div className="cr-ai-block" style={{ marginTop: "1rem" }}>
                <div className="cr-ai-block-title">Shared Concepts</div>
                {similarity.sharedConcepts.length > 0 ? (
                  <div className="cr-tags">
                    {similarity.sharedConcepts.map((c) => (
                      <span key={c} className="cr-tag cr-tag-shared">{c}</span>
                    ))}
                  </div>
                ) : <p>No shared concepts detected.</p>}
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                <div className="cr-ai-block">
                  <div className="cr-ai-block-title">Unique to Repo A</div>
                  {similarity.uniqueToA.length > 0 ? (
                    <div className="cr-tags">
                      {similarity.uniqueToA.map((c) => (
                        <span key={c} className="cr-tag cr-tag-a">{c}</span>
                      ))}
                    </div>
                  ) : <p>None</p>}
                </div>
                <div className="cr-ai-block">
                  <div className="cr-ai-block-title">Unique to Repo B</div>
                  {similarity.uniqueToB.length > 0 ? (
                    <div className="cr-tags">
                      {similarity.uniqueToB.map((c) => (
                        <span key={c} className="cr-tag cr-tag-b">{c}</span>
                      ))}
                    </div>
                  ) : <p>None</p>}
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* ================================================================
          CONTRIBUTORS TAB
          ================================================================ */}
      {activeTab === "contributors" && (
        <div className="cr-section">
          {!contributorComp ? (
            <div className="cr-empty"><p>Run analysis with 2 repos to compare contributors.</p></div>
          ) : (
            <>
              <h2 className="cr-section-title">Contributor Comparison</h2>
              <div className="cr-cards-grid">
                <div className="cr-card">
                  <div className="cr-card-value">{contributorComp.totalContributorsA}</div>
                  <div className="cr-card-label">{metrics[0]?.repositoryName} Contributors</div>
                </div>
                <div className="cr-card">
                  <div className="cr-card-value">{contributorComp.totalContributorsB}</div>
                  <div className="cr-card-label">{metrics[1]?.repositoryName} Contributors</div>
                </div>
                <div className="cr-card">
                  <div className="cr-card-value" style={{ color: "#22c55e" }}>{contributorComp.sharedContributors.length}</div>
                  <div className="cr-card-label">Shared Contributors</div>
                </div>
                <div className="cr-card">
                  <div className="cr-card-value">{contributorComp.uniqueToA.length + contributorComp.uniqueToB.length}</div>
                  <div className="cr-card-label">Unique Contributors</div>
                </div>
              </div>

              {/* Shared contributors table */}
              {contributorComp.sharedContributors.length > 0 && (
                <div className="cr-table-wrap cr-contrib-shared">
                  <table className="cr-table">
                    <thead>
                      <tr>
                        <th>Contributor</th>
                        <th>{metrics[0]?.repositoryName} Commits</th>
                        <th>{metrics[1]?.repositoryName} Commits</th>
                      </tr>
                    </thead>
                    <tbody>
                      {contributorComp.sharedContributors.map((c) => (
                        <tr key={c.login}>
                          <td className="repo-name-col">{c.name || c.login}</td>
                          <td>{c.commitsA}</td>
                          <td>{c.commitsB}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Activity comparison chart */}
              {contributorComp.activityComparison.length > 0 && (
                <div className="cr-chart-wrap">
                  <div className="cr-chart-title">Shared Contributor Activity (%)</div>
                  <ResponsiveContainer width="100%" height={Math.max(200, contributorComp.activityComparison.length * 36)}>
                    <BarChart data={contributorComp.activityComparison.map((c) => ({
                      name: c.name,
                      ...(metrics[0] ? { [metrics[0].repositoryName]: c.avgCommitsA } : {}),
                      ...(metrics[1] ? { [metrics[1].repositoryName]: c.avgCommitsB } : {}),
                    }))} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                      <XAxis type="number" tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" />
                      <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" />
                      <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: "8px", fontSize: 12 }} />
                      <Legend wrapperStyle={{ fontSize: 12 }} />
                      {metrics.slice(0, 2).map((m, i) => (
                        <Bar key={m.repositoryId} dataKey={m.repositoryName} fill={COLORS[i % COLORS.length]} radius={[0, 4, 4, 0]} />
                      ))}
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* Unique contributors */}
              <div className="cr-contrib-unique">
                <div className="cr-contrib-col">
                  <h4>Unique to {metrics[0]?.repositoryName} ({contributorComp.uniqueToA.length})</h4>
                  {contributorComp.uniqueToA.map((c) => (
                    <div key={c.login} className="cr-contrib-item">
                      <span>{c.name || c.login}</span>
                      <span>{c.commits} commits</span>
                    </div>
                  ))}
                </div>
                <div className="cr-contrib-col">
                  <h4>Unique to {metrics[1]?.repositoryName} ({contributorComp.uniqueToB.length})</h4>
                  {contributorComp.uniqueToB.map((c) => (
                    <div key={c.login} className="cr-contrib-item">
                      <span>{c.name || c.login}</span>
                      <span>{c.commits} commits</span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* ================================================================
          SEARCH TAB
          ================================================================ */}
      {activeTab === "search" && (
        <div className="cr-section">
          <h2 className="cr-section-title">Cross-Repository Commit Search</h2>
          <div className="cr-search-bar">
            <input
              className="cr-search-input"
              placeholder="Search commit messages, authors, SHAs..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            />
            <select className="cr-search-select" value={searchLang} onChange={(e) => setSearchLang(e.target.value)}>
              <option value="">All Languages</option>
              {languages.map((l) => (
                <option key={l} value={l}>{l}</option>
              ))}
            </select>
            <button className="cr-btn cr-btn-primary" onClick={handleSearch} disabled={searchLoading || !searchQuery.trim()}>
              {searchLoading ? "Searching..." : "Search"}
            </button>
          </div>
          {selectedIds.length > 0 && (
            <p style={{ fontSize: "0.75rem", color: "var(--muted-foreground)", marginBottom: "1rem" }}>
              Searching in {selectedIds.length} selected repos. Clear selection to search all repos.
            </p>
          )}
          {searchResults.length === 0 && !searchLoading && (
            <div className="cr-empty"><p>Enter a query and click Search to find commits across your repositories.</p></div>
          )}
          {searchLoading && <div className="cr-loading"><div className="cr-spinner" /></div>}
          {Object.entries(groupedResults).map(([repoName, results]) => (
            <div key={repoName} className="cr-result-group">
              <div className="cr-result-group-title">
                {repoName} ({results.length} results)
              </div>
              {results.map((r) => (
                <div key={r.commitId} className="cr-result-item">
                  <span className="cr-result-sha">{r.sha}</span>
                  <span className="cr-result-msg">{r.message}</span>
                  <span className="cr-result-meta">
                    {r.authorName} &middot; {new Date(r.committedDate).toLocaleDateString()} &middot; +{r.additions} -{r.deletions}
                  </span>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      {/* ================================================================
          AI ANALYSIS TAB
          ================================================================ */}
      {activeTab === "ai-analysis" && (
        <div className="cr-section">
          {!aiAnalysis ? (
            <div className="cr-empty">
              <p>Click &quot;Generate AI Insights&quot; to get AI-powered analysis of your selected repositories.</p>
              <p style={{ fontSize: "0.75rem" }}>
                This requires running analysis first with 2+ repos selected.
              </p>
            </div>
          ) : (
            <>
              <h2 className="cr-section-title">AI-Powered Analysis</h2>

              {/* Executive Summary */}
              <div className="cr-ai-block">
                <div className="cr-ai-block-title">Executive Summary</div>
                <p>{aiAnalysis.executiveSummary}</p>
              </div>

              {/* Architectural Comparison */}
              {aiAnalysis.architecturalComparison && (
                <div className="cr-ai-block">
                  <div className="cr-ai-block-title">Architectural Comparison</div>
                  <p>{aiAnalysis.architecturalComparison}</p>
                </div>
              )}

              {/* Shared Patterns */}
              {aiAnalysis.sharedPatterns.length > 0 && (
                <div className="cr-ai-block">
                  <div className="cr-ai-block-title">Shared Patterns</div>
                  <ul className="cr-ai-list">
                    {aiAnalysis.sharedPatterns.map((p, i) => (
                      <li key={i}>{p}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Key Differences */}
              {aiAnalysis.keyDifferences.length > 0 && (
                <div className="cr-ai-block">
                  <div className="cr-ai-block-title">Key Differences</div>
                  <ul className="cr-ai-list">
                    {aiAnalysis.keyDifferences.map((d, i) => (
                      <li key={i}>{d}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Best Practices */}
              {aiAnalysis.bestPractices.length > 0 && (
                <div className="cr-ai-block">
                  <div className="cr-ai-block-title">Best Practices</div>
                  <ul className="cr-ai-list">
                    {aiAnalysis.bestPractices.map((b, i) => (
                      <li key={i}>{b}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Recommendations */}
              {aiAnalysis.recommendations.length > 0 && (
                <div className="cr-ai-block">
                  <div className="cr-ai-block-title">Recommendations</div>
                  <ul className="cr-ai-list">
                    {aiAnalysis.recommendations.map((r, i) => (
                      <li key={i}>{r}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Detailed Insights */}
              {aiAnalysis.similarityExplanation && (
                <div className="cr-ai-block">
                  <div className="cr-ai-block-title">Similarity Explanation</div>
                  <p>{aiAnalysis.similarityExplanation}</p>
                </div>
              )}
              {aiAnalysis.technologyInsights && (
                <div className="cr-ai-block">
                  <div className="cr-ai-block-title">Technology Insights</div>
                  <p>{aiAnalysis.technologyInsights}</p>
                </div>
              )}
              {aiAnalysis.contributorInsights && (
                <div className="cr-ai-block">
                  <div className="cr-ai-block-title">Contributor Insights</div>
                  <p>{aiAnalysis.contributorInsights}</p>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ================================================================
          RAG CHAT TAB
          ================================================================ */}
      {activeTab === "rag" && (
        <div className="cr-section">
          <h2 className="cr-section-title">Cross-Repository RAG Chat</h2>
          <p style={{ fontSize: "0.8125rem", color: "var(--muted-foreground)", marginBottom: "1rem" }}>
            Ask questions across your selected repositories. The AI will retrieve relevant commits and provide informed answers.
            {selectedIds.length === 0 && " Please select at least one repository above."}
          </p>
          <div className="cr-chat-container">
            <div className="cr-chat-messages">
              {ragMessages.length === 0 && (
                <div className="cr-empty" style={{ padding: "2rem" }}>
                  <p>Ask anything about your repositories. Example questions:</p>
                  <p style={{ fontSize: "0.8125rem", color: "var(--muted-foreground)" }}>
                    &quot;What are the common patterns across these repos?&quot; &middot;
                    &quot;What features were recently added?&quot; &middot;
                    &quot;Which repo has more test coverage activity?&quot;
                  </p>
                </div>
              )}
              {ragMessages.map((msg, i) => (
                <div key={i} className={`cr-chat-msg ${msg.role}`}>
                  {msg.content}
                  {msg.sources && msg.sources.length > 0 && (
                    <div className="cr-chat-sources">
                      Sources:
                      {msg.sources.slice(0, 5).map((s, j) => (
                        <span key={j} className="cr-chat-source-item">
                          [{s.repository} | {s.sha}]
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
              <div ref={ragEndRef} />
            </div>
            <div className="cr-chat-input-row">
              <input
                className="cr-chat-input"
                placeholder={selectedIds.length === 0 ? "Select repos first..." : "Ask about your repositories..."}
                value={ragInput}
                onChange={(e) => setRagInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && !ragLoading && sendRAG()}
                disabled={selectedIds.length === 0 || ragLoading}
              />
              <button
                className="cr-btn cr-btn-primary"
                onClick={sendRAG}
                disabled={selectedIds.length === 0 || !ragInput.trim() || ragLoading}
              >
                {ragLoading ? "Thinking..." : "Send"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================================================================
          REPORTS TAB
          ================================================================ */}
      {activeTab === "reports" && (
        <div className="cr-section">
          <h2 className="cr-section-title">Saved Reports</h2>
          {previousReports.length === 0 ? (
            <div className="cr-empty">
              <p>No saved reports yet. Run an analysis and click &quot;Save Report&quot; to save it here.</p>
            </div>
          ) : (
            <div className="cr-table-wrap">
              <table className="cr-table">
                <thead>
                  <tr>
                    <th>Repositories</th>
                    <th>Type</th>
                    <th>Created</th>
                  </tr>
                </thead>
                <tbody>
                  {previousReports.map((r) => (
                    <tr key={r.id}>
                      <td>{r.repositoryNames.join(", ")}</td>
                      <td><span className="cr-tag cr-tag-tech">{r.comparisonType}</span></td>
                      <td style={{ fontSize: "0.75rem", color: "var(--muted-foreground)" }}>
                        {timeAgo(r.createdAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}