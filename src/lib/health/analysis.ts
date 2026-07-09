// ================================================================
// AI Analysis Service — Phase 9
// ================================================================

import { llmService } from "@/lib/llm";
import { buildRAGContext, retrieveCommits } from "@/lib/rag";
import { createClient } from "@/lib/supabase/server";
import type { DbRepository } from "@/lib/supabase/repositories";
import type { HealthMetrics, AIAnalysis } from "./types";

const EMBEDDING_API_URL = process.env.EMBEDDING_API_URL || "https://api.groq.com/openai/v1/embeddings";
const EMBEDDING_MODEL = process.env.EMBEDDING_MODEL || "text-embedding-ada-002";

async function getEmbedding(text: string): Promise<number[]> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error("GROQ_API_KEY is not configured");

  const res = await fetch(EMBEDDING_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ model: EMBEDDING_MODEL, input: text }),
  });

  if (!res.ok) throw new Error(`Embedding API error (${res.status})`);
  const data = await res.json();
  return data.data?.[0]?.embedding ?? [];
}

function buildAnalysisPrompt(
  repo: DbRepository,
  metrics: HealthMetrics,
  contextBlock: string
): { system: string; user: string } {
  const system = `You are an expert software engineering analyst specializing in code health, technical debt assessment, and maintainability analysis.

CRITICAL RULES:
1. Base ALL analysis on the provided repository data. Do not fabricate information.
2. Clearly distinguish OBSERVATIONS (what the data shows) from RECOMMENDATIONS (what should be done).
3. If data is insufficient for a conclusion, state "Insufficient data" rather than guessing.
4. Be specific — reference actual metrics, patterns, and numbers from the data.
5. Keep analysis actionable and practical.
6. Structure output as valid JSON matching the requested schema.`;

  const metricsBlock = `## Repository Metrics
- Total Commits: ${metrics.totalCommits}
- Time Span: ${metrics.timeSpanDays} days
- Commits Per Week: ${metrics.commitsPerWeek}
- Average Commit Size: ${metrics.avgCommitSize} lines
- Large Commits (>3x avg): ${metrics.largeCommitCount} (${metrics.largeCommitPercentage}%)
- Unique Contributors: ${metrics.uniqueContributors}
- Unique Files/Branches: ${metrics.uniqueFiles}

## Health Scores
- Overall: ${metrics.scores.overall}/100
- Technical Debt: ${metrics.scores.technicalDebt}/100
- Maintainability: ${metrics.scores.maintainability}/100
- Risk: ${metrics.scores.risk}/100
- Stability: ${metrics.scores.stability}/100
- Documentation: ${metrics.scores.documentation}/100

## Top Hotspots
${metrics.hotspots.slice(0, 5).map((h) => `- "${h.path}": ${h.changeCount} changes, avg size ${h.avgSize} lines, ${h.contributors} contributors`).join("\n")}

## Top Contributors
${metrics.contributorActivity.slice(0, 5).map((c) => `- ${c.name} (${c.login}): ${c.commitCount} commits (${c.percentage}%)`).join("\n")}

## Recent Commit Patterns (last 4 weeks)
${metrics.commitPatterns.slice(0, 4).map((p) => `- ${p.week}: ${p.count} commits, avg ${p.avgSize} lines, ${p.largeCommits} large`).join("\n")}`;

  const user = `Analyze the following repository and provide a comprehensive health assessment.

## Repository
- Name: ${repo.full_name}
- Language: ${repo.language || "Unknown"}
- Description: ${repo.description || "None"}

${metricsBlock}

${contextBlock}

Return a JSON object with this exact structure (no markdown fences):
{
  "summary": "2-3 sentence overall health assessment",
  "debtConcerns": ["concern 1", "concern 2", ...],
  "unstableAreas": ["area 1", "area 2", ...],
  "maintenanceRisks": ["risk 1", "risk 2", ...],
  "refactoringPriorities": ["priority 1", "priority 2", ...],
  "positivePractices": ["practice 1", "practice 2", ...],
  "scoreExplanations": {
    "overall": "explanation",
    "technicalDebt": "explanation",
    "maintainability": "explanation",
    "risk": "explanation",
    "stability": "explanation",
    "documentation": "explanation"
  }
}`;

  return { system, user };
}

