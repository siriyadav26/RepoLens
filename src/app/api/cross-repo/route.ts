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
} from "@/lib/cross-repo/analysis";
import { saveReport, getReports, saveSimilarity } from "@/lib/cross-repo/db";
import { getUserRepositories } from "@/lib/supabase/repositories";
import type { CrossRepoSearchParams, ComparisonType, SimilarityScore, ContributorComparison } from "@/lib/cross-repo/types";
import { checkRateLimit, crossRepoLimit, aiLimit } from "@/lib/rate-limit";
import { safeErrorResponse, clampInt, validateUUIDs } from "@/lib/api-error";

export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // ── Rate Limiting ─────────────────────────────────────────────
    const limited = checkRateLimit(user.id, "cross-repo-get", crossRepoLimit);
    if (limited) return limited;

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
      // ── Input Validation ───────────────────────────────────────
      const rawLimit = clampInt(searchParams.get("limit"), 1, 100, 50);
      const rawRepoIds = searchParams.get("repositoryIds")?.split(",").filter(Boolean) ?? [];
      if (rawRepoIds.length > 0) {
        const uuidError = validateUUIDs(rawRepoIds);
        if (uuidError) {
          return NextResponse.json({ error: uuidError }, { status: 400 });
        }
      }

      const params: CrossRepoSearchParams = {
        query: searchParams.get("query") || "",
        repositoryIds: rawRepoIds.length > 0 ? rawRepoIds : undefined,
        language: searchParams.get("language") || undefined,
        owner: searchParams.get("owner") || undefined,
        since: searchParams.get("since") || undefined,
        until: searchParams.get("until") || undefined,
        topic: searchParams.get("topic") || undefined,
        limit: rawLimit,
      };
      const results = await searchAcrossRepos(user.id, params);
      return NextResponse.json({ results });
    }

    // Full analysis for selected repos
    if (action === "analyze") {
      const rawRepoIds = searchParams.get("repositoryIds")?.split(",").filter(Boolean);
      if (!rawRepoIds || rawRepoIds.length < 2) {
        return NextResponse.json({ error: "Select at least 2 repositories" }, { status: 400 });
      }

      // ── UUID Validation ────────────────────────────────────────
      const uuidError = validateUUIDs(rawRepoIds);
      if (uuidError) {
        return NextResponse.json({ error: uuidError }, { status: 400 });
      }
      const repoIds = rawRepoIds;

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
      let similarity: (SimilarityScore & { repositoryIdA: string; repositoryIdB: string }) | null = null;
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
      let contributorComp: ContributorComparison | null = null;
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
    return safeErrorResponse(error, { context: "CrossRepo GET" });
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
      // ── Rate Limiting (stricter for AI calls) ─────────────────
      const limited = checkRateLimit(user.id, "cross-repo-ai", aiLimit);
      if (limited) return limited;

      const { metrics, techStacks, similarity, contributorComparison, techComparison } = body;
      if (!metrics || metrics.length < 2) {
        return NextResponse.json({ error: "Need at least 2 repos" }, { status: 400 });
      }
      const analysis = await generateAIAnalysis(metrics, techStacks, similarity, contributorComparison, techComparison);
      return NextResponse.json({ analysis });
    }

    // ── Rate Limiting (general POST) ───────────────────────────
    const limited = checkRateLimit(user.id, "cross-repo-post", crossRepoLimit);
    if (limited) return limited;

    // Cross-Repo RAG Chat
    if (action === "rag") {
      const { repositoryIds, query, queryEmbedding } = body;
      if (!repositoryIds || !query) {
        return NextResponse.json({ error: "repositoryIds and query required" }, { status: 400 });
      }
      // Validate UUIDs
      const uuidError = validateUUIDs(repositoryIds);
      if (uuidError) {
        return NextResponse.json({ error: uuidError }, { status: 400 });
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
      const uuidError = validateUUIDs(repositoryIds);
      if (uuidError) {
        return NextResponse.json({ error: uuidError }, { status: 400 });
      }
      const report = await saveReport(
        user.id,
        repositoryIds,
        comparisonType as ComparisonType ?? "full",
        aiAnalysis ?? null,
        ((aiAnalysis as Record<string, unknown>)?.recommendations ?? []) as string[],
        reportMarkdown ?? null,
      );
      return NextResponse.json({ report });
    }

    // Save similarity
    if (action === "save-similarity") {
      const { repoIdA, repoIdB, similarity } = body;
      // Validate UUIDs
      const uuidError = validateUUIDs([repoIdA, repoIdB].filter(Boolean));
      if (uuidError) {
        return NextResponse.json({ error: uuidError }, { status: 400 });
      }
      await saveSimilarity(user.id, repoIdA, repoIdB, similarity);
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (error) {
    return safeErrorResponse(error, { context: "CrossRepo POST" });
  }
}
