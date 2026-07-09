import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { computeEvolutionMetrics } from "@/lib/evolution/metrics";
import { getRepositoryById } from "@/lib/supabase/repositories";
import { runArchitectureAnalysis, generateEvolutionReport } from "@/lib/evolution/analysis";
import { saveEvolutionReport, getLatestEvolutionReport } from "@/lib/supabase/evolution";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { id } = await params;
    const metrics = await computeEvolutionMetrics(id, user.id);
    const cached = await getLatestEvolutionReport(id, user.id);
    return NextResponse.json({ metrics, cachedSummary: cached?.aiSummary ?? null, cachedReport: cached?.reportMarkdown ?? null });
  } catch (err) {
    console.error("Evolution GET error:", err);
    return NextResponse.json({ error: "Failed to compute evolution." }, { status: 500 });
  }
}

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { id } = await params;
    const repo = await getRepositoryById(id, user.id);
    if (!repo) return NextResponse.json({ error: "Repository not found" }, { status: 404 });
    const metrics = await computeEvolutionMetrics(id, user.id);
    if (metrics.totalCommits === 0) {
      return NextResponse.json({ error: "INSUFFICIENT_DATA: No commits. Import first." }, { status: 422 });
    }
    const aiSummary = await runArchitectureAnalysis(user.id, repo, metrics);
    const reportMarkdown = await generateEvolutionReport(repo, metrics, aiSummary);
    const report = await saveEvolutionReport(user.id, id, aiSummary, reportMarkdown);
    return NextResponse.json({ metrics, report, aiSummary }, { status: 201 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Analysis failed";
    console.error("Evolution POST error:", err);
    if (msg.startsWith("INSUFFICIENT_")) return NextResponse.json({ error: msg }, { status: 422 });
    if (msg.startsWith("RATE_LIMITED")) return NextResponse.json({ error: msg }, { status: 429 });
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}