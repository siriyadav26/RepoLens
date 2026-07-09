// ================================================================
// Metrics Engine — Deterministic health score calculations
// ================================================================

import { createClient } from "@/lib/supabase/server";
import type {
  HealthScores,
  HealthMetrics,
  Hotspot,
  DirectoryActivity,
  CommitPattern,
  ContributorActivity,
} from "./types";

interface CommitRow {
  sha: string;
  message: string | null;
  author_name: string;
  author_login: string | null;
  committed_date: string;
  additions: number;
  deletions: number;
  files_changed: number;
  branch: string;
}

export async function computeMetrics(
  repositoryId: string,
  userId: string
): Promise<HealthMetrics> {
  const supabase = await createClient();

  const { data: commits, error } = await supabase
    .from("commits")
    .select("sha, message, author_name, author_login, committed_date, additions, deletions, files_changed, branch")
    .eq("user_id", userId)
    .eq("repository_id", repositoryId)
    .order("committed_date", { ascending: false });

  if (error || !commits || commits.length === 0) {
    return emptyMetrics();
  }

  const totalCommits = commits.length;
  const totalAdditions = commits.reduce((s, c) => s + (c.additions ?? 0), 0);
  const totalDeletions = commits.reduce((s, c) => s + (c.deletions ?? 0), 0);
  const avgCommitSize = Math.round((totalAdditions + totalDeletions) / totalCommits);
  const largeCommitThreshold = avgCommitSize * 3;
  const largeCommits = commits.filter(
    (c) => (c.additions ?? 0) + (c.deletions ?? 0) > largeCommitThreshold
  );
  const largeCommitCount = largeCommits.length;
  const largeCommitPercentage = Math.round((largeCommitCount / totalCommits) * 100);

  const dates = commits.map((c) => new Date(c.committed_date).getTime());
  const newest = Math.max(...dates);
  const oldest = Math.min(...dates);
  const timeSpanDays = Math.max(1, Math.round((newest - oldest) / (1000 * 60 * 60 * 24)));
  const commitsPerWeek = Math.round((totalCommits / timeSpanDays) * 7 * 10) / 10;

  // Hotspots — aggregate by inferring "files" from commit messages and files_changed
  const hotspots = computeHotspots(commits);
  const directoryActivity = computeDirectoryActivity(commits);
  const commitPatterns = computeCommitPatterns(commits);
  const contributorActivity = computeContributorActivity(commits);

  const uniqueContributors = new Set(
    commits.map((c) => c.author_login || c.author_name).filter(Boolean)
  ).size;

  const uniqueFiles = new Set(hotspots.map((h) => h.path)).size;

  const scores = computeScores({
    totalCommits,
    timeSpanDays,
    avgCommitSize,
    largeCommitPercentage,
    commitsPerWeek,
    uniqueContributors,
    uniqueFiles,
    hotspots,
    commitPatterns,
  });

  return {
    scores,
    hotspots,
    directoryActivity,
    commitPatterns,
    contributorActivity,
    totalCommits,
    totalFiles: uniqueFiles,
    avgCommitSize,
    largeCommitCount,
    largeCommitPercentage,
    timeSpanDays,
    commitsPerWeek,
    uniqueFiles,
    uniqueContributors,
  };
}

