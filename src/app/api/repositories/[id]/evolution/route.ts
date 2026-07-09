import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getRepoEvolutionStats } from "@/lib/supabase/commits";

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
    const stats = await getRepoEvolutionStats(id, user.id);

    return NextResponse.json(stats);
  } catch (err) {
    console.error("Evolution stats error:", err);
    return NextResponse.json(
      { error: "Failed to fetch evolution stats." },
      { status: 500 }
    );
  }
}