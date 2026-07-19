// ================================================================
// Context Retrieval for RAG
// ================================================================

import { createClient } from "@/lib/supabase/server";
import { generateEmbedding } from "@/lib/ai/embeddings";

export interface RetrievedChunk {
  id: string;
  file_path: string;
  content: string;
  similarity: number;
}

export async function retrieveContext(
  query: string,
  repositoryId: string,
  matchCount = 5
): Promise<RetrievedChunk[]> {
  const supabase = await createClient();

  // 1. Check if any embeddings exist for this repo
  const { count } = await supabase
    .from("file_embeddings")
    .select("id", { count: "exact", head: true })
    .eq("repository_id", repositoryId);

  console.log(`[RAG Retrieve] Embeddings in DB for repo ${repositoryId}:`, count);

  if (!count || count === 0) {
    console.warn("[RAG Retrieve] No embeddings found — run Generate Embeddings first.");
    return [];
  }

  // 2. Generate an embedding for the user's question
  const queryEmbedding = await generateEmbedding(query);
  console.log(`[RAG Retrieve] Query embedding dimensions: ${queryEmbedding.length}`);

  // 3. Format as Postgres vector string
  const embeddingString = `[${queryEmbedding.join(",")}]`;

  const { data, error } = await supabase.rpc("match_file_embeddings", {
    query_embedding: embeddingString,
    match_repository_id: repositoryId,
    match_count: matchCount,
  });

  if (error) {
    console.error("[RAG Retrieve] RPC error:", JSON.stringify(error));
    throw new Error(`Failed to retrieve repository context: ${error.message}`);
  }

  console.log(`[RAG Retrieve] Chunks returned: ${data?.length ?? 0}`);
  return data as RetrievedChunk[];
}
