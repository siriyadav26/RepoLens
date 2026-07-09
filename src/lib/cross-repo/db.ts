// ================================================================
// Cross-Repository DB Layer — Phase 12
// ================================================================

import { createClient } from "@/lib/supabase/server";
import type { CrossRepoReport, ComparisonType, SimilarityScore } from "./types";

export async function saveReport(
  userId: string,
  repositoryIds: string[],
  comparisonType: ComparisonType,
  aiAnalysis: Record<string, unknown> | null,
  recommendations: string[],
  reportMarkdown: string | null
): Promise<CrossRepoReport> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("cross_repo_reports")
    .insert({
      user_id: userId,
      repository_ids: repositoryIds,
      comparison_type: comparisonType,
      ai_summary: aiAnalysis ?? {},
      ai_recommendations: recommendations,
      report_markdown: reportMarkdown,
    })
    .select()
    .single();

  if (error) {
    if (error.code === "42P01") throw new Error("CROSS_REPO_TABLES_MISSING");
    throw new Error(`Failed to save report: ${error.message}`);
  }

  return mapReport(data, repositoryIds);
}

export async function getReports(userId: string): Promise<{ id: string; repositoryNames: string[]; comparisonType: string; createdAt: string }[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("cross_repo_reports")
    .select("id, repository_ids, comparison_type, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) {
    if (error.code === "42P01") return [];
    throw new Error(`Failed to fetch reports: ${error.message}`);
  }

  // Get repo names for each report
  const results: { id: string; repositoryNames: string[]; comparisonType: string; createdAt: string }[] = [];
  for (const row of data ?? []) {
    const ids = (row.repository_ids as string[]) ?? [];
    let names: string[] = [];
    if (ids.length > 0) {
      const { data: repos } = await supabase
        .from("repositories")
        .select("name")
        .in("id", ids);
      names = (repos ?? []).map((r: Record<string, unknown>) => r.name as string);
    }
    results.push({
      id: row.id as string,
      repositoryNames: names,
      comparisonType: row.comparison_type as string,
      createdAt: row.created_at as string,
    });
  }

  return results;
}

export async function saveSimilarity(
  userId: string,
  repoIdA: string,
  repoIdB: string,
  similarity: Omit<SimilarityScore, "repositoryIdA" | "repositoryIdB">
): Promise<void> {
  const supabase = await createClient();

  await supabase
    .from("repo_similarity_scores")
    .upsert({
      user_id: userId,
      repository_id_a: repoIdA,
      repository_id_b: repoIdB,
      overall_score: similarity.overallScore,
      shared_concepts: similarity.sharedConcepts,
      unique_a: similarity.uniqueToA,
      unique_b: similarity.uniqueToB,
      reasoning: similarity.reasoning,
    }, { onConflict: "user_id,repository_id_a,repository_id_b" });
}

function mapReport(row: Record<string, unknown>, repositoryIds: string[]): CrossRepoReport {
  return {
    id: row.id as string,
    userId: row.user_id as string,
    repositoryIds: repositoryIds,
    repositoryNames: [],
    comparisonType: row.comparison_type as ComparisonType,
    metrics: [],
    techStacks: [],
    similarity: null,
    contributorComparison: null,
    techComparison: null,
    aiAnalysis: (row.ai_summary as CrossRepoReport["aiAnalysis"]) ?? null,
    reportMarkdown: row.report_markdown as string | null,
    version: row.version as number,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}