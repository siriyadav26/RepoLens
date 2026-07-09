import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAnalysisHistory } from "@/lib/supabase/health";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const limit = parseInt(request.nextUrl.searchParams.get("limit") || "20");
    const reports = await getAnalysisHistory(id, user.id, limit);

    return NextResponse.json({ reports });
  } catch (err) {
    console.error("Health reports error:", err);
    return NextResponse.json({ error: "Failed to fetch reports." }, { status: 500 });
  }
}