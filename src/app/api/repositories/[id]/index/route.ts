import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { embedRepository } from "@/lib/rag/embed-repository";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: repoId } = await params;
    const supabase = await createClient();

    // 1. Verify Auth
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 2. Verify Repository Ownership
    const { data: repo, error: repoError } = await supabase
      .from("repositories")
      .select("id, user_id")
      .eq("id", repoId)
      .single();

    if (repoError || !repo) {
      return NextResponse.json(
        { error: "Repository not found" },
        { status: 404 }
      );
    }

    if (repo.user_id !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // 3. Run the embedding pipeline
    const stats = await embedRepository(repoId);

    return NextResponse.json({ success: true, ...stats });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Failed to index repository";
    console.error("[Index API] Error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
