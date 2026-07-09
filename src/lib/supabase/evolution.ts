import { createClient } from "@/lib/supabase/server";
import type { EvolutionReport, AIArchitectureSummary } from "@/lib/evolution/types";

export async function saveEvolutionReport(
  userId: string,
  repositoryId: string,
  aiSummary: AIArchitectureSummary,
  reportMarkdown: string | null
): Promise<EvolutionReport> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("evolution_reports")
    .insert({ user_id: userId, repository_id: repositoryId, ai_summary: aiSummary, report_markdown: reportMarkdown })
    .select().single();
  if (error) {
    if (error.code === "42P01") throw new Error("EVOLUTION_TABLE_MISSING");
    throw new Error(`Failed to save report: ${error.message}`);
  }
  return { id: data.id, repositoryId: data.repository_id, userId: data.user_id, aiSummary: data.ai_summary, reportMarkdown: data.report_markdown, version: data.version, createdAt: data.created_at };
}

export async function getLatestEvolutionReport(
  repositoryId: string,
  userId: string
): Promise<EvolutionReport | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("evolution_reports")
    .select("*")
    .eq("user_id", userId)
    .eq("repository_id", repositoryId)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();
  if (error || !data) {
    if (error?.code === "PGRST116" || error?.code === "42P01") return null;
    throw new Error(`Failed to fetch report: ${error?.message}`);
  }
  return { id: data.id, repositoryId: data.repository_id, userId: data.user_id, aiSummary: data.ai_summary, reportMarkdown: data.report_markdown, version: data.version, createdAt: data.created_at };
}