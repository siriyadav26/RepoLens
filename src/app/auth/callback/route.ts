import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/** Validate that a redirect path is a safe same-origin relative URL */
function isSafeRedirectPath(path: string): boolean {
  // Must be a non-empty string starting with / but not //
  // // would allow protocol-relative URLs like //evil.com
  if (!path || !path.startsWith("/") || path.startsWith("//")) return false;
  // Must not contain :// anywhere (prevents http://, javascript://, etc.)
  if (path.includes("://")) return false;
  return true;
}

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const nextParam = searchParams.get("next") ?? "/dashboard";

  // ── Open Redirect Prevention ──────────────────────────────────
  // Validate that `next` is a safe same-origin relative path.
  const next = isSafeRedirectPath(nextParam) ? nextParam : "/dashboard";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  // Return the user to an error page with instructions
  return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`);
}