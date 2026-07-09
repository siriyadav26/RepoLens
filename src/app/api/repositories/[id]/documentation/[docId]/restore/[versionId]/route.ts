import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { restoreVersion } from "@/lib/supabase/documentation";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; docId: string; versionId: string }> }
) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { docId, versionId } = await params;
    const document = await restoreVersion(docId, versionId, user.id);

    return NextResponse.json({ document });
  } catch (err) {
    console.error("Restore version error:", err);
    return NextResponse.json({ error: "Failed to restore version." }, { status: 500 });
  }
}