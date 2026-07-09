// ================================================================
// API Route — Cross-Repo Report Export
// Phase 12
// ================================================================

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  getRepoMetrics,
  detectTechStack,
  compareTechStacks,
  calculateSimilarity,
  compareContributors,
  generateAIAnalysis,
  generateReportMarkdown,
  generateReportText,
} from "@/lib/cross-repo/analysis";
import { getUserRepositories } from "@/lib/supabase/repositories";
import type { RepoMetrics, TechStack, SimilarityScore, ContributorComparison, TechComparison, CrossRepoAIAnalysis } from "@/lib/cross-repo/types";

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const { repositoryIds, format, metrics: inputMetrics, techStacks: inputStacks, similarity: inputSimilarity, contributorComparison: inputContrib, techComparison: inputTechComp, aiAnalysis: inputAI } = body;

    if (!repositoryIds || repositoryIds.length < 2) {
      return NextResponse.json({ error: "Need at least 2 repos" }, { status: 400 });
    }

    // Use provided data or compute fresh
    const allRepos = await getUserRepositories(user.id);
    const selectedRepos = allRepos.filter((r) => repositoryIds.includes(r.id));

    let metrics: RepoMetrics[] = inputMetrics;
    let techStacks: TechStack[] = inputStacks;
    let similarity: SimilarityScore | null = inputSimilarity;
    let contributorComp: ContributorComparison | null = inputContrib;
    let techComp: TechComparison | null = inputTechComp;
    let ai: CrossRepoAIAnalysis | null = inputAI;

    if (!metrics || metrics.length < 2) {
      const metricsPromises = repositoryIds.map((id: string) => getRepoMetrics(user.id, id));
      metrics = await Promise.all(metricsPromises);
    }

    if (!techStacks || techStacks.length < 2) {
      techStacks = selectedRepos.map((r) => {
        const stack = detectTechStack({ language: r.language, topics: r.topics, name: r.name });
        return { ...stack, repositoryId: r.id, repositoryName: r.name };
      });
    }

    if (!techComp) {
      techComp = techStacks.length >= 2 ? compareTechStacks(techStacks) : null;
    }

    const markdown = generateReportMarkdown(metrics, techStacks, similarity, contributorComp, techComp, ai);

    if (format === "text") {
      return new NextResponse(generateReportText(markdown), {
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          "Content-Disposition": `attachment; filename="cross-repo-report-${new Date().toISOString().slice(0, 10)}.txt"`,
        },
      });
    }

    // Default: markdown
    return new NextResponse(markdown, {
      headers: {
        "Content-Type": "text/markdown; charset=utf-8",
        "Content-Disposition": `attachment; filename="cross-repo-report-${new Date().toISOString().slice(0, 10)}.md"`,
      },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}