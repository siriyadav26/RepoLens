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
import { checkRateLimit, generalLimit } from "@/lib/rate-limit";
import { safeErrorResponse, clampInt, validateEnum } from "@/lib/api-error";

const VALID_GRANULARITIES = ["daily", "weekly", "monthly"] as const;

export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // ── Rate Limiting ─────────────────────────────────────────────
    const limited = checkRateLimit(user.id, "ai-dashboard", generalLimit);
    if (limited) return limited;

    const userId = user.id;
    const { searchParams } = new URL(request.url);

    // ── Input Validation ──────────────────────────────────────────
    const granularity = validateEnum<TimeGranularity>(
      searchParams.get("granularity"),
      VALID_GRANULARITIES,
      "daily"
    );
    const days = clampInt(searchParams.get("days"), 1, 365, 30);

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
    return safeErrorResponse(error, { context: "AI Dashboard" });
  }
}