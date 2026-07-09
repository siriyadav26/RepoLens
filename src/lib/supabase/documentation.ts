// ================================================================
// Supabase Documentation CRUD — Phase 8
// ================================================================

import { createClient } from "@/lib/supabase/server";
import type { DocumentType, GeneratedDocument, DocumentVersion } from "@/lib/documentation/types";

export interface DocFilter {
  search?: string;
  documentType?: DocumentType;
}

export interface DocsResult {
  documents: GeneratedDocument[];
  total: number;
}

/** List all documents for a repository */
export async function getDocumentsByRepo(
  repositoryId: string,
  userId: string,
  filter: DocFilter = {}
): Promise<DocsResult> {
  const supabase = await createClient();

  let query = supabase
    .from("documents")
    .select("*", { count: "exact" })
    .eq("user_id", userId)
    .eq("repository_id", repositoryId)
    .order("updated_at", { ascending: false });

  if (filter.documentType) {
    query = query.eq("document_type", filter.documentType);
  }

  if (filter.search) {
    const term = `%${filter.search}%`;
    query = query.or(`title.ilike.${term},content.ilike.${term}`);
  }

  const { data, error, count } = await query;

  if (error) {
    if (error.code === "42P01") return { documents: [], total: 0 };
    throw new Error(`Failed to fetch documents: ${error.message}`);
  }

  const documents: GeneratedDocument[] = (data ?? []).map(mapDoc);
  return { documents, total: count ?? 0 };
}

/** Get a single document */
export async function getDocumentById(
  documentId: string,
  userId: string
): Promise<GeneratedDocument | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("documents")
    .select("*")
    .eq("id", documentId)
    .eq("user_id", userId)
    .single();

  if (error) {
    if (error.code === "PGRST116") return null;
    throw new Error(`Failed to fetch document: ${error.message}`);
  }

  return data ? mapDoc(data) : null;
}

/** Update document title or content */
export async function updateDocument(
  documentId: string,
  userId: string,
  updates: { title?: string; content?: string; is_edited?: boolean }
): Promise<GeneratedDocument> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("documents")
    .update(updates)
    .eq("id", documentId)
    .eq("user_id", userId)
    .select()
    .single();

  if (error) throw new Error(`Failed to update document: ${error.message}`);
  return mapDoc(data);
}

/** Delete a document and its versions */
export async function deleteDocument(
  documentId: string,
  userId: string
): Promise<void> {
  const supabase = await createClient();

  const { error } = await supabase
    .from("documents")
    .delete()
    .eq("id", documentId)
    .eq("user_id", userId);

  if (error) throw new Error(`Failed to delete document: ${error.message}`);
}

/** Duplicate a document */
export async function duplicateDocument(
  documentId: string,
  userId: string
): Promise<GeneratedDocument> {
  const supabase = await createClient();

  // Fetch original
  const { data: original, error: fetchErr } = await supabase
    .from("documents")
    .select("*")
    .eq("id", documentId)
    .eq("user_id", userId)
    .single();

  if (fetchErr || !original) throw new Error("Document not found");

  // Insert duplicate
  const { data, error } = await supabase
    .from("documents")
    .insert({
      user_id: userId,
      repository_id: original.repository_id,
      title: `${original.title} (Copy)`,
      document_type: original.document_type,
      content: original.content,
      version: 1,
      prompt_version: original.prompt_version,
      provider: original.provider,
      model: original.model,
      is_edited: false,
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to duplicate: ${error.message}`);

  // Copy initial version
  await supabase.from("document_versions").insert({
    document_id: data.id,
    version: 1,
    content: data.content,
    prompt_version: data.prompt_version,
    provider: data.provider,
    model: data.model,
  });

  return mapDoc(data);
}

/** Get version history for a document */
export async function getDocumentVersions(
  documentId: string,
  userId: string
): Promise<DocumentVersion[]> {
  const supabase = await createClient();

  // Verify ownership
  const { data: doc, error: docErr } = await supabase
    .from("documents")
    .select("id")
    .eq("id", documentId)
    .eq("user_id", userId)
    .single();

  if (docErr || !doc) throw new Error("Document not found");

  const { data, error } = await supabase
    .from("document_versions")
    .select("*")
    .eq("document_id", documentId)
    .order("version", { ascending: false });

  if (error) throw new Error(`Failed to fetch versions: ${error.message}`);

  return (data ?? []).map((v: Record<string, unknown>) => ({
    id: v.id as string,
    documentId: v.document_id as string,
    version: v.version as number,
    content: v.content as string,
    promptVersion: v.prompt_version as string,
    provider: v.provider as string,
    model: v.model as string,
    createdAt: v.created_at as string,
  }));
}

/** Restore a specific version */
export async function restoreVersion(
  documentId: string,
  versionId: string,
  userId: string
): Promise<GeneratedDocument> {
  const supabase = await createClient();

  // Get the version content
  const { data: version, error: verErr } = await supabase
    .from("document_versions")
    .select("*")
    .eq("id", versionId)
    .single();

  if (verErr || !version) throw new Error("Version not found");

  // Update the document with version content
  return updateDocument(documentId, userId, {
    content: version.content,
    is_edited: true,
  });
}

function mapDoc(row: Record<string, unknown>): GeneratedDocument {
  return {
    id: row.id as string,
    repositoryId: row.repository_id as string,
    userId: row.user_id as string,
    title: row.title as string,
    documentType: row.document_type as DocumentType,
    content: row.content as string,
    version: row.version as number,
    promptVersion: row.prompt_version as string,
    provider: row.provider as string,
    model: row.model as string,
    isEdited: row.is_edited as boolean,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}