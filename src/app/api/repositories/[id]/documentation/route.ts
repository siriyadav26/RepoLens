import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getDocumentsByRepo } from "@/lib/supabase/documentation";
import { generateDocument } from "@/lib/documentation/service";
import { getRepositoryById } from "@/lib/supabase/repositories";
import type { GenerateRequest, DocumentType } from "@/lib/documentation/types";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const searchParams = request.nextUrl.searchParams;

    const documents = await getDocumentsByRepo(id, user.id, {
      search: searchParams.get("search") || undefined,
      documentType: (searchParams.get("type") as DocumentType) || undefined,
    });

    return NextResponse.json(documents);
  } catch (err) {
    console.error("List documents error:", err);
    return NextResponse.json(
      { error: "Failed to fetch documents." },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = (await request.json()) as GenerateRequest;

    if (!body.documentType) {
      return NextResponse.json(
        { error: "documentType is required" },
        { status: 400 }
      );
    }

    // Verify repository exists and belongs to user
    const repository = await getRepositoryById(id, user.id);
    if (!repository) {
      return NextResponse.json(
        { error: "Repository not found" },
        { status: 404 }
      );
    }

    const document = await generateDocument(user.id, repository, body);

    return NextResponse.json({ document }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Generation failed";
    console.error("Generate document error:", err);

    if (message.startsWith("INSUFFICIENT_CONTEXT")) {
      return NextResponse.json({ error: message }, { status: 422 });
    }
    if (message.startsWith("RATE_LIMITED")) {
      return NextResponse.json({ error: message }, { status: 429 });
    }
    if (message.includes("DOCUMENT_TABLE_MISSING")) {
      return NextResponse.json(
        { error: "Documents table not found. Please run the Phase 8 SQL migration." },
        { status: 500 }
      );
    }

    return NextResponse.json({ error: message }, { status: 500 });
  }
}