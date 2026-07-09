// ================================================================
// API Route — AI Dashboard Report Generation & Export
// Phase 11: AI Engineering Dashboard & Observability
// ================================================================

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generateEngineeringReport, exportReportAsMarkdown, exportReportAsText } from "@/lib/analytics/db";
import type { ExportFormat } from "@/lib/analytics/types";

export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const format = (searchParams.get("format") || "json") as ExportFormat | "json";

    const report = await generateEngineeringReport(user.id);

    if (format === "markdown") {
      const md = exportReportAsMarkdown(report);
      return new NextResponse(md, {
        headers: {
          "Content-Type": "text/markdown; charset=utf-8",
          "Content-Disposition": `attachment; filename="ai-engineering-report-${new Date().toISOString().slice(0, 10)}.md"`,
        },
      });
    }

    if (format === "text") {
      const txt = exportReportAsText(report);
      return new NextResponse(txt, {
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          "Content-Disposition": `attachment; filename="ai-engineering-report-${new Date().toISOString().slice(0, 10)}.txt"`,
        },
      });
    }

    return NextResponse.json(report);
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}