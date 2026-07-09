import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getRepositoryById } from "@/lib/supabase/repositories";
import {
  fetchGitHubCommits,
  GitHubAPIError,
} from "@/lib/github";
import {
  saveCommits,
  githubCommitToDbRow,
} from "@/lib/supabase/commits";

export async function POST(
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
    const repo = await getRepositoryById(id, user.id);
    if (!repo) {
      return NextResponse.json({ error: "Repository not found" }, { status: 404 });
    }

    const body = await request.json().catch(() => ({}));
    const maxPages: number = body.maxPages ?? 3;
    const perPage: number = body.perPage ?? 30;
    const branch: string = body.branch || repo.default_branch || "main";

    const [owner, repoName] = repo.full_name.split("/");

    let allCommits: Awaited<ReturnType<typeof fetchGitHubCommits>>["commits"] = [];
    let page = 1;
    let hasMore = true;
    let totalSaved = 0;

    while (hasMore && page <= maxPages) {
      const result = await fetchGitHubCommits(owner, repoName, {
        page,
        perPage,
        sha: branch,
      });

      allCommits = allCommits.concat(result.commits);
      hasMore = result.hasMore;
      page++;
    }

    if (allCommits.length === 0) {
      return NextResponse.json({
        success: true,
        imported: 0,
        message: "No commits found for this repository.",
      });
    }

    const dbRows = allCommits.map((c) =>
      githubCommitToDbRow(c, user.id, repo.id, branch)
    );

    totalSaved = await saveCommits(dbRows, user.id);

    return NextResponse.json({
      success: true,
      imported: totalSaved,
      fetched: allCommits.length,
      hasMore: page <= maxPages ? false : hasMore,
      message: `Imported ${totalSaved} commits from ${repo.full_name}.`,
    });
  } catch (err) {
    if (err instanceof GitHubAPIError) {
      return NextResponse.json(
        {
          error: err.message,
          isRateLimit: err.isRateLimit,
          retryAfter: err.retryAfter,
        },
        { status: err.status }
      );
    }

    if (err instanceof Error && err.message === "COMMIT_TABLE_MISSING") {
      return NextResponse.json(
        {
          error: "Commits table not set up. Please run the SQL in scripts/create-commits-table.sql in your Supabase SQL Editor.",
          setupRequired: true,
        },
        { status: 503 }
      );
    }

    console.error("Import commits error:", err);
    return NextResponse.json(
      { error: "Failed to import commits." },
      { status: 500 }
    );
  }
}