"use client";

import { useState, useCallback } from "react";
import type { HealthMetrics, AIAnalysis, HealthReport } from "@/lib/health/types";
import { ScoreCardsGrid } from "./score-cards";
import { HotspotsSection, CommitPatternsSection } from "./hotspots";
import { AnalysisSection } from "./analysis-section";
import { MarkdownRenderer } from "@/components/documentation/markdown-renderer";
import {
  RefreshCw,
  Download,
  FileBarChart,
  Search,
  Activity,
} from "lucide-react";

interface HealthDashboardProps {
  repositoryId: string;
}

export function HealthDashboard({ repositoryId }: HealthDashboardProps) {
  const [metrics, setMetrics] = useState<HealthMetrics | null>(null);
  const [analysis, setAnalysis] = useState<AIAnalysis | null>(null);
  const [reportMd, setReportMd] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [searchHighlights, setSearchHighlights] = useState<string[]>([]);
  const [showReport, setShowReport] = useState(false);

  // Fetch metrics on mount
  const fetchMetrics = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/repositories/${repositoryId}/health`);
      if (!res.ok) throw new Error("Failed to fetch metrics");
      const data = await res.json();
      setMetrics(data.metrics);
      if (data.cachedAnalysis?.analysis) {
        setAnalysis(data.cachedAnalysis.analysis);
        setReportMd(data.cachedAnalysis.reportMarkdown);
      }
    } catch {
      setError("Failed to load health metrics.");
    } finally {
      setLoading(false);
    }
  }, [repositoryId]);

  useState(() => { fetchMetrics(); });

  // Run full AI analysis
  const runAnalysis = async () => {
    setAnalyzing(true);
    setError(null);
    try {
      const res = await fetch(`/api/repositories/${repositoryId}/health`, {
        method: "POST",
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Analysis failed");
      }
      const data = await res.json();
      if (data.metrics) setMetrics(data.metrics);
      if (data.report?.analysis) setAnalysis(data.report.analysis);
      if (data.report?.reportMarkdown) setReportMd(data.report.reportMarkdown);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Analysis failed");
    } finally {
      setAnalyzing(false);
    }
  };

  // Search
  const handleSearch = useCallback(
    async (value: string) => {
      setSearchTerm(value);
      if (!value.trim() || !analysis) {
        setSearchHighlights([]);
        return;
      }
      // Client-side search through analysis
      const q = value.toLowerCase();
      const highlights: string[] = [];
      const sections = [
        ...analysis.debtConcerns,
        ...analysis.maintenanceRisks,
        ...analysis.refactoringPriorities,
        ...analysis.unstableAreas,
      ];
      for (const s of sections) {
        if (s.toLowerCase().includes(q)) highlights.push(s);
      }
      setSearchHighlights(highlights);
    },
    [analysis]
  );

  // Export
  const handleExport = (format: "markdown" | "text") => {
    if (!reportMd) return;
    const content = format === "text" ? stripMarkdown(reportMd) : reportMd;
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `health-report.${format === "markdown" ? "md" : "txt"}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="health-loading">
        <span className="dash-spinner" /> Computing health metrics...
      </div>
    );
  }

  if (error && !metrics) {
    return (
      <div className="health-error">
        <p>{error}</p>
        <button className="doc-generate-btn" onClick={fetchMetrics}>
          <RefreshCw size={14} /> Retry
        </button>
      </div>
    );
  }

  if (!metrics) return null;

  const noData = metrics.totalCommits === 0;

  return (
    <div className="health-dashboard">
      {/* Header */}
      <div className="health-header">
        <div>
          <h1 className="health-title">Technical Debt & Code Health</h1>
          <p className="health-subtitle">
            {noData
              ? "Import commits to enable health analysis"
              : `Analyzed ${metrics.totalCommits} commits over ${metrics.timeSpanDays} days`}
          </p>
        </div>
        <div className="health-header-actions">
          <button
            className="doc-generate-btn"
            onClick={runAnalysis}
            disabled={analyzing || noData}
          >
            <RefreshCw size={14} className={analyzing ? "spin" : ""} />
            {analyzing ? "Analyzing..." : "Run AI Analysis"}
          </button>
          {reportMd && (
            <>
              <button className="doc-action-btn" onClick={() => setShowReport(!showReport)}>
                <FileBarChart size={14} /> {showReport ? "Dashboard" : "Full Report"}
              </button>
              <button className="doc-action-btn" onClick={() => handleExport("markdown")}>
                <Download size={14} /> .md
              </button>
              <button className="doc-action-btn" onClick={() => handleExport("text")}>
                <Download size={14} /> .txt
              </button>
            </>
          )}
        </div>
      </div>

      {/* Error banner */}
      {error && <div className="health-error-banner">{error}</div>}

      {noData ? (
        <div className="doc-empty">
          <Activity size={48} className="doc-empty-icon" />
          <h3>No commit data available</h3>
          <p>Import commits for this repository to enable health analysis.</p>
        </div>
      ) : showReport && reportMd ? (
        <div className="health-report-view">
          <MarkdownRenderer content={reportMd} />
        </div>
      ) : (
        <>
          {/* Score Cards */}
          <ScoreCardsGrid
            scores={metrics.scores}
            explanations={analysis?.scoreExplanations}
          />

          {/* Quick Stats */}
          <div className="health-quick-stats">
            <div className="health-stat-chip">
              <strong>{metrics.totalCommits}</strong> total commits
            </div>
            <div className="health-stat-chip">
              <strong>{metrics.commitsPerWeek}</strong> per week
            </div>
            <div className="health-stat-chip">
              <strong>{metrics.avgCommitSize}</strong> avg size
            </div>
            <div className="health-stat-chip">
              <strong>{metrics.largeCommitPercentage}%</strong> large commits
            </div>
            <div className="health-stat-chip">
              <strong>{metrics.uniqueContributors}</strong> contributors
            </div>
          </div>

          {/* Hotspots + Contributors + Directories */}
          <HotspotsSection
            hotspots={metrics.hotspots}
            directoryActivity={metrics.directoryActivity}
            contributorActivity={metrics.contributorActivity}
          />

          {/* Commit Patterns */}
          <CommitPatternsSection patterns={metrics.commitPatterns} />

          {/* AI Analysis */}
          {analysis && (
            <AnalysisSection
              analysis={analysis}
              searchTerm={searchTerm}
              onSearchChange={handleSearch}
              searchHighlights={searchHighlights}
            />
          )}
        </>
      )}
    </div>
  );
}

function stripMarkdown(md: string): string {
  let text = md;
  text = text.replace(/```[\s\S]*?```/g, (m) => {
    return m.split("\n").slice(1, -1).map((l) => `  ${l}`).join("\n");
  });
  text = text.replace(/`([^`]+)`/g, "$1");
  text = text.replace(/^#{1,6}\s+(.+)$/gm, (m, h) => h.toUpperCase());
  text = text.replace(/\*\*([^*]+)\*\*/g, "$1");
  text = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1 ($2)");
  text = text.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, "$1");
  text = text.replace(/^>\s+(.+)$/gm, "  $1");
  text = text.replace(/^---+$/gm, "─".repeat(40));
  text = text.replace(/\n{3,}/g, "\n\n");
  return text.trim();
}