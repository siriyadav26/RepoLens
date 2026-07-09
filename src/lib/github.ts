// ================================================================
// GitHub REST API Integration — fetches public repository metadata
// ================================================================

export interface GitHubRepo {
  id: number;
  full_name: string;
  name: string;
  owner: {
    login: string;
    avatar_url: string;
  };
  description: string | null;
  html_url: string;
  stargazers_count: number;
  forks_count: number;
  watchers_count: number;
  open_issues_count: number;
  language: string | null;
  topics: string[];
  license: { spdx_id: string; name: string } | null;
  default_branch: string;
  created_at: string;
  updated_at: string;
}

export interface ParsedRepoInput {
  owner: string;
  repo: string;
}

/** Parse "https://github.com/owner/repo" or "owner/repo" into {owner, repo} */
export function parseRepoInput(input: string): ParsedRepoInput | null {
  const trimmed = input.trim();

  // Match: https://github.com/owner/repo (with optional trailing slash or parts)
  const urlMatch = trimmed.match(
    /^https?:\/\/github\.com\/([^/]+)\/([^/]+?)(?:\/.*)?$/
  );
  if (urlMatch) {
    return { owner: urlMatch[1], repo: urlMatch[2] };
  }

  // Match: owner/repo
  const simpleMatch = trimmed.match(/^([^/]+)\/([^/]+)$/);
  if (simpleMatch) {
    return { owner: simpleMatch[1], repo: simpleMatch[2] };
  }

  return null;
}

/** Validate parsed owner and repo names */
export function validateRepoInput(input: ParsedRepoInput): string | null {
  if (!input.owner || !input.repo) {
    return "Owner and repository name are required.";
  }
  if (input.owner.length > 39 || input.repo.length > 100) {
    return "Owner or repository name is too long.";
  }
  if (/[^a-zA-Z0-9._-]/.test(input.owner) || /[^a-zA-Z0-9._-]/.test(input.repo)) {
    return "Invalid characters in owner or repository name.";
  }
  return null;
}

export class GitHubAPIError extends Error {
  constructor(
    message: string,
    public status: number,
    public isRateLimit = false,
    public retryAfter?: number
  ) {
    super(message);
    this.name = "GitHubAPIError";
  }
}

/**
 * Fetch repository metadata from GitHub REST API.
 * Uses unauthenticated endpoint (60 req/hour for public repos).
 */
export async function fetchGitHubRepo(
  owner: string,
  repo: string
): Promise<GitHubRepo> {
  const url = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`;

  const response = await fetch(url, {
    headers: {
      Accept: "application/vnd.github.v3+json",
      "User-Agent": "RepoLens-AI/1.0",
    },
  });

  if (response.status === 404) {
    throw new GitHubAPIError(
      `Repository "${owner}/${repo}" not found. Make sure it's a public GitHub repository.`,
      404
    );
  }

  if (response.status === 403) {
    const retryAfter = response.headers.get("Retry-After");
    const isRateLimit = response.headers
      .get("X-RateLimit-Remaining")
      ?.startsWith("0");

    if (isRateLimit) {
      const resetTime = response.headers.get("X-RateLimit-Reset");
      const minutes = resetTime
        ? Math.max(1, Math.ceil((parseInt(resetTime) * 1000 - Date.now()) / 60000))
        : 1;

      throw new GitHubAPIError(
        `GitHub API rate limit exceeded. Please try again in ${minutes} minute${minutes > 1 ? "s" : ""}.`,
        403,
        true,
        retryAfter ? parseInt(retryAfter) : minutes * 60
      );
    }

    throw new GitHubAPIError(
      "Access forbidden. This repository may be private or access was denied.",
      403
    );
  }

  if (response.status === 422) {
    throw new GitHubAPIError(
      "Invalid repository format. Please use 'owner/repo' or a full GitHub URL.",
      422
    );
  }

  if (!response.ok) {
    throw new GitHubAPIError(
      `GitHub API error: ${response.status} ${response.statusText}`,
      response.status
    );
  }

  return response.json() as Promise<GitHubRepo>;
}

// ================================================================
// GitHub Commit Types & Fetching (Phase 3)
// ================================================================

