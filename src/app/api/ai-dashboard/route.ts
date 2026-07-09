// ================================================================
// API Route — AI Dashboard Overview + All Analytics
// Phase 11: AI Engineering Dashboard & Observability
// ================================================================

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  getDashboardOverview,
  getProviderStats,
  computeProviderHealth,
  getTokenAnalytics,
  getRAGAnalytics,
  getEmbeddingAnalytics,
  getPerformanceTimeline,
  getConversationAnalytics,
  getErrorLogs,
  getCostEstimates,
  getSystemHealth,
} from "@/lib/analytics/db";
import type { TimeGranularity } from "@/lib/analytics/types";

export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = user.id;
    const { searchParams } = new URL(request.url);
    const granularity = (searchParams.get("granularity") || "daily") as TimeGranularity;
    const days = parseInt(searchParams.get("days") || "30", 10);

    // Fetch all analytics in parallel
    const [
      overview,
      providerStats,
      tokenAnalytics,
      ragAnalytics,
      embeddingAnalytics,
      timeline,
      conversationAnalytics,
      errorLogs,
      costEstimates,
      systemHealth,
    ] = await Promise.all([
      getDashboardOverview(userId),
      getProviderStats(userId).then((s) => s.map(computeProviderHealth)),
      getTokenAnalytics(userId),
      getRAGAnalytics(userId),
      getEmbeddingAnalytics(userId),
      getPerformanceTimeline(userId, granularity, days),
      getConversationAnalytics(userId),
      getErrorLogs(userId, { limit: 100, days }),
      getCostEstimates(userId),
      getSystemHealth(userId),
    ]);

    return NextResponse.json({
      overview,
      providerStats,
      tokenAnalytics,
      ragAnalytics,
      embeddingAnalytics,
      timeline,
      conversationAnalytics,
      errorLogs,
      costEstimates,
      systemHealth,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    if (msg.includes("42P01") || msg.includes("ANALYTICS_TABLES_MISSING")) {
      return NextResponse.json(
        { error: "Analytics tables not found. Please run the Phase 11 SQL migration in Supabase.", code: "TABLES_MISSING" },
        { status: 503 }
      );
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}