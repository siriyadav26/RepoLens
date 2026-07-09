// ================================================================
// Supabase Commits CRUD — Phase 3
// ================================================================

import { createClient } from "@/lib/supabase/server";
import type { GitHubCommit } from "@/lib/github";

export interface DbCommit {
  id: string;
  user_id: string;
  repository_id: string;
  sha: string;
  message: string | null;
  author_name: string;
  author_login: string | null;
  author_avatar: string | null;
  author_date: string;
  committed_date: string;
  commit_url: string | null;
  branch: string;
  parent_shas: string[];
  additions: number;
  deletions: number;
  files_changed: number;
  created_at: string;
  updated_at: string;
}

export interface CommitsFilter {
  page?: number;
  perPage?: number;
  sort?: "newest" | "oldest";
  author?: string;
  since?: string;
  until?: string;
  search?: string;
}

export interface CommitsResult {
  commits: DbCommit[];
  total: number;
  page: number;
  perPage: number;
  hasMore: boolean;
}

/** Convert a GitHub commit to a DB row */
export function githubCommitToDbRow(
  commit: GitHubCommit,
  userId: string,
  repositoryId: string,
  branch: string
): Omit<DbCommit, "id" | "user_id" | "created_at" | "updated_at"> {
  return {
    repository_id: repositoryId,
    sha: commit.sha,
    message: commit.commit.message,
    author_name: commit.commit.author.name,
    author_login: commit.author?.login ?? null,
    author_avatar: commit.author?.avatar_url ?? null,
    author_date: commit.commit.author.date,
    committed_date: commit.commit.committer.date,
    commit_url: commit.html_url,
    branch,
    parent_shas: commit.parents.map((p) => p.sha),
    additions: commit.stats?.additions ?? 0,
    deletions: commit.stats?.deletions ?? 0,
    files_changed: commit.files?.length ?? commit.stats?.total ?? 0,
  };
}

/** Save commits to the database (batch upsert) */
export async function saveCommits(
  commits: Omit<DbCommit, "id" | "user_id" | "created_at" | "updated_at">[],
  userId: string
): Promise<number> {
  const supabase = await createClient();

  if (commits.length === 0) return 0;

  const rows = commits.map((c) => ({
    user_id: userId,
    ...c,
  }));

  const { error } = await supabase
    .from("commits")
    .upsert(rows, { onConflict: "repository_id,sha" });

  if (error) {
    if (error.code === "42P01") {
      throw new Error("COMMIT_TABLE_MISSING");
    }
    throw new Error(`Failed to save commits: ${error.message}`);
  }

  return commits.length;
}

/** Get commits for a repository with filtering, sorting, and pagination */
export async function getCommitsByRepoId(
  repositoryId: string,
  userId: string,
  filter: CommitsFilter = {}
): Promise<CommitsResult> {
  const supabase = await createClient();
  const page = filter.page ?? 1;
  const perPage = filter.perPage ?? 20;
  const from = (page - 1) * perPage;
  const to = from + perPage - 1;

  let query = supabase
    .from("commits")
    .select("*", { count: "exact" })
    .eq("user_id", userId)
    .eq("repository_id", repositoryId);

  // Search by message, SHA, or author
  if (filter.search) {
    const term = `%${filter.search}%`;
    query = query.or(
      `message.ilike.${term},sha.ilike.${term},author_name.ilike.${term},author_login.ilike.${term}`
    );
  }

  // Filter by author
  if (filter.author) {
    query = query.eq("author_login", filter.author);
  }

  // Filter by date range
  if (filter.since) {
    query = query.gte("committed_date", filter.since);
  }
  if (filter.until) {
    query = query.lte("committed_date", filter.until);
  }

  // Sort
  if (filter.sort === "oldest") {
    query = query.order("committed_date", { ascending: true });
  } else {
    query = query.order("committed_date", { ascending: false });
  }

  // Paginate
  query = query.range(from, to);

  const { data, error, count } = await query;

  if (error) {
    if (error.code === "42P01") return { commits: [], total: 0, page, perPage, hasMore: false };
    throw new Error(`Failed to fetch commits: ${error.message}`);
  }

  const commits = (data ?? []) as DbCommit[];
  const total = count ?? 0;

  return {
    commits,
    total,
    page,
    perPage,
    hasMore: from + perPage < total,
  };
}

/** Get a single commit by its database ID */
export async function getCommitById(
  commitId: string,
  userId: string
): Promise<DbCommit | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("commits")
    .select("*")
    .eq("id", commitId)
    .eq("user_id", userId)
    .single();

  if (error) {
    if (error.code === "PGRST116") return null;
    throw new Error(`Failed to fetch commit: ${error.message}`);
  }

  return data as DbCommit;
}

