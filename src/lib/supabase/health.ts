// ================================================================
// Supabase Health Analysis CRUD — Phase 9
// ================================================================

import { createClient } from "@/lib/supabase/server";
import type { HealthReport, HealthScores, AIAnalysis, HealthMetrics } from "@/lib/health/types";

/** Save a new health analysis */
export async function saveHealthReport(
  userId: string,
  repositoryId: string,
  scores: HealthScores,
  metrics: HealthMetrics,
  analysis: AIAnalysis | null,
  reportMarkdown: string | null
): Promise<HealthReport> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("health_analyses")
    .insert({
      user_id: userId,
      repository_id: repositoryId,
      scores,
      metrics_snapshot: {
        totalCommits: metrics.totalCommits,
        totalFiles: metrics.totalFiles,
        avgCommitSize: metrics.avgCommitSize,
        largeCommitCount: metrics.largeCommitCount,
        largeCommitPercentage: metrics.largeCommitPercentage,
        timeSpanDays: metrics.timeSpanDays,
        commitsPerWeek: metrics.commitsPerWeek,
        uniqueFiles: metrics.uniqueFiles,
        uniqueContributors: metrics.uniqueContributors,
      },
      ai_analysis: analysis,
      report_markdown: reportMarkdown,
    })
    .select()
    .single();

  if (error) {
    if (error.code === "42P01") throw new Error("HEALTH_TABLE_MISSING");
    throw new Error(`Failed to save health report: ${error.message}`);
  }

  return mapReport(data);
}

/** Get latest analysis for a repository */
export async function getLatestAnalysis(
  repositoryId: string,
  userId: string
): Promise<HealthReport | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("health_analyses")
    .select("*")
    .eq("user_id", userId)
    .eq("repository_id", repositoryId)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (error) {
    if (error.code === "PGRST116") return null;
    if (error.code === "42P01") return null;
    throw new Error(`Failed to fetch analysis: ${error.message}`);
  }

  return data ? mapReport(data) : null;
}

/** Get analysis history (for timeline) */
export async function getAnalysisHistory(
  repositoryId: string,
  userId: string,
  limit = 20
): Promise<HealthReport[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("health_analyses")
    .select("*")
    .eq("user_id", userId)
    .eq("repository_id", repositoryId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    if (error.code === "42P01") return [];
    throw new Error(`Failed to fetch analysis history: ${error.message}`);
  }

  return (data ?? []).map(mapReport);
}

/** Search analyses */
export async function searchAnalyses(
  repositoryId: string,
  userId: string,
  query: string
): Promise<{ reports: HealthReport[]; highlights: string[] }> {
  const reports = await getAnalysisHistory(repositoryId, userId, 10);
  const q = query.toLowerCase();
  const highlights: string[] = [];

  const filtered = reports.filter((r) => {
    const analysis = r.analysis;
    if (!analysis) return false;

    const matchSummary = analysis.summary.toLowerCase().includes(q);
    const matchConcerns = analysis.debtConcerns.some((c) => c.toLowerCase().includes(q));
    const matchRisks = analysis.maintenanceRisks.some((r2) => r2.toLowerCase().includes(q));
    const matchRefactor = analysis.refactoringPriorities.some((p) => p.toLowerCase().includes(q));

    if (matchConcerns) highlights.push(...analysis.debtConcerns.filter((c) => c.toLowerCase().includes(q)));
    if (matchRisks) highlights.push(...analysis.maintenanceRisks.filter((r2) => r2.toLowerCase().includes(q)));
    if (matchRefactor) highlights.push(...analysis.refactoringPriorities.filter((p) => p.toLowerCase().includes(q)));

    return matchSummary || matchConcerns || matchRisks || matchRefactor;
  });

  return { reports: filtered, highlights };
}

function mapReport(row: Record<string, unknown>): HealthReport {
  return {
    id: row.id as string,
    repositoryId: row.repository_id as string,
    userId: row.user_id as string,
    scores: row.scores as HealthScores,
    metrics: {
      scores: row.scores as HealthScores,
      hotspots: [],
      directoryActivity: [],
      commitPatterns: [],
      contributorActivity: [],
      totalCommits: (row.metrics_snapshot as Record<string, unknown>)?.totalCommits as number ?? 0,
      totalFiles: (row.metrics_snapshot as Record<string, unknown>)?.totalFiles as number ?? 0,
      avgCommitSize: (row.metrics_snapshot as Record<string, unknown>)?.avgCommitSize as number ?? 0,
      largeCommitCount: (row.metrics_snapshot as Record<string, unknown>)?.largeCommitCount as number ?? 0,
      largeCommitPercentage: (row.metrics_snapshot as Record<string, unknown>)?.largeCommitPercentage as number ?? 0,
      timeSpanDays: (row.metrics_snapshot as Record<string, unknown>)?.timeSpanDays as number ?? 0,
      commitsPerWeek: (row.metrics_snapshot as Record<string, unknown>)?.commitsPerWeek as number ?? 0,
      uniqueFiles: (row.metrics_snapshot as Record<string, unknown>)?.uniqueFiles as number ?? 0,
      uniqueContributors: (row.metrics_snapshot as Record<string, unknown>)?.uniqueContributors as number ?? 0,
    },
    analysis: row.ai_analysis as AIAnalysis | null,
    reportMarkdown: row.report_markdown as string | null,
    version: row.version as number,
    createdAt: row.created_at as string,
  };
}