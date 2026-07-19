// ================================================================
// Context Retrieval for RAG
// ================================================================

import { createClient as createServiceClient } from "@supabase/supabase-js";
import { generateEmbedding } from "@/lib/ai/embeddings";

export interface RetrievedChunk {
  id: string;
  file_path: string;
  content: string;
  similarity: number;
}

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  if (!url || !key) throw new Error("Supabase service role credentials not configured");
  return createServiceClient(url, key, {
    auth: { persistSession: false },
  });
}

export async function retrieveContext(
  query: string,
  repositoryId: string,
  matchCount = 5
): Promise<RetrievedChunk[]> {
  const supabase = getServiceClient();

  // 1. Fetch all embeddings for this repository
  const { data: rows, error } = await supabase
    .from("file_embeddings")
    .select("id, file_path, content, embedding")
    .eq("repository_id", repositoryId);

  if (error) {
    console.error("[RAG Retrieve] Direct query error:", JSON.stringify(error));
    throw new Error(`Failed to query repository context: ${error.message}`);
  }

  console.log(`[RAG Retrieve] Embeddings in DB for repo ${repositoryId}: ${rows?.length ?? 0}`);

  if (!rows || rows.length === 0) {
    console.warn("[RAG Retrieve] No embeddings found — run Generate Embeddings first.");
    return [];
  }

  // 2. Generate an embedding for the user's query
  const queryEmbedding = await generateEmbedding(query);
  console.log(`[RAG Retrieve] Query embedding dimensions: ${queryEmbedding.length}`);

  // 3. Compute cosine similarity in JavaScript (highly optimized and robust)
  const chunksWithSimilarity: RetrievedChunk[] = rows.map((row) => {
    // Parse embedding representation from PostgreSQL
    let embArr: number[] = [];
    if (typeof row.embedding === "string") {
      embArr = (row.embedding as string)
        .replace(/[\[\]]/g, "")
        .split(",")
        .map(Number);
    } else if (Array.isArray(row.embedding)) {
      embArr = row.embedding;
    }

    // Dot product of normalized vectors
    let dotProduct = 0;
    const len = Math.min(embArr.length, queryEmbedding.length);
    for (let i = 0; i < len; i++) {
      dotProduct += embArr[i] * queryEmbedding[i];
    }

    return {
      id: row.id,
      file_path: row.file_path,
      content: row.content,
      similarity: dotProduct,
    };
  });

  // 4. Sort by similarity descending and select top matchCount
  chunksWithSimilarity.sort((a, b) => b.similarity - a.similarity);
  const selectedChunks = chunksWithSimilarity.slice(0, matchCount);

  console.log(
    `[RAG Retrieve] Top matches:`,
    selectedChunks.map((c) => `${c.file_path} (${(c.similarity * 100).toFixed(0)}% match)`)
  );

  return selectedChunks;
}