export interface GitHubCommit {
  sha: string;
  commit: {
    message: string;
    author: {
      name: string;
      email: string;
      date: string;
    };
    committer: {
      date: string;
    };
  };
  author: {
    login: string;
    avatar_url: string;
  } | null;
  html_url: string;
  parents: { sha: string }[];
  stats: {
    total: number;
    additions: number;
    deletions: number;
  } | null;
  files?: {
    filename: string;
    status: string;
    additions: number;
    deletions: number;
    changes: number;
    patch?: string;
  }[];
}

export interface GitHubCommitsResponse {
  commits: GitHubCommit[];
  hasMore: boolean;
  totalCount: number;
}

/**
 * Fetch commits for a repository from GitHub REST API.
 * Returns paginated results with a cursor for the next page.
 */
export async function fetchGitHubCommits(
  owner: string,
  repo: string,
  options?: {
    page?: number;
    perPage?: number;
    sha?: string; // branch or SHA to start from
    since?: string; // ISO date string
    until?: string; // ISO date string
  }
): Promise<GitHubCommitsResponse> {
  const page = options?.page ?? 1;
  const perPage = options?.perPage ?? 30;
  const params = new URLSearchParams({
    page: page.toString(),
    per_page: perPage.toString(),
  });
  if (options?.sha) params.set("sha", options.sha);
  if (options?.since) params.set("since", options.since);
  if (options?.until) params.set("until", options.until);

  const url = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/commits?${params}`;

  const response = await fetch(url, {
    headers: {
      Accept: "application/vnd.github.v3+json",
      "User-Agent": "RepoLens-AI/1.0",
    },
  });

  if (response.status === 404) {
    throw new GitHubAPIError(
      `Repository "${owner}/${repo}" not found or commits unavailable.`,
      404
    );
  }

  if (response.status === 403) {
    const retryAfter = response.headers.get("Retry-After");
    const isRateLimit = response.headers
      .get("X-RateLimit-Remaining")
      ?.startsWith("0");

    if (isRateLimit) {
      const resetTime = response.headers.get("X-RateLimit-Reset");
      const minutes = resetTime
        ? Math.max(1, Math.ceil((parseInt(resetTime) * 1000 - Date.now()) / 60000))
        : 1;

      throw new GitHubAPIError(
        `GitHub API rate limit exceeded. Try again in ${minutes} minute${minutes > 1 ? "s" : ""}.`,
        403,
        true,
        retryAfter ? parseInt(retryAfter) : minutes * 60
      );
    }

    throw new GitHubAPIError("Access forbidden.", 403);
  }

  if (response.status === 422) {
    throw new GitHubAPIError("Invalid request parameters.", 422);
  }

  if (!response.ok) {
    throw new GitHubAPIError(
      `GitHub API error: ${response.status} ${response.statusText}`,
      response.status
    );
  }

  const commits = (await response.json()) as GitHubCommit[];

  // Parse Link header for pagination
  const linkHeader = response.headers.get("Link");
  let hasMore = false;
  if (linkHeader) {
    hasMore = linkHeader.includes('rel="next"');
  }

  // Total count from the last page or estimate
  const totalCount = commits.length < perPage
    ? (page - 1) * perPage + commits.length
    : page * perPage;

  return { commits, hasMore, totalCount };
}

/**
 * Fetch a single commit's full details including file changes.
 */
export async function fetchGitHubCommitDetail(
  owner: string,
  repo: string,
  sha: string
): Promise<GitHubCommit> {
  const url = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/commits/${encodeURIComponent(sha)}`;

  const response = await fetch(url, {
    headers: {
      Accept: "application/vnd.github.v3+json",
      "User-Agent": "RepoLens-AI/1.0",
    },
  });

  if (response.status === 404) {
    throw new GitHubAPIError(`Commit "${sha}" not found.`, 404);
  }

  if (!response.ok) {
    throw new GitHubAPIError(
      `GitHub API error: ${response.status} ${response.statusText}`,
      response.status
    );
  }

  return response.json() as Promise<GitHubCommit>;
}

/** Format a number with K/M suffix for display */
export function formatCount(num: number): string {
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(1)}K`;
  return num.toString();
}