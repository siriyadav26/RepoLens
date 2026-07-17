// ================================================================
// Cross-Repository Analysis Engine — Phase 12
// ================================================================

import { createClient } from "@/lib/supabase/server";
import { getUserRepositories } from "@/lib/supabase/repositories";
import { getRepoEvolutionStats } from "@/lib/supabase/commits";
import { llmService } from "@/lib/llm";
import type { LLMMessage } from "@/lib/llm/types";
import type {
  RepoSummary, RepoMetrics, TechStack, TechComparison,
  SimilarityScore, ContributorComparison, CrossRepoSearchParams,
  CrossRepoSearchResult, CrossRepoAIAnalysis, ComparisonType,
} from "./types";

// ================================================================
// Repository Summaries
// ================================================================

export async function getRepoSummaries(userId: string): Promise<RepoSummary[]> {
  const repos = await getUserRepositories(userId);
  const summaries: RepoSummary[] = [];

  for (const repo of repos) {
    const stats = await getRepoEvolutionStats(repo.id, userId);
    summaries.push({
      id: repo.id,
      name: repo.name,
      fullName: repo.full_name,
      language: repo.language,
      description: repo.description,
      stars: repo.stars,
      forks: repo.forks,
      topics: repo.topics ?? [],
      defaultBranch: repo.default_branch,
      totalCommits: stats.totalCommits,
      activeContributors: stats.activeContributors,
      totalAdditions: stats.totalAdditions,
      totalDeletions: stats.totalDeletions,
    });
  }

  return summaries;
}

// ================================================================
// Per-Repository Metrics
// ================================================================

export async function getRepoMetrics(userId: string, repositoryId: string): Promise<RepoMetrics> {
  const supabase = await createClient();
  const { data: repo } = await supabase
    .from("repositories")
    .select("name, language")
    .eq("id", repositoryId)
    .eq("user_id", userId)
    .single();

  const stats = await getRepoEvolutionStats(repositoryId, userId);
  const avgSize = stats.totalCommits > 0
    ? Math.round((stats.totalAdditions + stats.totalDeletions) / stats.totalCommits)
    : 0;

  // Unique files estimate from commit data
  const { count: fileCount } = await supabase
    .from("commits")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("repository_id", repositoryId);

  const totalContribs = stats.contributors.reduce((s, c) => s + c.count, 0);

  return {
    repositoryId,
    repositoryName: repo?.name ?? "Unknown",
    language: repo?.language ?? null,
    totalCommits: stats.totalCommits,
    activeContributors: stats.activeContributors,
    totalAdditions: stats.totalAdditions,
    totalDeletions: stats.totalDeletions,
    avgCommitSize: avgSize,
    commitsPerWeek: stats.commitsPerWeek.length > 0
      ? Math.round(stats.commitsPerWeek.reduce((s, c) => s + c.count, 0) / stats.commitsPerWeek.length * 10) / 10
      : 0,
    uniqueFiles: fileCount ?? 0,
    topContributors: stats.contributors.slice(0, 10).map((c) => ({
      login: c.login,
      name: c.name,
      count: c.count,
      percentage: totalContribs > 0 ? Math.round((c.count / totalContribs) * 10000) / 100 : 0,
    })),
    commitFrequency: stats.commitsPerMonth.map((m) => ({ period: m.month, count: m.count })),
  };
}

// ================================================================
// Technology Stack Detection (heuristic)
// ================================================================

const LANGUAGE_FRAMEWORKS: Record<string, string[]> = {
  TypeScript: ["Next.js", "React", "Node.js", "Express", "NestJS", "Fastify", "tRPC"],
  JavaScript: ["React", "Vue.js", "Angular", "Node.js", "Express", "Svelte", "D3.js"],
  Python: ["Django", "Flask", "FastAPI", "PyTorch", "TensorFlow", "pandas", "scikit-learn"],
  Go: ["Gin", "Echo", "Fiber", "gRPC", "Cobra"],
  Rust: ["Actix", "Axum", "Tokio", "Serde", "Clap"],
  Java: ["Spring Boot", "Quarkus", "Micronaut", "Hibernate", "Maven", "Gradle"],
  Ruby: ["Rails", "Sinatra", "Sidekiq", "RSpec"],
  PHP: ["Laravel", "Symfony", "WordPress"],
  CSharp: [".NET", "ASP.NET", "Blazor", "Entity Framework"],
  Swift: ["SwiftUI", "Vapor", "Kitura"],
  Kotlin: ["Ktor", "Spring", "Jetpack Compose"],
};

