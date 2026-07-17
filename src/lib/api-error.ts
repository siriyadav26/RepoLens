// ================================================================
// Safe API Error Handler
// Strips internal details from 500 responses sent to clients while
// preserving full stack traces in server-side logs.
// ================================================================

import { NextResponse } from "next/server";

/** Known safe error codes that can be surfaced to the client */
const SAFE_ERROR_CODES = new Set([
  "TABLES_MISSING",
  "CROSS_REPO_TABLES_MISSING",
  "ANALYTICS_TABLES_MISSING",
  "REPO_TABLE_MISSING",
]);

/** Internal Postgres/Supabase patterns that must not leak to clients */
const INTERNAL_PATTERNS = [
  /42P01/,        // relation does not exist
  /23505/,        // unique violation
  /23503/,        // foreign key violation
  /password/i,
  /secret/i,
  /token/i,
  /key/i,
  /supabase/i,
  /postgresql/i,
  /PGRST/,
];

function isSafeMessage(msg: string): boolean {
  return !INTERNAL_PATTERNS.some((pattern) => pattern.test(msg));
}

/**
 * Maps known Postgres/Supabase error codes to user-friendly messages.
 */
function mapKnownError(msg: string): { message: string; code?: string } | null {
  if (msg.includes("42P01") || msg.includes("CROSS_REPO_TABLES_MISSING")) {
    return {
      message: "Cross-repo tables not found. Run the Phase 12 SQL migration.",
      code: "CROSS_REPO_TABLES_MISSING",
    };
  }
  if (msg.includes("ANALYTICS_TABLES_MISSING")) {
    return {
      message: "Analytics tables not found. Run the Phase 11 SQL migration.",
      code: "ANALYTICS_TABLES_MISSING",
    };
  }
  if (msg.includes("REPO_TABLE_MISSING")) {
    return {
      message:
        "The repositories table has not been set up. Run create-repositories-table.sql in Supabase.",
      code: "REPO_TABLE_MISSING",
      setupRequired: true,
    } as { message: string; code: string; setupRequired?: boolean };
  }
  return null;
}

type SafeErrorOptions = {
  /** Force a specific HTTP status code */
  status?: number;
  /** Log a prefix for easier grep in server logs */
  context?: string;
};

/**
 * Create a safe JSON error response.
 * - Logs the full error server-side
 * - Returns only safe, generic messages to the client
 */
export function safeErrorResponse(
  error: unknown,
  options: SafeErrorOptions = {}
): NextResponse {
  const { status = 500, context = "API" } = options;

  // Full logging server-side
  console.error(`[${context}] Error:`, error);

  const msg = error instanceof Error ? error.message : String(error);

  // Check for known mappable errors (503 level)
  const known = mapKnownError(msg);
  if (known) {
    return NextResponse.json(known, { status: 503 });
  }

  // If the message is considered safe, pass it through at the given status
  if (status < 500 && isSafeMessage(msg)) {
    return NextResponse.json({ error: msg }, { status });
  }

  // For 5xx errors, never expose internals
  return NextResponse.json(
    { error: "An unexpected error occurred. Please try again later." },
    { status }
  );
}

/**
 * Validate that a string parameter is within an allowlist.
 * Returns the valid value or the fallback.
 */
export function validateEnum<T extends string>(
  value: string | null,
  allowlist: readonly T[],
  fallback: T
): T {
  if (value && (allowlist as readonly string[]).includes(value)) {
    return value as T;
  }
  return fallback;
}

/**
 * Clamp a numeric query param within [min, max].
 */
export function clampInt(
  value: string | null,
  min: number,
  max: number,
  fallback: number
): number {
  const parsed = parseInt(value ?? "", 10);
  if (isNaN(parsed)) return fallback;
  return Math.max(min, Math.min(max, parsed));
}

/**
 * Validate that a list of strings are well-formed UUIDs.
 * Returns null if any entry is invalid.
 */
export function validateUUIDs(ids: string[]): string | null {
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  for (const id of ids) {
    if (!uuidRegex.test(id)) {
      return `Invalid ID format: "${id}"`;
    }
  }
  return null;
}
