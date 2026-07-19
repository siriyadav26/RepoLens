// ================================================================
// Local Embeddings via @xenova/transformers
// Model: Xenova/all-MiniLM-L6-v2 (384-dimensional vectors)
// ================================================================

/* eslint-disable @typescript-eslint/no-explicit-any */
import { env } from "@xenova/transformers";

// Store model in local cache directory instead of downloading every time
env.cacheDir = "./.cache/xenova";

// Use the dynamic pipeline() to avoid top-level await issues
// We keep a singleton promise so the model only loads once per server instance
let pipelinePromise: Promise<(text: string, options?: Record<string, unknown>) => Promise<any>> | null = null;

async function getPipeline() {
  if (!pipelinePromise) {
    pipelinePromise = (async () => {
      const { pipeline } = await import("@xenova/transformers");
      console.log("[Embeddings] Loading model: Xenova/all-MiniLM-L6-v2 ...");
      const extractor = await pipeline(
        "feature-extraction",
        "Xenova/all-MiniLM-L6-v2"
      );
      console.log("[Embeddings] Model loaded.");
      return extractor;
    })();
  }
  return pipelinePromise;
}

/**
 * Normalize a vector (L2 norm) to unit length.
 */
function normalize(vector: number[]): number[] {
  const magnitude = Math.sqrt(vector.reduce((sum, v) => sum + v * v, 0));
  if (magnitude === 0) return vector;
  return vector.map((v) => v / magnitude);
}

/**
 * Generate a single 384-dimensional embedding for the given text.
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  const extractor = await getPipeline();
  const output = await extractor(text, { pooling: "mean", normalize: true });
  // output.data is a Float32Array — convert to number[]
  const vector = Array.from(output.data as Float32Array);
  return normalize(vector);
}

/**
 * Generate 384-dimensional embeddings for a batch of texts.
 * Processed sequentially to keep memory usage stable.
 */
export async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  const results: number[][] = [];
  for (const text of texts) {
    results.push(await generateEmbedding(text));
  }
  return results;
}
