import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  getCommitsByRepoId,
  getCommitAuthors,
  CommitsFilter,
} from "@/lib/supabase/commits";

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

    const filter: CommitsFilter = {
      page: parseInt(searchParams.get("page") || "1"),
      perPage: parseInt(searchParams.get("perPage") || "20"),
      sort: (searchParams.get("sort") as "newest" | "oldest") || "newest",
      author: searchParams.get("author") || undefined,
      since: searchParams.get("since") || undefined,
      until: searchParams.get("until") || undefined,
      search: searchParams.get("search") || undefined,
    };

    const result = await getCommitsByRepoId(id, user.id, filter);

    // Fetch authors for filter dropdown
    const authors = await getCommitAuthors(id, user.id);

    return NextResponse.json({
      commits: result.commits,
      total: result.total,
      page: result.page,
      perPage: result.perPage,
      hasMore: result.hasMore,
      authors,
    });
  } catch (err) {
    console.error("List commits error:", err);
    return NextResponse.json(
      { error: "Failed to fetch commits." },
      { status: 500 }
    );
  }
}