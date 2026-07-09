import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  getRepositoryById,
  deleteRepository,
  touchRepository,
} from "@/lib/supabase/repositories";

export async function GET(
  _request: NextRequest,
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
    const repo = await getRepositoryById(id, user.id);
    if (!repo) {
      return NextResponse.json(
        { error: "Repository not found." },
        { status: 404 }
      );
    }

    // Update "last viewed" timestamp
    await touchRepository(id, user.id);

    return NextResponse.json({ repository: repo });
  } catch (err) {
    console.error("Get repo error:", err);
    return NextResponse.json(
      { error: "Failed to fetch repository." },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: NextRequest,
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
    await deleteRepository(id, user.id);

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Delete repo error:", err);
    return NextResponse.json(
      { error: "Failed to delete repository." },
      { status: 500 }
    );
  }
}