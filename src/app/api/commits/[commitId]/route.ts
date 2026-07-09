import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCommitById } from "@/lib/supabase/commits";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ commitId: string }> }
) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { commitId } = await params;
    const commit = await getCommitById(commitId, user.id);

    if (!commit) {
      return NextResponse.json(
        { error: "Commit not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ commit });
  } catch (err) {
    console.error("Get commit detail error:", err);
    return NextResponse.json(
      { error: "Failed to fetch commit." },
      { status: 500 }
    );
  }
}