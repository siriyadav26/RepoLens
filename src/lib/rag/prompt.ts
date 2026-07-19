// ================================================================
// RAG Prompt Construction & Guardrails
// ================================================================

import { RetrievedChunk } from "./retrieve";

// Topics that are clearly unrelated to code/repositories
// Even if they contain a tech keyword, we detect + block them
const BLOCKED_TOPIC_PATTERNS: RegExp[] = [
  // Food & cooking
  /biryani|recipe|cook(ing)?|food|dish|meal|ingredient|paneer|chicken|rice|curry|fry|bake|boil/i,
  // Politics & celebrities
  /prime\s*minister|president|minister|politician|celebrity|actor|actress|movie|film|sport(s)?|cricket|football|pm\s+of/i,
  // Creative writing
  /write\s+a\s+poem|poem|poetry|story|essay|joke|riddle|song|lyric/i,
  // General knowledge traps
  /capital\s+of|population\s+of|who\s+is\s+the|when\s+was\s+.{1,40}\s+born|history\s+of/i,
  // Medical / Personal
  /doctor|medicine|symptom|disease|health\s+tip|workout|exercise|diet\s+plan/i,
  // Finance unrelated
  /stock\s+market|crypto|bitcoin|invest(ment)?|mutual\s+fund/i,
];

// Keywords that indicate the question IS about the repository / code
const ALLOWED_KEYWORDS = [
  "repository", "repo", "codebase", "source code",
  "file", "folder", "directory", "structure",
  "api", "route", "endpoint", "handler",
  "database", "db", "schema", "table", "query", "sql",
  "auth", "authentication", "login", "session", "token", "jwt",
  "supabase", "postgres", "prisma",
  "import", "export", "module",
  "commit", "branch", "git", "diff", "pull request", "pr",
  "timeline", "history",
  "rag", "embedding", "vector", "llm", "ai",
  "nextjs", "next.js", "react", "typescript", "javascript",
  "component", "hook", "context", "props", "state",
  "function", "class", "interface", "type", "enum",
  "config", "env", "environment", "variable",
  "package", "dependency", "dependencies", "install", "build", "deploy", "version",
  "test", "spec", "mock", "library", "libraries", "framework", "scripts", "setup",
  "middleware", "server", "client",
  "index", "chunk", "pipeline",
  "how does", "where is", "explain the", "what is the", "which file", "how to use",
];

/**
 * Two-layer guardrail:
 * 1. Block if question matches a known off-topic pattern (catches tricked Qs)
 * 2. Allow only if question contains a repo/code-related keyword
 */
export function isQuestionRelatedToRepository(question: string): boolean {
  const lowerQ = question.toLowerCase();

  // Layer 1: Hard-block known off-topic topics regardless of any tech keywords present
  for (const pattern of BLOCKED_TOPIC_PATTERNS) {
    if (pattern.test(lowerQ)) return false;
  }

  // Layer 2: Must contain at least one repository/code related keyword
  for (const keyword of ALLOWED_KEYWORDS) {
    if (lowerQ.includes(keyword)) return true;
  }

  return false;
}

export const UNRELATED_REPLY =
  "I can only answer questions related to this repository and its indexed files.";
export const NOT_FOUND_REPLY =
  "I could not find that information in the indexed repository files.";

export function buildRagPrompt(
  question: string,
  chunks: RetrievedChunk[]
): string {
  const contextText = chunks
    .map(
      (c, i) =>
        `--- File: ${c.file_path} (Relevance Match #${i + 1}) ---\n${c.content}\n`
    )
    .join("\n");

  return `You are RepoLens AI, a STRICT repository code assistant.

CRITICAL RULES — follow these without exception:
1. Answer ONLY using the repository context provided below.
2. Do NOT use any external knowledge, general knowledge, or world facts.
3. If the question is about cooking, food, politics, entertainment, personal topics, finance, or anything unrelated to software/code/this repository, reply EXACTLY:
   "I can only answer questions related to this repository and its indexed files."
4. If the question appears to be a trick (e.g. "make biryani using React"), treat it as unrelated and reply EXACTLY:
   "I can only answer questions related to this repository and its indexed files."
5. If the answer is simply not present in the context, reply EXACTLY:
   "I could not find that information in the indexed repository files."
6. Do NOT make up file names, functions, or code that isn't in the context.
7. Keep answers concise and technical. Always cite the file names you used.

Repository context (indexed files):
${contextText}

User question:
${question}

Answer strictly based on the context above:`;
}
