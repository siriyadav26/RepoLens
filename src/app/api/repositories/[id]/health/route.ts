import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { computeMetrics } from "@/lib/health/metrics";
import { getRepositoryById } from "@/lib/supabase/repositories";
import { getLatestAnalysis, saveHealthReport } from "@/lib/supabase/health";
import { runAIAnalysis, generateReport } from "@/lib/health/analysis";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const cached = await getLatestAnalysis(id, user.id);

    // Always compute fresh metrics for live data
    const metrics = await computeMetrics(id, user.id);

    return NextResponse.json({
      metrics,
      cachedAnalysis: cached,
    });
  } catch (err) {
    console.error("Health metrics error:", err);
    return NextResponse.json({ error: "Failed to compute metrics." }, { status: 500 });
  }
}

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const repository = await getRepositoryById(id, user.id);
    if (!repository) return NextResponse.json({ error: "Repository not found" }, { status: 404 });

    // 1. Compute deterministic metrics
    const metrics = await computeMetrics(id, user.id);

    if (metrics.totalCommits === 0) {
      return NextResponse.json(
        { error: "INSUFFICIENT_DATA: No commits found. Import commits first." },
        { status: 422 }
      );
    }

    // 2. Run AI analysis
    const analysis = await runAIAnalysis(user.id, repository, metrics);

    // 3. Generate report markdown
    const reportMarkdown = await generateReport(repository, metrics, analysis);

    // 4. Save to DB
    const report = await saveHealthReport(user.id, id, metrics.scores, metrics, analysis, reportMarkdown);

    return NextResponse.json({ report, metrics }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Analysis failed";
    console.error("Health analyze error:", err);

    if (message.startsWith("INSUFFICIENT_")) {
      return NextResponse.json({ error: message }, { status: 422 });
    }
    if (message.startsWith("RATE_LIMITED")) {
      return NextResponse.json({ error: message }, { status: 429 });
    }
    if (message.includes("HEALTH_TABLE_MISSING")) {
      return NextResponse.json(
        { error: "Health table not found. Run the Phase 9 SQL migration." },
        { status: 500 }
      );
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}