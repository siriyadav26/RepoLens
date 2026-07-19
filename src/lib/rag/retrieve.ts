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

  // 1. Generate an embedding for the user's question
  const queryEmbedding = await generateEmbedding(query);

  // 2. Call the pgvector similarity search function
  // We format the vector array as a string since Supabase pgvector RPC 
  // sometimes expects a string representation of the array: '[0.1, 0.2, ...]'
  const embeddingString = `[${queryEmbedding.join(",")}]`;

  const { data, error } = await supabase.rpc("match_file_embeddings", {
    query_embedding: embeddingString,
    match_repository_id: repositoryId,
    match_count: matchCount,
  });

  if (error) {
    console.error("Error retrieving context from Supabase:", error);
    throw new Error("Failed to retrieve repository context");
  }

  return data as RetrievedChunk[];
}
