import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  parseRepoInput,
  validateRepoInput,
  fetchGitHubRepo,
  GitHubAPIError,
} from "@/lib/github";
import { saveRepository } from "@/lib/supabase/repositories";

export async function POST(request: NextRequest) {
  try {
    // Authenticate user
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Parse request body
    const body = await request.json();
    const { input } = body as { input?: string };

    if (!input || typeof input !== "string") {
      return NextResponse.json(
        { error: "Repository input is required." },
        { status: 400 }
      );
    }

    // Parse input
    const parsed = parseRepoInput(input);
    if (!parsed) {
      return NextResponse.json(
        {
          error:
            'Invalid format. Use "owner/repo" or "https://github.com/owner/repo".',
        },
        { status: 400 }
      );
    }

    // Validate
    const validationError = validateRepoInput(parsed);
    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 });
    }

    // Fetch from GitHub
    const githubRepo = await fetchGitHubRepo(parsed.owner, parsed.repo);

    // Save to Supabase
    const saved = await saveRepository(user.id, githubRepo);

    return NextResponse.json({
      success: true,
      repository: saved,
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

    if (err instanceof Error && err.message === "REPO_TABLE_MISSING") {
      return NextResponse.json(
        {
          error:
            "The repositories table has not been set up yet. Please run the SQL in scripts/create-repositories-table.sql in your Supabase SQL Editor.",
          setupRequired: true,
        },
        { status: 503 }
      );
    }

    console.error("Import error:", err);
    return NextResponse.json(
      { error: "An unexpected error occurred. Please try again." },
      { status: 500 }
    );
  }
}