const TOPIC_FRAMEWORKS: Record<string, string> = {
  "nextjs": "Next.js", "react": "React", "vue": "Vue.js", "angular": "Angular",
  "django": "Django", "flask": "Flask", "fastapi": "FastAPI", "rails": "Rails",
  "spring-boot": "Spring Boot", "laravel": "Laravel", ".net": ".NET",
  "express": "Express", "nestjs": "NestJS", "svelte": "Svelte",
  "postgresql": "PostgreSQL", "mysql": "MySQL", "mongodb": "MongoDB",
  "redis": "Redis", "docker": "Docker", "kubernetes": "Kubernetes",
  "terraform": "Terraform", "aws": "AWS", "gcp": "GCP", "azure": "Azure",
  "prisma": "Prisma", "graphql": "GraphQL", "rest-api": "REST API",
  "supabase": "Supabase", "firebase": "Firebase", "vercel": "Vercel",
  "tailwindcss": "Tailwind CSS", "shadcn": "shadcn/ui",
};

export function detectTechStack(repo: { language: string | null; topics: string[]; name: string }): TechStack {
  const frameworks = new Set<string>();
  const packageManagers = new Set<string>();
  const buildTools = new Set<string>();
  const databases = new Set<string>();
  const deploymentTools = new Set<string>();
  const detectedFrom: string[] = [];

  // Language-based framework detection
  if (repo.language) {
    const langFrameworks = LANGUAGE_FRAMEWORKS[repo.language] ?? [];
    if (langFrameworks.length > 0) {
      detectedFrom.push(`language:${repo.language}`);
    }
  }

  // Topic-based detection (most reliable)
  for (const topic of repo.topics) {
    const t = topic.toLowerCase();
    const framework = TOPIC_FRAMEWORKS[t];
    if (framework) {
      frameworks.add(framework);
      detectedFrom.push(`topic:${topic}`);
    }
    // Database detection
    if (["postgresql", "postgres", "mysql", "mongodb", "redis", "sqlite", "cockroachdb"].includes(t)) {
      databases.add(t === "postgres" ? "PostgreSQL" : t.charAt(0).toUpperCase() + t.slice(1));
      detectedFrom.push(`topic:${topic}`);
    }
    // Package manager
    if (["npm", "yarn", "pnpm", "bun", "pip", "poetry", "cargo", "go-modules", "maven", "gradle", "composer", "nuget"].includes(t)) {
      packageManagers.add(t.charAt(0).toUpperCase() + t.slice(1));
      detectedFrom.push(`topic:${topic}`);
    }
    // Build tools
    if (["webpack", "vite", "esbuild", "turbo", "turborepo", "make", "cmake", "bazel", "docker", "github-actions"].includes(t)) {
      buildTools.add(t.charAt(0).toUpperCase() + t.slice(1));
      detectedFrom.push(`topic:${topic}`);
    }
    // Deployment
    if (["vercel", "netlify", "heroku", "railway", "fly-io", "docker", "kubernetes", "aws", "gcp", "azure", "cloudflare"].includes(t)) {
      deploymentTools.add(t.charAt(0).toUpperCase() + t.slice(1));
      detectedFrom.push(`topic:${topic}`);
    }
  }

  // Default package managers by language
  if (packageManagers.size === 0 && repo.language) {
    const defaults: Record<string, string> = {
      TypeScript: "npm/pnpm", JavaScript: "npm/yarn", Python: "pip/poetry",
      Go: "Go Modules", Rust: "Cargo", Java: "Gradle/Maven",
      Ruby: "Bundler", PHP: "Composer", CSharp: "NuGet",
    };
    const d = defaults[repo.language];
    if (d) packageManagers.add(d);
  }

  // Default build tools
  if (buildTools.size === 0 && repo.language) {
    if (["TypeScript", "JavaScript"].includes(repo.language)) buildTools.add("Vite/Webpack");
    if (["Go", "Rust"].includes(repo.language)) buildTools.add("Native Compiler");
  }

  // Languages as array
  const languages = repo.language ? [{ name: repo.language, percentage: 100 }] : [];

  return {
    repositoryId: "", // filled by caller
    repositoryName: repo.name,
    languages,
    frameworks: Array.from(frameworks),
    packageManagers: Array.from(packageManagers),
    buildTools: Array.from(buildTools),
    databases: Array.from(databases),
    deploymentTools: Array.from(deploymentTools),
    detectedFrom,
  };
}

