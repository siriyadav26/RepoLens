import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getLatestEvolutionReport } from "@/lib/supabase/evolution";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { id } = await params;
    const report = await getLatestEvolutionReport(id, user.id);
    if (!report) return NextResponse.json({ report: null });
    return NextResponse.json({ report });
  } catch (err) {
    console.error("Evolution reports error:", err);
    return NextResponse.json({ error: "Failed to fetch report." }, { status: 500 });
  }
}