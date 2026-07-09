// ================================================================
// AI Analysis Service — Phase 10
// ================================================================

import { llmService } from "@/lib/llm";
import { buildRAGContext, retrieveCommits } from "@/lib/rag";
import { createClient } from "@/lib/supabase/server";
import type { DbRepository } from "@/lib/supabase/repositories";
import type { EvolutionMetrics, AIArchitectureSummary, TimePeriod } from "./types";
import { buildTimeline } from "./metrics";

const EMBEDDING_API_URL = process.env.EMBEDDING_API_URL || "https://api.groq.com/openai/v1/embeddings";
const EMBEDDING_MODEL = process.env.EMBEDDING_MODEL || "text-embedding-ada-002";

async function getEmbedding(text: string): Promise<number[]> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error("GROQ_API_KEY is not configured");
  const res = await fetch(EMBEDDING_API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ model: EMBEDDING_MODEL, input: text }),
  });
  if (!res.ok) throw new Error(`Embedding API error (${res.status})`);
  const data = await res.json();
  return data.data?.[0]?.embedding ?? [];
}

export async function runArchitectureAnalysis(
  userId: string,
  repo: DbRepository,
  metrics: EvolutionMetrics
): Promise<AIArchitectureSummary> {
  let contextBlock = "";
  try {
    const queryEmbedding = await getEmbedding(`architecture evolution structure changes ${repo.name}`);
    const results = await retrieveCommits(userId, repo.id, queryEmbedding, {
      queryEmbedding, limit: 15, minSimilarity: 0.2,
    });
    const rag = buildRAGContext("architecture analysis", results, {
      name: repo.name, fullName: repo.full_name,
      language: repo.language, description: repo.description,
      defaultBranch: repo.default_branch,
    });
    contextBlock = rag.contextBlock;
  } catch {
    const supabase = await createClient();
    const { data: commits } = await supabase
      .from("commits").select("sha, message, committed_date, additions, deletions")
      .eq("user_id", userId).eq("repository_id", repo.id)
      .order("committed_date", { ascending: false }).limit(15);
    if (commits?.length) {
      contextBlock = "=== RECENT COMMITS ===\n" +
        commits.map((c: Record<string, unknown>) => `[${(c.sha as string).slice(0, 7)}] ${c.message} | +${c.additions} -${c.deletions}`).join("\n") + "\n=== END ===";
    }
  }

  if (!contextBlock) {
    return fallbackSummary(metrics);
  }

  const metricsBlock = `## Evolution Metrics
- Total Commits: ${metrics.totalCommits} over ${metrics.timeSpanDays} days
- Contributors: ${metrics.uniqueContributors}
- Folders/Modules: ${metrics.folders.length} folders, ${metrics.modules.length} modules
- Milestones Detected: ${metrics.milestones.length}
- Top Folders: ${metrics.folders.slice(0, 5).map((f) => `${f.path} (${f.totalCommits} commits)`).join(", ")}
- Top Modules: ${metrics.modules.slice(0, 5).map((m) => `${m.name} (${m.commitCount} commits)`).join(", ")}`;

  const { system, user } = {
    system: `You are an expert software architecture analyst. Analyze repository evolution. Base ALL analysis on provided data. Return JSON matching the exact schema. No markdown fences.`,
    user: `Analyze this repository's architecture evolution:
- **${repo.full_name}** (${repo.language || "Unknown"})

${metricsBlock}

${contextBlock}

Return JSON:
{
  "evolutionOverview": "2-3 sentences on how the architecture evolved",
  "structuralChanges": ["change 1", "change 2", ...],
  "activeSubsystems": ["subsystem 1", ...],
  "stableComponents": ["component 1", ...],
  "growthAreas": ["area 1", ...],
  "architecturalRisks": ["risk 1", ...]
}`,
  };

  const response = await llmService.generate(
    [{ role: "system", content: system }, { role: "user", content: user }],
    { temperature: 0.3, maxTokens: 3500 },
  );

  try {
    let jsonStr = response.content.trim();
    if (jsonStr.startsWith("```")) jsonStr = jsonStr.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
    return JSON.parse(jsonStr) as AIArchitectureSummary;
  } catch {
    return { ...fallbackSummary(metrics), evolutionOverview: response.content.slice(0, 500) };
  }
}