/** Get evolution statistics for a repository */
export async function getRepoEvolutionStats(
  repositoryId: string,
  userId: string
): Promise<{
  totalCommits: number;
  activeContributors: number;
  contributors: { login: string; name: string; avatar: string | null; count: number }[];
  commitsPerMonth: { month: string; count: number }[];
  commitsPerWeek: { week: string; count: number }[];
  firstCommitDate: string | null;
  latestCommitDate: string | null;
  totalAdditions: number;
  totalDeletions: number;
}> {
  const supabase = await createClient();

  // Basic stats
  const { data: commitData, error } = await supabase
    .from("commits")
    .select("author_login, author_name, author_avatar, committed_date, additions, deletions")
    .eq("user_id", userId)
    .eq("repository_id", repositoryId)
    .order("committed_date", { ascending: false });

  if (error) {
    if (error.code === "42P01") {
      return {
        totalCommits: 0, activeContributors: 0, contributors: [],
        commitsPerMonth: [], commitsPerWeek: [],
        firstCommitDate: null, latestCommitDate: null,
        totalAdditions: 0, totalDeletions: 0,
      };
    }
    throw new Error(`Failed to fetch evolution stats: ${error.message}`);
  }

  if (!commitData || commitData.length === 0) {
    return {
      totalCommits: 0, activeContributors: 0, contributors: [],
      commitsPerMonth: [], commitsPerWeek: [],
      firstCommitDate: null, latestCommitDate: null,
      totalAdditions: 0, totalDeletions: 0,
    };
  }

  const totalCommits = commitData.length;
  const totalAdditions = commitData.reduce((s, c) => s + (c.additions ?? 0), 0);
  const totalDeletions = commitData.reduce((s, c) => s + (c.deletions ?? 0), 0);

  // Contributors
  const authorMap = new Map<string, { login: string; name: string; avatar: string | null; count: number }>();
  for (const c of commitData) {
    const key = c.author_login || c.author_name;
    const existing = authorMap.get(key);
    if (existing) {
      existing.count++;
    } else {
      authorMap.set(key, {
        login: c.author_login || "",
        name: c.author_name,
        avatar: c.author_avatar,
        count: 1,
      });
    }
  }
  const contributors = Array.from(authorMap.values()).sort((a, b) => b.count - a.count);

  // Commits per month (last 12 months)
  const monthMap = new Map<string, number>();
  for (const c of commitData) {
    const month = c.committed_date.slice(0, 7); // "2024-01"
    monthMap.set(month, (monthMap.get(month) || 0) + 1);
  }
  const commitsPerMonth = Array.from(monthMap.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .slice(-12)
    .map(([month, count]) => ({ month, count }));

  // Commits per week (last 8 weeks)
  const weekMap = new Map<string, number>();
  for (const c of commitData) {
    const d = new Date(c.committed_date);
    const weekStart = new Date(d);
    weekStart.setDate(d.getDate() - d.getDay());
    const week = weekStart.toISOString().slice(0, 10);
    weekMap.set(week, (weekMap.get(week) || 0) + 1);
  }
  const commitsPerWeek = Array.from(weekMap.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .slice(-8)
    .map(([week, count]) => ({ week, count }));

  return {
    totalCommits,
    activeContributors: contributors.length,
    contributors,
    commitsPerMonth,
    commitsPerWeek,
    firstCommitDate: commitData[commitData.length - 1].committed_date,
    latestCommitDate: commitData[0].committed_date,
    totalAdditions,
    totalDeletions,
  };
}

/** Get distinct authors for a repository (for filter dropdown) */
export async function getCommitAuthors(
  repositoryId: string,
  userId: string
): Promise<{ login: string; name: string }[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("commits")
    .select("author_login, author_name")
    .eq("user_id", userId)
    .eq("repository_id", repositoryId);

  if (error) {
    if (error.code === "42P01") return [];
    throw new Error(`Failed to fetch authors: ${error.message}`);
  }

  const seen = new Set<string>();
  const authors: { login: string; name: string }[] = [];
  for (const c of data ?? []) {
    const key = c.author_login || c.author_name;
    if (!seen.has(key)) {
      seen.add(key);
      authors.push({ login: c.author_login || "", name: c.author_name });
    }
  }
  return authors;
}

/** Delete all commits for a repository (used before re-import) */
export async function deleteCommitsByRepoId(
  repositoryId: string,
  userId: string
): Promise<void> {
  const supabase = await createClient();

  const { error } = await supabase
    .from("commits")
    .delete()
    .eq("user_id", userId)
    .eq("repository_id", repositoryId);

  if (error) {
    throw new Error(`Failed to delete commits: ${error.message}`);
  }
}