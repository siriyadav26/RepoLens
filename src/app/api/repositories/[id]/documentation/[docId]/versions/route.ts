import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getDocumentVersions } from "@/lib/supabase/documentation";

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

    const { docId } = await params;
    const versions = await getDocumentVersions(docId, user.id);

    return NextResponse.json({ versions });
  } catch (err) {
    console.error("Get versions error:", err);
    return NextResponse.json({ error: "Failed to fetch versions." }, { status: 500 });
  }
}