function buildReportPrompt(
  repo: DbRepository,
  metrics: HealthMetrics,
  analysis: AIAnalysis
): { system: string; user: string } {
  const system = `You are a technical writer generating a repository health report. Output clean, well-structured Markdown. Base everything on the provided data.`;

  const user = `Generate a comprehensive repository health report for **${repo.full_name}**.

## Repository
- Language: ${repo.language || "Unknown"}
- Description: ${repo.description || "None"}

## Health Scores
| Score | Value |
|-------|-------|
| Overall | ${metrics.scores.overall}/100 |
| Technical Debt | ${metrics.scores.technicalDebt}/100 |
| Maintainability | ${metrics.scores.maintainability}/100 |
| Risk | ${metrics.scores.risk}/100 |
| Stability | ${metrics.scores.stability}/100 |
| Documentation | ${metrics.scores.documentation}/100 |

## AI Analysis
- **Summary**: ${analysis.summary}
- **Debt Concerns**: ${analysis.debtConcerns.join("; ")}
- **Unstable Areas**: ${analysis.unstableAreas.join("; ")}
- **Maintenance Risks**: ${analysis.maintenanceRisks.join("; ")}
- **Refactoring Priorities**: ${analysis.refactoringPriorities.join("; ")}
- **Positive Practices**: ${analysis.positivePractices.join("; ")}

## Key Metrics
- Total Commits: ${metrics.totalCommits} over ${metrics.timeSpanDays} days
- Commits Per Week: ${metrics.commitsPerWeek}
- Average Commit Size: ${metrics.avgCommitSize} lines
- Large Commits: ${metrics.largeCommitCount} (${metrics.largeCommitPercentage}%)
- Contributors: ${metrics.uniqueContributors}

## Top Hotspots
${metrics.hotspots.slice(0, 5).map((h) => `- **${h.path}** — ${h.changeCount} changes, avg ${h.avgSize} lines`).join("\n")}

## Contributors
${metrics.contributorActivity.map((c) => `- **${c.name}** — ${c.commitCount} commits (${c.percentage}%)`).join("\n")}

Generate the report with these sections:
1. Executive Summary
2. Health Scores (include the table)
3. Key Findings
4. Technical Debt Analysis
5. Hotspot Analysis
6. AI Recommendations
7. Suggested Next Steps

Use proper Markdown formatting with headers, tables, bullet lists, and bold text.`;

  return { system, user };
}

export async function runAIAnalysis(
  userId: string,
  repo: DbRepository,
  metrics: HealthMetrics
): Promise<AIAnalysis> {
  let contextBlock = "";

  try {
    const queryEmbedding = await getEmbedding(
      `technical debt code health maintainability refactoring risks ${repo.name}`
    );
    const results = await retrieveCommits(userId, repo.id, queryEmbedding, {
      queryEmbedding,
      limit: 15,
      minSimilarity: 0.2,
    });
    const rag = buildRAGContext("health analysis", results, {
      name: repo.name,
      fullName: repo.full_name,
      language: repo.language,
      description: repo.description,
      defaultBranch: repo.default_branch,
    });
    contextBlock = rag.contextBlock;
  } catch {
    // Fallback: fetch recent commits directly
    const supabase = await createClient();
    const { data: commits } = await supabase
      .from("commits")
      .select("sha, message, author_name, committed_date, additions, deletions")
      .eq("user_id", userId)
      .eq("repository_id", repo.id)
      .order("committed_date", { ascending: false })
      .limit(15);

    if (commits?.length) {
      contextBlock = "=== RECENT COMMITS ===\n" +
        commits.map((c: Record<string, unknown>) =>
          `[${(c.sha as string).slice(0, 7)}] ${c.message} | +${c.additions} -${c.deletions}`
        ).join("\n") + "\n=== END ===";
    }
  }

  if (!contextBlock) {
    return {
      summary: "Insufficient commit data available for meaningful AI analysis. Import commits to enable full analysis.",
      debtConcerns: ["Cannot assess — no commit data"],
      unstableAreas: ["Cannot assess — no commit data"],
      maintenanceRisks: ["No data to evaluate risks"],
      refactoringPriorities: ["Import commits first"],
      positivePractices: ["Cannot assess"],
      scoreExplanations: {
        overall: "No data available",
        technicalDebt: "No data available",
        maintainability: "No data available",
        risk: "No data available",
        stability: "No data available",
        documentation: "No data available",
      },
    };
  }

  const { system, user } = buildAnalysisPrompt(repo, metrics, contextBlock);

  const response = await llmService.generate(
    [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    { temperature: 0.3, maxTokens: 4000 }
  );

  try {
    // Strip markdown fences if present
    let jsonStr = response.content.trim();
    if (jsonStr.startsWith("```")) {
      jsonStr = jsonStr.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
    }
    return JSON.parse(jsonStr) as AIAnalysis;
  } catch {
    // If JSON parse fails, return structured fallback
    return {
      summary: response.content.slice(0, 500),
      debtConcerns: ["Analysis returned unstructured output — review the raw summary above"],
      unstableAreas: [],
      maintenanceRisks: [],
      refactoringPriorities: [],
      positivePractices: [],
      scoreExplanations: {
        overall: metrics.scores.overall + "/100 based on commit metrics",
        technicalDebt: metrics.scores.technicalDebt + "/100",
        maintainability: metrics.scores.maintainability + "/100",
        risk: metrics.scores.risk + "/100",
        stability: metrics.scores.stability + "/100",
        documentation: metrics.scores.documentation + "/100",
      },
    };
  }
}

export async function generateReport(
  repo: DbRepository,
  metrics: HealthMetrics,
  analysis: AIAnalysis
): Promise<string> {
  const { system, user } = buildReportPrompt(repo, metrics, analysis);

  const response = await llmService.generate(
    [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    { temperature: 0.4, maxTokens: 5000 }
  );

  return response.content;
}