import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  getDocumentById,
  updateDocument,
  deleteDocument,
  duplicateDocument,
  getDocumentVersions,
} from "@/lib/supabase/documentation";
import { regenerateDocument } from "@/lib/documentation/service";
import { getRepositoryById } from "@/lib/supabase/repositories";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; docId: string }> }
) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: _repoId, docId } = await params;

    const document = await getDocumentById(docId, user.id);
    if (!document) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }

    return NextResponse.json({ document });
  } catch (err) {
    console.error("Get document error:", err);
    return NextResponse.json({ error: "Failed to fetch document." }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; docId: string }> }
) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: repoId, docId } = await params;
    const body = await request.json();

    if (body.action === "rename") {
      if (!body.title) {
        return NextResponse.json({ error: "Title is required" }, { status: 400 });
      }
      const doc = await updateDocument(docId, user.id, { title: body.title });
      return NextResponse.json({ document: doc });
    }

    if (body.action === "save") {
      const doc = await updateDocument(docId, user.id, {
        content: body.content,
        is_edited: true,
      });
      return NextResponse.json({ document: doc });
    }

    if (body.action === "duplicate") {
      const doc = await duplicateDocument(docId, user.id);
      return NextResponse.json({ document: doc }, { status: 201 });
    }

    if (body.action === "regenerate") {
      const existing = await getDocumentById(docId, user.id);
      if (!existing) {
        return NextResponse.json({ error: "Document not found" }, { status: 404 });
      }
      const repository = await getRepositoryById(repoId, user.id);
      if (!repository) {
        return NextResponse.json({ error: "Repository not found" }, { status: 404 });
      }
      const doc = await regenerateDocument(user.id, repository, existing);
      return NextResponse.json({ document: doc });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Update failed";
    console.error("Update document error:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; docId: string }> }
) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { docId } = await params;
    await deleteDocument(docId, user.id);

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Delete document error:", err);
    return NextResponse.json({ error: "Failed to delete document." }, { status: 500 });
  }
}