function fallbackSummary(metrics: EvolutionMetrics): AIArchitectureSummary {
  return {
    evolutionOverview: `This repository has ${metrics.totalCommits} commits over ${metrics.timeSpanDays} days by ${metrics.uniqueContributors} contributors. ${metrics.folders.length > 1 ? "Activity spans multiple branches." : "Activity is concentrated on a single branch."}`,
    structuralChanges: metrics.milestones.filter((m) => m.type === "major_refactor" || m.type === "reorganization").map((m) => m.title),
    activeSubsystems: metrics.folders.slice(0, 3).map((f) => f.path),
    stableComponents: [],
    growthAreas: metrics.folders.slice(0, 3).map((f) => `${f.path} (${f.growthRate} lines/week)`),
    architecturalRisks: metrics.folders.length === 1 ? ["Single-branch concentration"] : [],
  };
}

export async function generateEvolutionReport(
  repo: DbRepository,
  metrics: EvolutionMetrics,
  summary: AIArchitectureSummary
): Promise<string> {
  const system = `You are a technical writer. Generate a well-structured Markdown architecture evolution report. Base everything on provided data.`;

  const user = `Generate an Architecture Evolution Report for **${repo.full_name}** (${repo.language || "Unknown"}).

## Key Data
- ${metrics.totalCommits} commits over ${metrics.timeSpanDays} days, ${metrics.uniqueContributors} contributors
- ${metrics.folders.length} branches/folders, ${metrics.modules.length} modules detected
- ${metrics.milestones.length} milestones detected

## AI Analysis
- Overview: ${summary.evolutionOverview}
- Structural Changes: ${summary.structuralChanges.join("; ")}
- Active Subsystems: ${summary.activeSubsystems.join(", ")}
- Stable Components: ${summary.stableComponents.join(", ") || "None identified"}
- Growth Areas: ${summary.growthAreas.join(", ")}
- Risks: ${summary.architecturalRisks.join("; ") || "None identified"}

## Milestones
${metrics.milestones.map((m) => `- **${m.title}** (${new Date(m.date).toLocaleDateString()}) — ${m.description}`).join("\n")}

## Top Modules
${metrics.modules.slice(0, 8).map((m) => `- **${m.name}**: ${m.commitCount} commits, ${m.contributors.length} contributors, freq ${m.changeFrequency}/week`).join("\n")}

Generate sections: Executive Summary, Timeline Overview, Milestones, Module Statistics, Folder/Branch Statistics, AI Architecture Analysis, Suggested Improvements. Use proper Markdown with headers, tables, lists.`;

  const response = await llmService.generate(
    [{ role: "system", content: system }, { role: "user", content: user }],
    { temperature: 0.4, maxTokens: 5000 },
  );
  return response.content;
}

export async function compareEvolution(
  userId: string,
  repo: DbRepository,
  date1: string,
  date2: string
): Promise<string> {
  const supabase = await createClient();
  const { data: commits } = await supabase
    .from("commits")
    .select("sha, message, author_name, committed_date, additions, deletions, files_changed, branch")
    .eq("user_id", userId)
    .eq("repository_id", repo.id)
    .gte("committed_date", date1)
    .lte("committed_date", date2)
    .order("committed_date", { ascending: true });

  const count = commits?.length ?? 0;
  const additions = (commits ?? []).reduce((s, c) => s + (c.additions ?? 0), 0);
  const deletions = (commits ?? []).reduce((s, c) => s + (c.deletions ?? 0), 0);

  const response = await llmService.generate(
    [
      { role: "system", content: "You are an architecture analyst. Compare two periods of repository evolution. Output Markdown." },
      { role: "user", content: `Compare the evolution of ${repo.full_name} between ${new Date(date1).toLocaleDateString()} and ${new Date(date2).toLocaleDateString()}.

Period data: ${count} commits, +${additions} -${deletions} lines changed.
Commits: ${(commits ?? []).map((c) => `[${c.sha.slice(0, 7)}] ${c.message} (+${c.additions} -${c.deletions})`).join("\n")}

Provide: Summary, Key Differences, Notable Changes, and Impact Assessment in Markdown.` },
    ],
    { temperature: 0.4, maxTokens: 3000 },
  );
  return response.content;
}