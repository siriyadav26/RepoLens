// ================================================================
// API Route — Cross-Repository Intelligence
// Phase 12
// ================================================================

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  getRepoSummaries,
  getRepoMetrics,
  detectTechStack,
  compareTechStacks,
  calculateSimilarity,
  compareContributors,
  searchAcrossRepos,
  generateAIAnalysis,
  crossRepoRAG,
  generateReportMarkdown,
  generateReportText,
} from "@/lib/cross-repo/analysis";
import { saveReport, getReports, saveSimilarity } from "@/lib/cross-repo/db";
import { getUserRepositories } from "@/lib/supabase/repositories";
import type { CrossRepoSearchParams, ComparisonType } from "@/lib/cross-repo/types";

export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const action = searchParams.get("action");

    // List available repositories for selection
    if (action === "repos") {
      const summaries = await getRepoSummaries(user.id);
      return NextResponse.json({ repositories: summaries });
    }

    // Get previous reports
    if (action === "reports") {
      const reports = await getReports(user.id);
      return NextResponse.json({ reports });
    }

    // Multi-repo search
    if (action === "search") {
      const params: CrossRepoSearchParams = {
        query: searchParams.get("query") || "",
        repositoryIds: searchParams.get("repositoryIds")?.split(",").filter(Boolean),
        language: searchParams.get("language") || undefined,
        owner: searchParams.get("owner") || undefined,
        since: searchParams.get("since") || undefined,
        until: searchParams.get("until") || undefined,
        topic: searchParams.get("topic") || undefined,
        limit: parseInt(searchParams.get("limit") || "50", 10),
      };
      const results = await searchAcrossRepos(user.id, params);
      return NextResponse.json({ results });
    }

    // Full analysis for selected repos
    if (action === "analyze") {
      const repoIds = searchParams.get("repositoryIds")?.split(",").filter(Boolean);
      if (!repoIds || repoIds.length < 2) {
        return NextResponse.json({ error: "Select at least 2 repositories" }, { status: 400 });
      }

      // Get repo metadata for similarity
      const allRepos = await getUserRepositories(user.id);
      const selectedRepos = allRepos.filter((r) => repoIds.includes(r.id));

      // Fetch metrics, tech stacks in parallel
      const metricsPromises = repoIds.map((id) => getRepoMetrics(user.id, id));
      const metricsResults = await Promise.all(metricsPromises);

      // Tech stacks
      const techStacks = selectedRepos.map((r) => {
        const stack = detectTechStack({ language: r.language, topics: r.topics, name: r.name });
        return { ...stack, repositoryId: r.id, repositoryName: r.name };
      });

      // Tech comparison
      const techComp = techStacks.length >= 2 ? compareTechStacks(techStacks) : null;

      // Similarity (for all pairs)
      let similarity = null;
      if (selectedRepos.length >= 2) {
        const a = selectedRepos[0];
        const b = selectedRepos[1];
        const mA = metricsResults[0];
        const mB = metricsResults[1];
        similarity = calculateSimilarity(
          { language: a.language, topics: a.topics, totalCommits: mA.totalCommits, activeContributors: mA.activeContributors, stars: a.stars, forks: a.forks },
          { language: b.language, topics: b.topics, totalCommits: mB.totalCommits, activeContributors: mB.activeContributors, stars: b.stars, forks: b.forks },
        );
        similarity = { ...similarity, repositoryIdA: a.id, repositoryIdB: b.id };
      }

      // Contributor comparison
      let contributorComp = null;
      if (repoIds.length >= 2) {
        contributorComp = await compareContributors(user.id, repoIds[0], repoIds[1]);
      }

      return NextResponse.json({
        metrics: metricsResults,
        techStacks,
        similarity,
        contributorComparison: contributorComp,
        techComparison: techComp,
      });
    }

    return NextResponse.json({ error: "Missing 'action' parameter. Use: repos, reports, search, or analyze" }, { status: 400 });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    if (msg.includes("42P01") || msg.includes("CROSS_REPO_TABLES_MISSING")) {
      return NextResponse.json(
        { error: "Cross-repo tables not found. Run the Phase 12 SQL migration.", code: "TABLES_MISSING" },
        { status: 503 }
      );
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const { action } = body;

    // AI Analysis
    if (action === "ai-analysis") {
      const { metrics, techStacks, similarity, contributorComparison, techComparison } = body;
      if (!metrics || metrics.length < 2) {
        return NextResponse.json({ error: "Need at least 2 repos" }, { status: 400 });
      }
      const analysis = await generateAIAnalysis(metrics, techStacks, similarity, contributorComparison, techComparison);
      return NextResponse.json({ analysis });
    }

    // Cross-Repo RAG Chat
    if (action === "rag") {
      const { repositoryIds, query, queryEmbedding } = body;
      if (!repositoryIds || !query) {
        return NextResponse.json({ error: "repositoryIds and query required" }, { status: 400 });
      }
      const result = await crossRepoRAG(user.id, repositoryIds, query, queryEmbedding);
      return NextResponse.json(result);
    }

    // Save report
    if (action === "save-report") {
      const { repositoryIds, comparisonType, aiAnalysis, reportMarkdown } = body;
      if (!repositoryIds || repositoryIds.length < 2) {
        return NextResponse.json({ error: "Need at least 2 repos" }, { status: 400 });
      }
      const report = await saveReport(
        user.id,
        repositoryIds,
        comparisonType as ComparisonType ?? "full",
        aiAnalysis ?? null,
        (aiAnalysis as Record<string, unknown>)?.recommendations ?? [],
        reportMarkdown ?? null,
      );
      return NextResponse.json({ report });
    }

    // Save similarity
    if (action === "save-similarity") {
      const { repoIdA, repoIdB, similarity } = body;
      await saveSimilarity(user.id, repoIdA, repoIdB, similarity);
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}