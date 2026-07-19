"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Sparkles, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AnalysisSkeleton } from "@/components/analysis/analysis-skeleton";
import { ArchitectureOverview } from "@/components/analysis/architecture-overview";
import { TechStackBadges } from "@/components/analysis/tech-stack-badges";
import { ScoreCard } from "@/components/analysis/score-card";
import { InsightCard } from "@/components/analysis/insight-card";
import { MarkdownRenderer } from "@/components/documentation/markdown-renderer";

// ── Types ────────────────────────────────────────────────────────
interface AnalysisResult {
  architecture: string;
  framework: string;
  renderingStrategy: string;
  databaseLayer: string;
  authentication: string;
  techStack: string[];
  designPatterns: string[];
  strengths: string[];
  codeSmells: string[];
  securityRisks: string[];
  performanceRisks: string[];
  maintainabilityScore: number;
  testingScore: number;
  documentationScore: number;
  summary: string;
}

interface RepoInfo {
  id: string;
  full_name: string;
  name: string;
}

export default function AnalysisPage() {
  const { id } = useParams<{ id: string }>();
  const [repo, setRepo] = useState<RepoInfo | null>(null);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [lastAnalyzed, setLastAnalyzed] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;

    // Load Repo details + existing analysis
    Promise.all([
      fetch(`/api/repositories/${id}`).then((r) => (r.ok ? r.json() : null)),
      fetch(`/api/repositories/${id}/analysis`).then((r) => (r.ok ? r.json() : null)),
    ])
      .then(([repoRes, analysisRes]) => {
        setRepo(repoRes?.repository ?? null);
        if (analysisRes) {
          setAnalysis(analysisRes.analysis);
          setLastAnalyzed(analysisRes.lastAnalyzed);
        }
      })
      .catch(() => setError("Failed to load initial data."))
      .finally(() => setLoading(false));
  }, [id]);

  const handleRunAnalysis = async () => {
    setAnalyzing(true);
    setError(null);
    const toastId = toast.loading("Analyzing codebase architecture, dependencies, and patterns...");

    try {
      const res = await fetch(`/api/repositories/${id}/analysis`, {
        method: "POST",
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to analyze codebase.");
      }

      setAnalysis(data.analysis);
      setLastAnalyzed(data.lastAnalyzed);
      toast.success(
        data.persisted 
          ? "Analysis completed and saved successfully!" 
          : "Analysis completed (mock/temporary mode active).", 
        { id: toastId }
      );
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Failed to run AI Code Analysis.", { id: toastId });
      setError(err.message || "Failed to run AI Code Analysis.");
    } finally {
      setAnalyzing(false);
    }
  };

  const fmtLastAnalyzed = (iso: string | null) => {
    if (!iso) return "Never analyzed";
    return new Date(iso).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // ── Render Loading state ─────────────────────────────────────────
  if (loading) {
    return (
      <div className="repo-page">
        <nav className="page-breadcrumb">
          <Link href="/dashboard">Dashboard</Link>
          <span className="page-breadcrumb-sep">/</span>
          <Link href="/dashboard/repositories">Repositories</Link>
          <span className="page-breadcrumb-sep">/</span>
          <span className="page-breadcrumb-current">AI Code Analysis</span>
        </nav>
        <div className="space-y-4">
          <div className="h-8 w-48 bg-slate-100 dark:bg-slate-800 animate-pulse rounded-md" />
          <div className="h-4 w-64 bg-slate-100 dark:bg-slate-800 animate-pulse rounded-md" />
        </div>
        <div className="mt-8">
          <AnalysisSkeleton />
        </div>
      </div>
    );
  }

  // ── Render Error / Missing Repo state ────────────────────────────
  if (!repo) {
    return (
      <div className="repo-page">
        <nav className="page-breadcrumb">
          <Link href="/dashboard">Dashboard</Link>
          <span className="page-breadcrumb-sep">/</span>
          <Link href="/dashboard/repositories">Repositories</Link>
          <span className="page-breadcrumb-sep">/</span>
          <span className="page-breadcrumb-current">AI Code Analysis</span>
        </nav>
        <div className="text-center py-12">
          <p className="text-red-500 font-semibold">Repository not found.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="repo-page">
      {/* Breadcrumb */}
      <nav className="page-breadcrumb">
        <Link href="/dashboard">Dashboard</Link>
        <span className="page-breadcrumb-sep">/</span>
        <Link href="/dashboard/repositories">Repositories</Link>
        <span className="page-breadcrumb-sep">/</span>
        <Link href={`/dashboard/repositories/${id}`}>{repo.name}</Link>
        <span className="page-breadcrumb-sep">/</span>
        <span className="page-breadcrumb-current">AI Code Analysis</span>
      </nav>

      {/* Header section */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6 pb-6 border-b border-slate-100 dark:border-slate-800">
        <div>
          <h1 className="repo-page-title flex items-center gap-2">
            <Sparkles className="h-6 w-6 text-teal-600 dark:text-teal-400" />
            AI Code Analysis
          </h1>
          <p className="repo-page-subtitle">
            Last Analyzed: <span className="font-semibold text-slate-700 dark:text-slate-200">{fmtLastAnalyzed(lastAnalyzed)}</span>
          </p>
        </div>

        <div className="flex gap-2">
          {analysis ? (
            <Button
              onClick={handleRunAnalysis}
              disabled={analyzing}
              className="bg-slate-100 hover:bg-slate-200 text-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-100 border border-slate-200 dark:border-slate-700"
            >
              <RefreshCw className={`mr-2 h-4 w-4 ${analyzing ? "animate-spin" : ""}`} />
              Re-analyze
            </Button>
          ) : (
            <Button
              onClick={handleRunAnalysis}
              disabled={analyzing}
              className="bg-gradient-to-r from-teal-600 to-teal-500 hover:opacity-90 text-white shadow-sm"
            >
              <Sparkles className={`mr-2 h-4 w-4 ${analyzing ? "animate-spin" : ""}`} />
              Run Analysis
            </Button>
          )}
        </div>
      </div>

      {/* Main Content Area */}
      {analyzing ? (
        <AnalysisSkeleton />
      ) : error && !analysis ? (
        <div className="text-center py-12 border border-dashed rounded-lg border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
          <p className="text-rose-500 font-semibold mb-4">{error}</p>
          <Button onClick={handleRunAnalysis} className="bg-teal-600 hover:bg-teal-500 text-white">
            Retry Analysis
          </Button>
        </div>
      ) : !analysis ? (
        <div className="text-center py-16 border border-dashed rounded-lg border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm flex flex-col items-center justify-center">
          <div className="h-12 w-12 rounded-full bg-teal-50 dark:bg-teal-950/40 flex items-center justify-center text-teal-600 dark:text-teal-400 mb-4 border border-teal-100 dark:border-teal-900/50">
            <Sparkles className="h-6 w-6" />
          </div>
          <h3 className="text-base font-bold text-slate-800 dark:text-slate-100 mb-1">
            No analysis results available
          </h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 max-w-sm mb-6">
            Get automated insights about this project's architecture, dependencies, security status, and core patterns.
          </p>
          <Button onClick={handleRunAnalysis} className="bg-gradient-to-r from-teal-600 to-teal-500 text-white">
            <Sparkles className="mr-2 h-4 w-4" />
            Analyze Codebase
          </Button>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Architecture Strategy Cards */}
          <ArchitectureOverview
            framework={analysis.framework}
            renderingStrategy={analysis.renderingStrategy}
            databaseLayer={analysis.databaseLayer}
            authentication={analysis.authentication}
            architecture={analysis.architecture}
          />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Tech Stack & Design Patterns */}
            <TechStackBadges
              techStack={analysis.techStack}
              designPatterns={analysis.designPatterns}
            />

            {/* AI Architecture & Code Scores */}
            <ScoreCard
              maintainabilityScore={analysis.maintainabilityScore}
              testingScore={analysis.testingScore}
              documentationScore={analysis.documentationScore}
            />
          </div>

          {/* Insights Sections */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <InsightCard
              title="Strengths"
              items={analysis.strengths}
              variant="strengths"
            />
            <InsightCard
              title="Code Smells"
              items={analysis.codeSmells}
              variant="smells"
            />
            <InsightCard
              title="Security Risks"
              items={analysis.securityRisks}
              variant="security"
            />
            <InsightCard
              title="Performance Risks"
              items={analysis.performanceRisks}
              variant="performance"
            />
          </div>

          {/* AI Markdown Summary */}
          {analysis.summary && (
            <Card className="border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-teal-600 dark:text-teal-400" />
                  AI Architect Summary
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-2">
                <MarkdownRenderer content={analysis.summary} />
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