function computeScores(ctx: {
  totalCommits: number;
  timeSpanDays: number;
  avgCommitSize: number;
  largeCommitPercentage: number;
  commitsPerWeek: number;
  uniqueContributors: number;
  uniqueFiles: number;
  hotspots: Hotspot[];
  commitPatterns: CommitPattern[];
}): HealthScores {
  // Technical Debt (lower = more debt, 0-100, higher = healthier = less debt)
  const debtFromLargeCommits = Math.max(0, 100 - ctx.largeCommitPercentage * 3);
  const debtFromHotspots = ctx.hotspots.length > 0
    ? Math.max(0, 100 - (ctx.hotspots[0]?.changeCount ?? 0) * 2)
    : 80;
  const debtFromSize = Math.max(0, 100 - ctx.avgCommitSize * 0.5);
  const technicalDebt = Math.round(
    debtFromLargeCommits * 0.4 + debtFromHotspots * 0.35 + debtFromSize * 0.25
  );

  // Maintainability (higher = more maintainable)
  const maintFromContributors = Math.min(100, ctx.uniqueContributors * 15);
  const maintFromCommitFreq = ctx.commitsPerWeek > 2 ? 90 : ctx.commitsPerWeek > 0.5 ? 70 : 40;
  const maintFromCommitSize = Math.max(0, 100 - ctx.avgCommitSize * 0.8);
  const maintainability = Math.round(
    maintFromContributors * 0.3 + maintFromCommitFreq * 0.4 + maintFromCommitSize * 0.3
  );

  // Risk (lower = less risky, higher = more risky, 0-100)
  const riskFromConcentration = ctx.uniqueContributors <= 1 ? 80 : ctx.uniqueContributors <= 2 ? 50 : 20;
  const riskFromLargeCommits = Math.min(100, ctx.largeCommitPercentage * 4);
  const riskFromHotspot = ctx.hotspots.length > 0 && ctx.hotspots[0].changeCount > 20 ? 70 : 30;
  const risk = Math.round(
    riskFromConcentration * 0.4 + riskFromLargeCommits * 0.35 + riskFromHotspot * 0.25
  );

  // Stability (higher = more stable)
  const stabFromFreq = ctx.commitsPerWeek > 1 ? 80 : ctx.commitsPerWeek > 0.3 ? 60 : 35;
  const stabFromSize = Math.max(0, 100 - ctx.largeCommitPercentage * 3);
  const stabFromTrend = computeStabilityTrend(ctx.commitPatterns);
  const stability = Math.round(
    stabFromFreq * 0.35 + stabFromSize * 0.35 + stabFromTrend * 0.3
  );

  // Documentation (heuristic based on repo data — will be enriched by AI)
  const docScore = 50; // baseline, AI will adjust

  // Overall: weighted average
  const overall = Math.round(
    technicalDebt * 0.25 +
    maintainability * 0.25 +
    (100 - risk) * 0.2 +
    stability * 0.15 +
    docScore * 0.15
  );

  return { overall, technicalDebt, maintainability, risk, stability, documentation: docScore };
}

function computeStabilityTrend(patterns: CommitPattern[]): number {
  if (patterns.length < 4) return 50;
  const recent = patterns.slice(0, Math.min(4, patterns.length));
  const older = patterns.slice(Math.min(4, patterns.length), 8);
  if (older.length === 0) return 60;

  const recentAvg = recent.reduce((s, p) => s + p.count, 0) / recent.length;
  const olderAvg = older.reduce((s, p) => s + p.count, 0) / older.length;

  if (olderAvg === 0) return 70;
  const ratio = recentAvg / olderAvg;
  if (ratio > 0.8 && ratio < 1.2) return 85; // consistent
  if (ratio > 1.5) return 40; // sudden spike
  if (ratio < 0.3) return 45; // dying
  return 65;
}

function computeHotspots(commits: CommitRow[]): Hotspot[] {
  // Since we don't have file-level data from GitHub API (only files_changed count),
  // we create path-based hotspots from commit message patterns and branch data
  const pathMap = new Map<string, {
    changeCount: number;
    totalAdditions: number;
    totalDeletions: number;
    lastModified: string;
    contributors: Set<string>;
    totalSize: number;
  }>();

  for (const c of commits) {
    const key = c.branch || "main";
    const existing = pathMap.get(key) || {
      changeCount: 0,
      totalAdditions: 0,
      totalDeletions: 0,
      lastModified: "",
      contributors: new Set<string>(),
      totalSize: 0,
    };
    existing.changeCount++;
    existing.totalAdditions += c.additions ?? 0;
    existing.totalDeletions += c.deletions ?? 0;
    if (!existing.lastModified || c.committed_date > existing.lastModified) {
      existing.lastModified = c.committed_date;
    }
    existing.contributors.add(c.author_login || c.author_name);
    existing.totalSize += (c.additions ?? 0) + (c.deletions ?? 0);
    pathMap.set(key, existing);
  }

  return Array.from(pathMap.entries())
    .map(([path, data]) => ({
      path,
      changeCount: data.changeCount,
      totalAdditions: data.totalAdditions,
      totalDeletions: data.totalDeletions,
      lastModified: data.lastModified,
      contributors: data.contributors.size,
      avgSize: Math.round(data.totalSize / data.changeCount),
    }))
    .sort((a, b) => b.changeCount - a.changeCount)
    .slice(0, 15);
}