export function compareTechStacks(stacks: TechStack[]): TechComparison {
  if (stacks.length < 2) {
    return { shared: [], onlyInA: [], onlyInB: [], allTechnologies: [] };
  }

  const [a, b] = stacks;
  const collectAll = (s: TechStack) => new Set([
    ...s.languages.map((l) => l.name),
    ...s.frameworks,
    ...s.packageManagers,
    ...s.buildTools,
    ...s.databases,
    ...s.deploymentTools,
  ]);

  const allA = collectAll(a);
  const allB = collectAll(b);

  const shared: string[] = [];
  const onlyInA: string[] = [];
  const onlyInB: string[] = [];

  for (const t of allA) {
    if (allB.has(t)) shared.push(t);
    else onlyInA.push(t);
  }

  for (const t of allB) {
    if (!allA.has(t)) onlyInB.push(t);
  }

  return {
    shared: shared.sort(),
    onlyInA: onlyInA.sort(),
    onlyInB: onlyInB.sort(),
    allTechnologies: Array.from(new Set([...shared, ...onlyInA, ...onlyInB])).sort(),
  };
}

// ================================================================
// Similarity Analysis
// ================================================================

export function calculateSimilarity(
  repoA: { language: string | null; topics: string[]; totalCommits: number; activeContributors: number; stars: number; forks: number },
  repoB: { language: string | null; topics: string[]; totalCommits: number; activeContributors: number; stars: number; forks: number }
): SimilarityScore {
  // Language similarity
  const languageScore = (repoA.language && repoB.language && repoA.language === repoB.language) ? 1.0
    : (repoA.language && repoB.language && areSimilarLanguages(repoA.language, repoB.language)) ? 0.6
    : (!repoA.language || !repoB.language) ? 0.3
    : 0.0;

  // Topic overlap (Jaccard)
  const setA = new Set(repoA.topics.map((t) => t.toLowerCase()));
  const setB = new Set(repoB.topics.map((t) => t.toLowerCase()));
  const intersection = new Set([...setA].filter((t) => setB.has(t)));
  const union = new Set([...setA, ...setB]);
  const topicScore = union.size > 0 ? intersection.size / union.size : 0;

  // Commit pattern similarity (normalized)
  const maxCommits = Math.max(repoA.totalCommits, repoB.totalCommits, 1);
  const commitDiff = Math.abs(repoA.totalCommits - repoB.totalCommits) / maxCommits;
  const commitScore = 1 - Math.min(commitDiff, 1);

  // Contributor overlap similarity
  const maxContribs = Math.max(repoA.activeContributors, repoB.activeContributors, 1);
  const contribDiff = Math.abs(repoA.activeContributors - repoB.activeContributors) / maxContribs;
  const contributorScore = 1 - Math.min(contribDiff, 1);

  // Weighted overall
  const overallScore = Math.round((
    languageScore * 0.35 +
    topicScore * 0.25 +
    commitScore * 0.20 +
    contributorScore * 0.20
  ) * 10000) / 10000;

  // Shared concepts
  const sharedConcepts = Array.from(intersection).map(capitalize);
  const uniqueToA = Array.from(setA).filter((t) => !setB.has(t)).map(capitalize);
  const uniqueToB = Array.from(setB).filter((t) => !setA.has(t)).map(capitalize);

  // Reasoning
  const reasons: string[] = [];
  if (languageScore > 0) reasons.push(`Both use ${repoA.language ?? "similar"} language(s)`);
  if (topicScore > 0.3) reasons.push(`${intersection.size} shared topic(s): ${Array.from(intersection).slice(0, 3).join(", ")}`);
  if (commitScore > 0.7) reasons.push("Similar commit activity levels");
  if (contributorScore > 0.7) reasons.push("Similar team sizes");
  if (reasons.length === 0) reasons.push("Limited similarity detected based on available metadata");

  return {
    repositoryIdA: "",
    repositoryIdB: "",
    overallScore,
    sharedConcepts,
    uniqueToA,
    uniqueToB,
    reasoning: reasons.join(". ") + ".",
    breakdown: { language: languageScore, topic: topicScore, commitPattern: commitScore, contributor: contributorScore },
  };
}

