import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getUserRepositories } from "@/lib/supabase/repositories";

export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const repos = await getUserRepositories(user.id);
    return NextResponse.json({ repositories: repos });
  } catch (err) {
    console.error("List repos error:", err);
    return NextResponse.json(
      { error: "Failed to fetch repositories." },
      { status: 500 }
    );
  }
}