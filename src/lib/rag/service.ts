// ================================================================
// RAG Service — Semantic retrieval via pgvector + context building
// ================================================================

import { createClient } from "@/lib/supabase/server";
import type { RetrievalResult, RetrievalOptions, RAGContext } from "./types";

const CHAR_BUDGET = 8000;
const SINGLE_COMMIT_MAX = 600;

function truncate(str: string, max: number): string {
  if (str.length <= max) return str;
  return str.slice(0, max - 3) + "...";
}

export async function retrieveCommits(
  userId: string,
  repositoryId: string,
  queryEmbedding: number[],
  options: Partial<RetrievalOptions> & { queryEmbedding: number[] }
): Promise<RetrievalResult[]> {
  const supabase = await createClient();
  const limit = options.limit ?? 10;
  const minSimilarity = options.minSimilarity ?? 0.3;

  const { data, error } = await supabase.rpc("semantic_search_commits", {
    p_user_id: userId,
    p_query_embedding: queryEmbedding,
    p_limit: limit,
    p_repository_id: repositoryId,
    p_min_similarity: minSimilarity,
  });

  if (error) {
    // If the function doesn't exist, fall back to text search
    if (error.message.includes("does not exist") || error.code === "42883") {
      return fallbackTextSearch(supabase, userId, repositoryId, "", limit);
    }
    throw new Error(`Retrieval failed: ${error.message}`);
  }

  return (data ?? []).map((row: Record<string, unknown>) => ({
    commitId: row.commit_id as string,
    repositoryId: row.repository_id as string,
    repositoryName: row.repository_name as string,
    sha: row.sha as string,
    message: row.message as string,
    authorName: row.author_name as string,
    authorLogin: row.author_login as string | null,
    committedDate: row.committed_date as string,
    branch: row.branch as string,
    additions: (row.additions as number) ?? 0,
    deletions: (row.deletions as number) ?? 0,
    filesChanged: (row.files_changed as number) ?? 0,
    similarity: row.similarity as number,
  }));
}

async function fallbackTextSearch(
  _supabase: Awaited<ReturnType<typeof createClient>>,
  _userId: string,
  _repositoryId: string,
  _query: string,
  limit: number
): Promise<RetrievalResult[]> {
  // Fallback: fetch recent commits directly
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("commits")
    .select("id, repository_id, sha, message, author_name, author_login, committed_date, branch, additions, deletions, files_changed")
    .eq("user_id", _userId)
    .eq("repository_id", _repositoryId)
    .order("committed_date", { ascending: false })
    .limit(limit);

  if (error || !data) return [];

  return data.map((row) => ({
    commitId: row.id,
    repositoryId: row.repository_id,
    repositoryName: "",
    sha: row.sha,
    message: row.message || "",
    authorName: row.author_name,
    authorLogin: row.author_login,
    committedDate: row.committed_date,
    branch: row.branch,
    additions: row.additions ?? 0,
    deletions: row.deletions ?? 0,
    filesChanged: row.files_changed ?? 0,
    similarity: 1.0,
  }));
}

export function buildRAGContext(
  query: string,
  results: RetrievalResult[],
  repositoryMeta: RAGContext["repositoryMeta"]
): RAGContext {
  let totalChars = 0;
  const blocks: string[] = [];

  for (const r of results) {
    const commitBlock = `[${r.sha.slice(0, 7)}] ${r.message}\nAuthor: ${r.authorName} | Date: ${new Date(r.committedDate).toLocaleDateString()} | +${r.additions} -${r.deletions} | Files: ${r.filesChanged}`;
    const truncated = truncate(commitBlock, SINGLE_COMMIT_MAX);

    if (totalChars + truncated.length > CHAR_BUDGET) break;
    blocks.push(truncated);
    totalChars += truncated.length;
  }

  const contextBlock = blocks.length > 0
    ? "=== RELEVANT COMMITS ===\n" + blocks.join("\n---\n") + "\n=== END RELEVANT COMMITS ==="
    : "";

  return {
    query,
    results: results.slice(0, blocks.length),
    repositoryMeta,
    contextBlock,
    totalChars,
  };
}