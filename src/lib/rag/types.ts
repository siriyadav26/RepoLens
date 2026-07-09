// ================================================================
// RAG Types — Phase 5 foundation, reused by Phase 6 & 8
// ================================================================

export interface RetrievalResult {
  commitId: string;
  repositoryId: string;
  repositoryName: string;
  sha: string;
  message: string;
  authorName: string;
  authorLogin: string | null;
  committedDate: string;
  branch: string;
  additions: number;
  deletions: number;
  filesChanged: number;
  similarity: number;
}

export interface RetrievalOptions {
  queryEmbedding: number[];
  limit?: number;
  minSimilarity?: number;
}

export interface RAGContext {
  query: string;
  results: RetrievalResult[];
  repositoryMeta: {
    name: string;
    fullName: string;
    language: string | null;
    description: string | null;
    defaultBranch: string;
  };
  contextBlock: string;
  totalChars: number;
}