import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

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

    // Fetch all commits for the repository
    const { data: commitData, error } = await supabase
      .from("commits")
      .select(
        "sha, message, author_name, author_login, author_avatar, committed_date, additions, deletions, files_changed, commit_url"
      )
      .eq("user_id", user.id)
      .eq("repository_id", id)
      .order("committed_date", { ascending: false });

    if (error) {
      if (error.code === "42P01") {
        return NextResponse.json(buildEmptyResponse());
      }
      throw new Error(`Failed to fetch commits: ${error.message}`);
    }

    if (!commitData || commitData.length === 0) {
      return NextResponse.json(buildEmptyResponse());
    }

    const totalCommits = commitData.length;

    // First & last commit dates
    const firstCommitDate =
      commitData[commitData.length - 1].committed_date ?? null;
    const lastCommitDate = commitData[0].committed_date ?? null;

    // ── Commits per day (last 30 days) ───────────────────────────
    const now = new Date();
    const thirtyDaysAgo = new Date(now);
    thirtyDaysAgo.setDate(now.getDate() - 29);

    const dayMap = new Map<string, number>();
    for (let i = 0; i < 30; i++) {
      const d = new Date(thirtyDaysAgo);
      d.setDate(thirtyDaysAgo.getDate() + i);
      dayMap.set(d.toISOString().slice(0, 10), 0);
    }
    for (const c of commitData) {
      const day = c.committed_date.slice(0, 10);
      if (dayMap.has(day)) {
        dayMap.set(day, (dayMap.get(day) ?? 0) + 1);
      }
    }
    const commitsPerDay = Array.from(dayMap.entries()).map(([date, count]) => ({
      date,
      count,
    }));

    // ── Commits per week (last 12 weeks) ────────────────────────
    const twelveWeeksAgo = new Date(now);
    twelveWeeksAgo.setDate(now.getDate() - 7 * 12);

    const weekMap = new Map<string, number>();
    for (let i = 0; i < 12; i++) {
      const weekStart = new Date(twelveWeeksAgo);
      weekStart.setDate(twelveWeeksAgo.getDate() + i * 7);
      const key = weekStart.toISOString().slice(0, 10);
      weekMap.set(key, 0);
    }
    for (const c of commitData) {
      const d = new Date(c.committed_date);
      if (d < twelveWeeksAgo) continue;
      const weekStart = new Date(d);
      const dayOfWeek = weekStart.getDay();
      weekStart.setDate(weekStart.getDate() - dayOfWeek);
      const key = weekStart.toISOString().slice(0, 10);
      // Find nearest seeded week
      const keys = Array.from(weekMap.keys());
      const nearest = keys.reduce((prev, curr) =>
        Math.abs(new Date(curr).getTime() - new Date(key).getTime()) <
        Math.abs(new Date(prev).getTime() - new Date(key).getTime())
          ? curr
          : prev
      );
      weekMap.set(nearest, (weekMap.get(nearest) ?? 0) + 1);
    }
    const commitsPerWeek = Array.from(weekMap.entries()).map(
      ([week, count]) => ({ week, count })
    );

    // ── Contributor distribution ─────────────────────────────────
    const authorMap = new Map<
      string,
      { name: string; login: string | null; avatar: string | null; count: number }
    >();
    for (const c of commitData) {
      const key = c.author_login || c.author_name;
      const existing = authorMap.get(key);
      if (existing) {
        existing.count++;
      } else {
        authorMap.set(key, {
          name: c.author_name,
          login: c.author_login ?? null,
          avatar: c.author_avatar ?? null,
          count: 1,
        });
      }
    }
    const contributors = Array.from(authorMap.values()).sort(
      (a, b) => b.count - a.count
    );

    // ── Latest 50 commits ────────────────────────────────────────
    const latestCommits = commitData.slice(0, 50).map((c) => ({
      sha: c.sha,
      message: c.message ?? "",
      author_name: c.author_name,
      author_login: c.author_login ?? null,
      author_avatar: c.author_avatar ?? null,
      committed_date: c.committed_date,
      additions: c.additions ?? 0,
      deletions: c.deletions ?? 0,
      files_changed: c.files_changed ?? 0,
      commit_url: c.commit_url ?? null,
    }));

    return NextResponse.json({
      totalCommits,
      firstCommitDate,
      lastCommitDate,
      commitsPerDay,
      commitsPerWeek,
      contributors,
      latestCommits,
    });
  } catch (err) {
    console.error("Timeline API error:", err);
    return NextResponse.json(
      { error: "Failed to fetch timeline data." },
      { status: 500 }
    );
  }
}

function buildEmptyResponse() {
  return {
    totalCommits: 0,
    firstCommitDate: null,
    lastCommitDate: null,
    commitsPerDay: [],
    commitsPerWeek: [],
    contributors: [],
    latestCommits: [],
  };
}
