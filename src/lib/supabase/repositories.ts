// ================================================================
// Supabase Repositories CRUD
// ================================================================
import { createClient } from "@/lib/supabase/server";
import type { GitHubRepo } from "@/lib/github";

export interface DbRepository {
  id: string;
  user_id: string;
  repo_id: number;
  full_name: string;
  name: string;
  owner_login: string;
  owner_avatar: string | null;
  description: string | null;
  html_url: string;
  stars: number;
  forks: number;
  watchers: number;
  open_issues: number;
  language: string | null;
  topics: string[];
  license: string | null;
  default_branch: string;
  created_at: string;
  updated_at: string;
  github_created_at: string | null;
  github_updated_at: string | null;
}

/** Convert GitHub API response to DB row shape */
export function githubToDbRow(
  githubRepo: GitHubRepo,
  userId: string
): Omit<DbRepository, "id" | "user_id" | "created_at" | "updated_at"> & {
  user_id: string;
} {
  return {
    user_id: userId,
    repo_id: githubRepo.id,
    full_name: githubRepo.full_name,
    name: githubRepo.name,
    owner_login: githubRepo.owner.login,
    owner_avatar: githubRepo.owner.avatar_url,
    description: githubRepo.description,
    html_url: githubRepo.html_url,
    stars: githubRepo.stargazers_count,
    forks: githubRepo.forks_count,
    watchers: githubRepo.watchers_count,
    open_issues: githubRepo.open_issues_count,
    language: githubRepo.language,
    topics: githubRepo.topics ?? [],
    license: githubRepo.license?.spdx_id ?? null,
    default_branch: githubRepo.default_branch,
    github_created_at: githubRepo.created_at,
    github_updated_at: githubRepo.updated_at,
  };
}

/** Insert a repository (upsert on user_id + repo_id conflict) */
export async function saveRepository(
  userId: string,
  githubRepo: GitHubRepo
): Promise<DbRepository> {
  const supabase = await createClient();
  const row = githubToDbRow(githubRepo, userId);

  const { data, error } = await supabase
    .from("repositories")
    .upsert(row, { onConflict: "user_id,repo_id" })
    .select()
    .single();

  if (error) {
    if (error.code === "42P01") {
      throw new Error(
        "REPO_TABLE_MISSING"
      );
    }
    throw new Error(`Failed to save repository: ${error.message}`);
  }

  return data as DbRepository;
}

/** Get all repositories for a user, newest first */
export async function getUserRepositories(
  userId: string
): Promise<DbRepository[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("repositories")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) {
    if (error.code === "42P01") {
      return [];
    }
    throw new Error(`Failed to fetch repositories: ${error.message}`);
  }

  return (data ?? []) as DbRepository[];
}

/** Get a single repository by ID (must belong to user) */
export async function getRepositoryById(
  repoId: string,
  userId: string
): Promise<DbRepository | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("repositories")
    .select("*")
    .eq("id", repoId)
    .eq("user_id", userId)
    .single();

  if (error) {
    if (error.code === "PGRST116") return null; // not found
    throw new Error(`Failed to fetch repository: ${error.message}`);
  }

  return data as DbRepository;
}

/** Delete a repository */
export async function deleteRepository(
  repoId: string,
  userId: string
): Promise<void> {
  const supabase = await createClient();

  const { error } = await supabase
    .from("repositories")
    .delete()
    .eq("id", repoId)
    .eq("user_id", userId);

  if (error) {
    throw new Error(`Failed to delete repository: ${error.message}`);
  }
}

/** Update the updated_at timestamp (marks as "last viewed") */
export async function touchRepository(
  repoId: string,
  userId: string
): Promise<void> {
  const supabase = await createClient();

  // Setting any column triggers the updated_at trigger
  const { error } = await supabase
    .from("repositories")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", repoId)
    .eq("user_id", userId);

  if (error) {
    // Non-critical, don't throw
    console.error("Failed to touch repository:", error.message);
  }
}