function computeDirectoryActivity(commits: CommitRow[]): DirectoryActivity[] {
  const dirMap = new Map<string, {
    changeCount: number;
    totalAdditions: number;
    totalDeletions: number;
    files: Set<string>;
  }>();

  for (const c of commits) {
    const key = c.branch || "main";
    const existing = dirMap.get(key) || {
      changeCount: 0,
      totalAdditions: 0,
      totalDeletions: 0,
      files: new Set<string>(),
    };
    existing.changeCount++;
    existing.totalAdditions += c.additions ?? 0;
    existing.totalDeletions += c.deletions ?? 0;
    existing.files.add(c.sha);
    dirMap.set(key, existing);
  }

  return Array.from(dirMap.entries())
    .map(([path, data]) => ({
      path,
      changeCount: data.changeCount,
      totalAdditions: data.totalAdditions,
      totalDeletions: data.totalDeletions,
      fileCount: data.files.size,
    }))
    .sort((a, b) => b.changeCount - a.changeCount);
}

function computeCommitPatterns(commits: CommitRow[]): CommitPattern[] {
  const weekMap = new Map<string, { count: number; totalSize: number; largeCommits: number }>();

  for (const c of commits) {
    const d = new Date(c.committed_date);
    const weekStart = new Date(d);
    weekStart.setDate(d.getDate() - d.getDay());
    const key = weekStart.toISOString().slice(0, 10);

    const existing = weekMap.get(key) || { count: 0, totalSize: 0, largeCommits: 0 };
    existing.count++;
    const size = (c.additions ?? 0) + (c.deletions ?? 0);
    existing.totalSize += size;
    if (size > 200) existing.largeCommits++;
    weekMap.set(key, existing);
  }

  return Array.from(weekMap.entries())
    .map(([week, data]) => ({
      week,
      count: data.count,
      avgSize: Math.round(data.totalSize / data.count),
      largeCommits: data.largeCommits,
    }))
    .sort((a, b) => b.week.localeCompare(a.week));
}

function computeContributorActivity(commits: CommitRow[]): ContributorActivity[] {
  const authorMap = new Map<string, {
    name: string;
    login: string | null;
    count: number;
    firstSeen: string;
    lastSeen: string;
  }>();

  for (const c of commits) {
    const key = c.author_login || c.author_name;
    const existing = authorMap.get(key);
    if (existing) {
      existing.count++;
      if (c.committed_date > existing.lastSeen) existing.lastSeen = c.committed_date;
      if (c.committed_date < existing.firstSeen) existing.firstSeen = c.committed_date;
    } else {
      authorMap.set(key, {
        name: c.author_name,
        login: c.author_login,
        count: 1,
        firstSeen: c.committed_date,
        lastSeen: c.committed_date,
      });
    }
  }

  const total = commits.length;
  return Array.from(authorMap.values())
    .map((a) => ({
      login: a.login || a.name,
      name: a.name,
      commitCount: a.count,
      percentage: Math.round((a.count / total) * 1000) / 10,
      firstSeen: a.firstSeen,
      lastSeen: a.lastSeen,
    }))
    .sort((a, b) => b.commitCount - a.commitCount);
}

function emptyMetrics(): HealthMetrics {
  const emptyScores: HealthScores = {
    overall: 0, technicalDebt: 0, maintainability: 0,
    risk: 0, stability: 0, documentation: 0,
  };
  return {
    scores: emptyScores,
    hotspots: [],
    directoryActivity: [],
    commitPatterns: [],
    contributorActivity: [],
    totalCommits: 0,
    totalFiles: 0,
    avgCommitSize: 0,
    largeCommitCount: 0,
    largeCommitPercentage: 0,
    timeSpanDays: 0,
    commitsPerWeek: 0,
    uniqueFiles: 0,
    uniqueContributors: 0,
  };
}