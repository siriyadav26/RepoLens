// ================================================================
// Documentation Service — Generation pipeline
// ================================================================

import type { DocumentType, GeneratedDocument, GenerateRequest } from "./types";
import { PROMPT_VERSION } from "./prompts";
import { DOCUMENT_TYPE_CONFIG } from "./types";
import { buildDocPrompt } from "./prompts";
import { llmService } from "@/lib/llm";
import { buildRAGContext, retrieveCommits } from "@/lib/rag";
import { createClient } from "@/lib/supabase/server";
import type { DbRepository } from "@/lib/supabase/repositories";

const EMBEDDING_API_URL = process.env.EMBEDDING_API_URL || "https://api.groq.com/openai/v1/embeddings";
const EMBEDDING_MODEL = process.env.EMBEDDING_MODEL || "text-embedding-ada-002";

async function getEmbedding(text: string): Promise<number[]> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error("GROQ_API_KEY is not configured");

  const res = await fetch(EMBEDDING_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ model: EMBEDDING_MODEL, input: text }),
  });

  if (!res.ok) {
    throw new Error(`Embedding API error (${res.status}): ${await res.text()}`);
  }

  const data = await res.json();
  return data.data?.[0]?.embedding ?? [];
}

export async function generateDocument(
  userId: string,
  repository: DbRepository,
  request: GenerateRequest
): Promise<GeneratedDocument> {
  const { documentType, customTitle } = request;
  const config = DOCUMENT_TYPE_CONFIG[documentType];
  const title = customTitle || `${repository.name} — ${config.label}`;

  // Step 1: Retrieve relevant context via RAG
  const queryMap: Record<DocumentType, string> = {
    readme: `project overview structure setup ${repository.name}`,
    project_overview: `project goals purpose ${repository.name}`,
    architecture_overview: `architecture design patterns components ${repository.name}`,
    folder_structure: `directory structure folders files organization ${repository.name}`,
    module_summary: `modules packages components responsibilities ${repository.name}`,
    api_summary: `API endpoints routes controllers ${repository.name}`,
    installation_guide: `setup installation dependencies configuration ${repository.name}`,
    onboarding_guide: `setup development environment conventions ${repository.name}`,
    release_notes: `recent changes features fixes release ${repository.name}`,
    changelog: `changes updates fixes additions removals ${repository.name}`,
    feature_summary: `features capabilities functionality ${repository.name}`,
    dependency_overview: `dependencies packages libraries versions ${repository.name}`,
  };

  const queryText = queryMap[documentType] || `documentation ${repository.name}`;
  let contextBlock = "";

  try {
    const queryEmbedding = await getEmbedding(queryText);
    const results = await retrieveCommits(userId, repository.id, queryEmbedding, {
      queryEmbedding,
      limit: 15,
      minSimilarity: 0.2,
    });

    const rag = buildRAGContext(queryText, results, {
      name: repository.name,
      fullName: repository.full_name,
      language: repository.language,
      description: repository.description,
      defaultBranch: repository.default_branch,
    });

    contextBlock = rag.contextBlock;
  } catch (err) {
    // If embedding/retrieval fails, try fetching commits directly
    console.warn("Embedding retrieval failed, using direct fetch:", err);
    const supabase = await createClient();
    const { data: commits } = await supabase
      .from("commits")
      .select("sha, message, author_name, committed_date, additions, deletions, files_changed")
      .eq("user_id", userId)
      .eq("repository_id", repository.id)
      .order("committed_date", { ascending: false })
      .limit(20);

    if (commits && commits.length > 0) {
      contextBlock = "=== RECENT COMMITS ===\n" +
        commits.map((c: Record<string, unknown>) =>
          `[${(c.sha as string).slice(0, 7)}] ${c.message}\nAuthor: ${c.author_name} | Date: ${new Date(c.committed_date as string).toLocaleDateString()} | +${c.additions} -${c.deletions}`
        ).join("\n---\n") +
        "\n=== END RECENT COMMITS ===";
    }
  }

  if (!contextBlock) {
    throw new Error(
      "INSUFFICIENT_CONTEXT: No commit data available for this repository. Please import commits first."
    );
  }

  // Step 2: Build prompt
  const { system, user } = buildDocPrompt(documentType, {
    repoName: repository.name,
    repoFullName: repository.full_name,
    language: repository.language,
    description: repository.description,
    defaultBranch: repository.default_branch,
    contextBlock,
    totalCommits: 20,
  });

  // Step 3: Generate via LLM
  const response = await llmService.generate(
    [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    {
      temperature: 0.5,
      maxTokens: 6000,
    }
  );

  // Step 4: Save to database
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("documents")
    .insert({
      user_id: userId,
      repository_id: repository.id,
      title,
      document_type: documentType,
      content: response.content,
      version: 1,
      prompt_version: PROMPT_VERSION,
      provider: response.provider,
      model: response.model,
      is_edited: false,
    })
    .select()
    .single();

  if (error) {
    if (error.code === "42P01") {
      throw new Error("DOCUMENT_TABLE_MISSING");
    }
    throw new Error(`Failed to save document: ${error.message}`);
  }

  // Also save initial version
  await supabase.from("document_versions").insert({
    document_id: data.id,
    version: 1,
    content: response.content,
    prompt_version: PROMPT_VERSION,
    provider: response.provider,
    model: response.model,
  });

  return {
    id: data.id,
    repositoryId: data.repository_id,
    userId: data.user_id,
    title: data.title,
    documentType: data.document_type,
    content: data.content,
    version: data.version,
    promptVersion: data.prompt_version,
    provider: data.provider,
    model: data.model,
    isEdited: data.is_edited,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
}

export async function regenerateDocument(
  userId: string,
  repository: DbRepository,
  existingDoc: GeneratedDocument
): Promise<GeneratedDocument> {
  const newVersion = existingDoc.version + 1;

  // Re-run generation pipeline
  const result = await generateDocument(userId, repository, {
    documentType: existingDoc.documentType,
    customTitle: existingDoc.title,
  });

  // Update version number
  const supabase = await createClient();
  await supabase
    .from("documents")
    .update({ version: newVersion })
    .eq("id", result.id);

  await supabase
    .from("document_versions")
    .update({ version: newVersion })
    .eq("id", result.id);

  return { ...result, version: newVersion };
}