function areSimilarLanguages(a: string, b: string): boolean {
  const groups: Record<string, string[]> = {
    "ts-js": ["TypeScript", "JavaScript"],
    "c-family": ["C", "C++", "C#"],
    "ml-family": ["Python", "Ruby"],
    "jvm": ["Java", "Kotlin", "Scala"],
  };
  for (const group of Object.values(groups)) {
    if (group.includes(a) && group.includes(b)) return true;
  }
  return false;
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// ================================================================
// Contributor Comparison
// ================================================================

export async function compareContributors(
  userId: string,
  repoIdA: string,
  repoIdB: string
): Promise<ContributorComparison> {
  const [statsA, statsB] = await Promise.all([
    getRepoEvolutionStats(repoIdA, userId),
    getRepoEvolutionStats(repoIdB, userId),
  ]);

  const mapA = new Map(statsA.contributors.map((c) => [c.login || c.name, { ...c }]));
  const mapB = new Map(statsB.contributors.map((c) => [c.login || c.name, { ...c }]));

  const shared: ContributorComparison["sharedContributors"] = [];
  const uniqueToA: ContributorComparison["uniqueToA"] = [];
  const uniqueToB: ContributorComparison["uniqueToB"] = [];

  for (const [key, cA] of mapA) {
    const cB = mapB.get(key);
    if (cB) {
      shared.push({ login: cA.login || key, name: cA.name, commitsA: cA.count, commitsB: cB.count });
    } else {
      uniqueToA.push({ login: cA.login || key, name: cA.name, commits: cA.count });
    }
  }

  for (const [key, cB] of mapB) {
    if (!mapA.has(key)) {
      uniqueToB.push({ login: cB.login || key, name: cB.name, commits: cB.count });
    }
  }

  // Activity comparison for shared contributors
  const activityComparison = shared.slice(0, 10).map((s) => {
    const totalA = statsA.totalCommits || 1;
    const totalB = statsB.totalCommits || 1;
    return {
      name: s.name || s.login,
      avgCommitsA: Math.round((s.commitsA / totalA) * 10000) / 100,
      avgCommitsB: Math.round((s.commitsB / totalB) * 10000) / 100,
    };
  });

  return {
    totalContributorsA: statsA.activeContributors,
    totalContributorsB: statsB.activeContributors,
    sharedContributors: shared,
    uniqueToA: uniqueToA.sort((a, b) => b.commits - a.commits),
    uniqueToB: uniqueToB.sort((a, b) => b.commits - a.commits),
    activityComparison,
  };
}

// ================================================================
// Cross-Repository Search
// ================================================================

export async function searchAcrossRepos(
  userId: string,
  params: CrossRepoSearchParams
): Promise<CrossRepoSearchResult[]> {
  const supabase = await createClient();

  // Get repos to search
  let repoIds = params.repositoryIds;
  if (!repoIds || repoIds.length === 0) {
    const repos = await getUserRepositories(userId);
    repoIds = repos.map((r) => r.id);
  }

  if (repoIds.length === 0) return [];

  let query = supabase
    .from("commits")
    .select("id, repository_id, sha, message, author_name, author_login, committed_date, additions, deletions, files_changed, repositories!inner(name)")
    .eq("user_id", userId)
    .in("repository_id", repoIds);

  // Text search
  if (params.query) {
    const term = `%${params.query}%`;
    query = query.or(`message.ilike.${term},sha.ilike.${term},author_name.ilike.${term}`);
  }

  // Date filters
  if (params.since) query = query.gte("committed_date", params.since);
  if (params.until) query = query.lte("committed_date", params.until);

  // Language filter (via repo)
  if (params.language) {
    const repos = await getUserRepositories(userId);
    const langRepos = repos.filter((r) => r.language === params.language).map((r) => r.id);
    if (langRepos.length > 0) {
      query = query.in("repository_id", langRepos);
    }
  }

  // Owner filter
  if (params.owner) {
    const repos = await getUserRepositories(userId);
    const ownerRepos = repos.filter((r) => r.owner_login === params.owner).map((r) => r.id);
    if (ownerRepos.length > 0) {
      query = query.in("repository_id", ownerRepos);
    }
  }

  query = query
    .order("committed_date", { ascending: false })
    .limit(params.limit ?? 50);

  const { data, error } = await query;
  if (error || !data) return [];

  return data.map((row: Record<string, unknown>) => {
    const repo = row.repositories as { name: string } | null;
    return {
      repositoryId: row.repository_id as string,
      repositoryName: repo?.name ?? "Unknown",
      commitId: row.id as string,
      sha: (row.sha as string).slice(0, 7),
      message: (row.message as string) || "",
      authorName: row.author_name as string,
      committedDate: row.committed_date as string,
      additions: (row.additions as number) ?? 0,
      deletions: (row.deletions as number) ?? 0,
      filesChanged: (row.files_changed as number) ?? 0,
      similarity: null, // no embedding-based similarity for text search
    };
  });
}

// ================================================================
// AI-Powered Cross-Repo Analysis
// ================================================================

export async function generateAIAnalysis(
  metrics: RepoMetrics[],
  techStacks: TechStack[],
  similarity: SimilarityScore | null,
  contributorComp: ContributorComparison | null,
  techComp: TechComparison | null
): Promise<CrossRepoAIAnalysis> {
  const repoCount = metrics.length;
  if (repoCount < 2) {
    throw new Error("At least 2 repositories are required for AI analysis");
  }

  const repoDescriptions = metrics.map((m) =>
    `### ${m.repositoryName}\n- Language: ${m.language ?? "Unknown"}\n- Total Commits: ${m.totalCommits}\n- Contributors: ${m.activeContributors}\n- Avg Commit Size: ${m.avgCommitSize} lines\n- Commits/Week: ${m.commitsPerWeek}\n- Top Contributors: ${m.topContributors.slice(0, 5).map((c) => `${c.name} (${c.percentage}%)`).join(", ")}`
  ).join("\n\n");

  const techDescription = techStacks.map((t) =>
    `### ${t.repositoryName}\n- Languages: ${t.languages.map((l) => l.name).join(", ") || "Unknown"}\n- Frameworks: ${t.frameworks.join(", ") || "None detected"}\n- Databases: ${t.databases.join(", ") || "None detected"}\n- Build: ${t.buildTools.join(", ") || "None detected"}\n- Deployment: ${t.deploymentTools.join(", ") || "None detected"}`
  ).join("\n\n");

  const prompt = `You are a senior software architect analyzing ${repoCount} repositories for comparison. Provide a thorough, grounded analysis.

## Repository Data

${repoDescriptions}

## Technology Stacks

${techDescription}

${similarity ? `## Similarity Analysis\n- Overall Score: ${(similarity.overallScore * 100).toFixed(1)}%\n- Language Similarity: ${(similarity.breakdown.language * 100).toFixed(0)}%\n- Topic Overlap: ${(similarity.breakdown.topic * 100).toFixed(0)}%\n- Commit Pattern: ${(similarity.breakdown.commitPattern * 100).toFixed(0)}%\n- Contributor: ${(similarity.breakdown.contributor * 100).toFixed(0)}%\n- Shared Concepts: ${similarity.sharedConcepts.join(", ") || "None"}\n- Unique to Repo 1: ${similarity.uniqueToA.join(", ") || "None"}\n- Unique to Repo 2: ${similarity.uniqueToB.join(", ") || "None"}\n- Reasoning: ${similarity.reasoning}` : ""}

${contributorComp ? `## Contributor Analysis\n- Repo 1: ${contributorComp.totalContributorsA} contributors\n- Repo 2: ${contributorComp.totalContributorsB} contributors\n- Shared Contributors: ${contributorComp.sharedContributors.length}\n- Unique to Repo 1: ${contributorComp.uniqueToA.length}\n- Unique to Repo 2: ${contributorComp.uniqueToB.length}` : ""}

${techComp ? `## Technology Comparison\n- Shared Technologies (${techComp.shared.length}): ${techComp.shared.join(", ") || "None"}\n- Only in Repo 1 (${techComp.onlyInA.length}): ${techComp.onlyInA.join(", ") || "None"}\n- Only in Repo 2 (${techComp.onlyInB.length}): ${techComp.onlyInB.join(", ") || "None"}` : ""}

Respond with a JSON object (no markdown, no code fences, just raw JSON) with this exact structure:
{
  "executiveSummary": "2-3 sentence overview of how these repositories compare",
  "architecturalComparison": "Detailed comparison of the architectural approaches, patterns, and design decisions across repositories",
  "sharedPatterns": ["pattern 1", "pattern 2", "..."],
  "keyDifferences": ["difference 1", "difference 2", "..."],
  "bestPractices": ["practice 1", "practice 2", "..."],
  "recommendations": ["recommendation 1 with specific actionable detail", "recommendation 2", "..."],
  "similarityExplanation": "Explanation of why these repositories are or aren't similar, grounded in the data above",
  "technologyInsights": "Analysis of the technology choices and their implications",
  "contributorInsights": "Analysis of team composition, contribution patterns, and collaboration dynamics"
}`;

  const messages: LLMMessage[] = [
    { role: "system", content: "You are a senior software architect. Respond only with valid JSON matching the requested schema. Be specific, grounded in the provided data, and actionable." },
    { role: "user", content: prompt },
  ];

  const response = await llmService.generate(messages, {
    temperature: 0.4,
    maxTokens: 4096,
  });

  try {
    const cleaned = response.content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    const parsed = JSON.parse(cleaned) as CrossRepoAIAnalysis;
    return parsed;
  } catch {
    return {
      executiveSummary: response.content.slice(0, 500),
      architecturalComparison: "",
      sharedPatterns: [],
      keyDifferences: [],
      bestPractices: [],
      recommendations: [],
      similarityExplanation: "",
      technologyInsights: "",
      contributorInsights: "",
    };
  }
}

// ================================================================
// Cross-Repo RAG (multi-repository retrieval + LLM)
// ================================================================

export async function crossRepoRAG(
  userId: string,
  repositoryIds: string[],
  query: string,
  queryEmbedding?: number[]
): Promise<{ answer: string; sources: { repository: string; sha: string; message: string }[] }> {
  const supabase = await createClient();

  // Retrieve commits from all selected repos
  const allCommits: { repoName: string; sha: string; message: string; author: string; date: string; additions: number; deletions: number; files: number }[] = [];

  for (const repoId of repositoryIds) {
    let results: Record<string, unknown>[] = [];

    if (queryEmbedding) {
      // Try vector search
      const { data, error } = await supabase.rpc("semantic_search_commits", {
        p_user_id: userId,
        p_query_embedding: queryEmbedding,
        p_limit: 5,
        p_repository_id: repoId,
        p_min_similarity: 0.3,
      });
      if (!error && data) {
        results = data as Record<string, unknown>[];
      }
    }

    // Fallback to text search if no results
    if (results.length === 0) {
      const term = `%${query}%`;
      const { data, error } = await supabase
        .from("commits")
        .select("sha, message, author_name, committed_date, additions, deletions, files_changed, repositories!inner(name)")
        .eq("user_id", userId)
        .eq("repository_id", repoId)
        .or(`message.ilike.${term}`)
        .order("committed_date", { ascending: false })
        .limit(5);

      if (!error && data) results = data as Record<string, unknown>[];
    }

    // Get repo name
    const { data: repo } = await supabase
      .from("repositories")
      .select("name")
      .eq("id", repoId)
      .single();

    for (const r of results) {
      const innerRepo = r.repositories as { name: string } | null;
      allCommits.push({
        repoName: innerRepo?.name ?? repo?.name ?? "Unknown",
        sha: (r.sha as string).slice(0, 7),
        message: (r.message as string) || "",
        author: r.author_name as string,
        date: (r.committed_date as string)?.slice(0, 10) ?? "",
        additions: (r.additions as number) ?? 0,
        deletions: (r.deletions as number) ?? 0,
        files: (r.files_changed as number) ?? 0,
      });
    }
  }

  if (allCommits.length === 0) {
    return {
      answer: "No relevant commits found across the selected repositories. Try broadening your search query or selecting different repositories.",
      sources: [],
    };
  }

  // Build context with repository citations
  const contextBlock = allCommits.map((c) =>
    `[${c.repoName} | ${c.sha}] ${c.message}\n  Author: ${c.author} | Date: ${c.date} | +${c.additions} -${c.deletions} | Files: ${c.files}`
  ).join("\n---\n");

  const messages: LLMMessage[] = [
    {
      role: "system",
      content: `You are a code intelligence assistant analyzing commits across multiple repositories. When referencing information, always cite which repository it comes from using the format [RepositoryName]. Be specific and grounded in the provided context.`,
    },
    {
      role: "user",
      content: `Question: ${query}\n\nRelevant commits from multiple repositories:\n${contextBlock}`,
    },
  ];

  const response = await llmService.generate(messages, {
    temperature: 0.4,
    maxTokens: 2048,
  });

  const sources = allCommits.map((c) => ({
    repository: c.repoName,
    sha: c.sha,
    message: c.message.slice(0, 120),
  }));

  return { answer: response.content, sources };
}

// ================================================================
// Report Generation & Export
// ================================================================

export function generateReportMarkdown(
  metrics: RepoMetrics[],
  techStacks: TechStack[],
  similarity: SimilarityScore | null,
  contributorComp: ContributorComparison | null,
  techComp: TechComparison | null,
  ai: CrossRepoAIAnalysis | null
): string {
  const lines: string[] = [];

  lines.push("# Cross-Repository Intelligence Report");
  lines.push(`\n**Generated:** ${new Date().toLocaleString()}`);
  lines.push(`**Repositories:** ${metrics.map((m) => m.repositoryName).join(", ")}\n`);

  if (ai?.executiveSummary) {
    lines.push("## Executive Summary\n");
    lines.push(ai.executiveSummary + "\n");
  }

  // Metrics comparison
  lines.push("## Repository Metrics\n");
  lines.push("| Metric | " + metrics.map((m) => m.repositoryName).join(" | ") + " |");
  lines.push("|--------|" + metrics.map(() => "--------|").join(""));
  const metricRows = [
    ["Language", ...metrics.map((m) => m.language ?? "N/A")],
    ["Total Commits", ...metrics.map((m) => String(m.totalCommits))],
    ["Contributors", ...metrics.map((m) => String(m.activeContributors))],
    ["Avg Commit Size", ...metrics.map((m) => `${m.avgCommitSize} lines`)],
    ["Commits/Week", ...metrics.map((m) => String(m.commitsPerWeek))],
    ["Total Additions", ...metrics.map((m) => formatNum(m.totalAdditions))],
    ["Total Deletions", ...metrics.map((m) => formatNum(m.totalDeletions))],
  ];
  for (const row of metricRows) {
    lines.push("| " + row.join(" | ") + " |");
  }

  // Technology comparison
  if (techComp) {
    lines.push("\n## Technology Stack Comparison\n");
    lines.push(`- **Shared** (${techComp.shared.length}): ${techComp.shared.join(", ") || "None"}`);
    lines.push(`- **Only in ${metrics[0]?.repositoryName ?? "Repo A"}** (${techComp.onlyInA.length}): ${techComp.onlyInA.join(", ") || "None"}`);
    if (metrics.length > 1) {
      lines.push(`- **Only in ${metrics[1]?.repositoryName ?? "Repo B"}** (${techComp.onlyInB.length}): ${techComp.onlyInB.join(", ") || "None"}`);
    }
  }

  // Similarity
  if (similarity) {
    lines.push("\n## Similarity Analysis\n");
    lines.push(`- **Overall Score:** ${(similarity.overallScore * 100).toFixed(1)}%`);
    lines.push(`- **Language:** ${(similarity.breakdown.language * 100).toFixed(0)}%`);
    lines.push(`- **Topics:** ${(similarity.breakdown.topic * 100).toFixed(0)}%`);
    lines.push(`- **Commit Patterns:** ${(similarity.breakdown.commitPattern * 100).toFixed(0)}%`);
    lines.push(`- **Contributors:** ${(similarity.breakdown.contributor * 100).toFixed(0)}%`);
    lines.push(`- **Reasoning:** ${similarity.reasoning}`);
    lines.push(`- **Shared Concepts:** ${similarity.sharedConcepts.join(", ") || "None"}`);
  }

  // Contributors
  if (contributorComp) {
    lines.push("\n## Contributor Analysis\n");
    lines.push(`- **${metrics[0]?.repositoryName ?? "Repo A"}:** ${contributorComp.totalContributorsA} contributors`);
    lines.push(`- **${metrics[1]?.repositoryName ?? "Repo B"}:** ${contributorComp.totalContributorsB} contributors`);
    lines.push(`- **Shared:** ${contributorComp.sharedContributors.length} contributor(s)`);
    if (contributorComp.sharedContributors.length > 0) {
      lines.push("\n| Contributor | Commits in " + (metrics[0]?.repositoryName ?? "A") + " | Commits in " + (metrics[1]?.repositoryName ?? "B") + " |");
      lines.push("|-------------|" + metrics.map(() => "----------------|").join(""));
      for (const c of contributorComp.sharedContributors.slice(0, 10)) {
        lines.push(`| ${c.name || c.login} | ${c.commitsA} | ${c.commitsB} |`);
      }
    }
  }

  // AI Analysis
  if (ai) {
    if (ai.architecturalComparison) {
      lines.push("\n## Architectural Comparison\n");
      lines.push(ai.architecturalComparison);
    }
    if (ai.technologyInsights) {
      lines.push("\n## Technology Insights\n");
      lines.push(ai.technologyInsights);
    }
    if (ai.contributorInsights) {
      lines.push("\n## Contributor Insights\n");
      lines.push(ai.contributorInsights);
    }
    if (ai.similarityExplanation) {
      lines.push("\n## Similarity Explanation\n");
      lines.push(ai.similarityExplanation);
    }
    if (ai.sharedPatterns.length > 0) {
      lines.push("\n## Shared Patterns\n");
      for (const p of ai.sharedPatterns) lines.push(`- ${p}`);
    }
    if (ai.keyDifferences.length > 0) {
      lines.push("\n## Key Differences\n");
      for (const d of ai.keyDifferences) lines.push(`- ${d}`);
    }
    if (ai.bestPractices.length > 0) {
      lines.push("\n## Best Practices\n");
      for (const b of ai.bestPractices) lines.push(`- ${b}`);
    }
    if (ai.recommendations.length > 0) {
      lines.push("\n## Recommendations\n");
      for (const r of ai.recommendations) lines.push(`- ${r}`);
    }
  }

  return lines.join("\n");
}

export function generateReportText(markdown: string): string {
  return markdown
    .replace(/^#{1,6}\s/gm, "")
    .replace(/\*\*/g, "")
    .replace(/\|/g, "  ")
    .replace(/^-{3,}$/gm, "")
    .replace(/^>\s/gm, "  NOTE: ")
    .replace(/\n{3,}/g, "\n\n");
}

function formatNum(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "K";
  return n.toLocaleString();
}