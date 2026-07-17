// ================================================================
// Next.js Root Proxy — Edge Security Layer (Next.js 16+)
// Renamed from middleware.ts → proxy.ts per Next.js 16 convention.
// Runs on EVERY request before any route handler.
// Handles: auth enforcement + security response headers
// ================================================================

import { type NextRequest, NextResponse } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function proxy(request: NextRequest) {
  // Run Supabase session refresh + route protection
  const response = await updateSession(request);

  // ── Security Headers ─────────────────────────────────────────
  // These are applied to every response, regardless of route.
  // (Headers in next.config.ts only cover page routes; this proxy
  //  covers API routes and all other responses too.)

  const headers = response.headers;

  // Prevent clickjacking
  headers.set("X-Frame-Options", "DENY");

  // Prevent MIME-type sniffing
  headers.set("X-Content-Type-Options", "nosniff");

  // Control referrer information
  headers.set("Referrer-Policy", "strict-origin-when-cross-origin");

  // Disable browser features not needed by this app
  headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=(), payment=(), usb=()"
  );

  // DNS prefetch control
  headers.set("X-DNS-Prefetch-Control", "on");

  // Force HTTPS (only effective over HTTPS; safe to set always)
  headers.set(
    "Strict-Transport-Security",
    "max-age=63072000; includeSubDomains; preload"
  );

  // Content-Security-Policy
  // Allows: self, Supabase, GitHub avatars, Google Fonts, Groq (server-side only)
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const supabaseHost = supabaseUrl ? new URL(supabaseUrl).host : "*.supabase.co";

  const csp = [
    "default-src 'self'",
    // Next.js requires 'unsafe-inline' for its inline scripts and styles.
    // 'unsafe-eval' is needed in development by React Fast Refresh.
    `script-src 'self' 'unsafe-inline'${process.env.NODE_ENV === "development" ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    // Allow images from GitHub avatars + data URIs + same origin
    "img-src 'self' data: blob: https://avatars.githubusercontent.com https://raw.githubusercontent.com",
    // Allow XHR/fetch to Supabase, GitHub API
    `connect-src 'self' https://${supabaseHost} https://api.github.com wss://${supabaseHost}`,
    // No frames allowed
    "frame-src 'none'",
    "frame-ancestors 'none'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "upgrade-insecure-requests",
  ].join("; ");

  headers.set("Content-Security-Policy", csp);

  return response;
}

// Apply proxy to all routes except Next.js internals and static files
export const config = {
  matcher: [
    /*
     * Match all request paths EXCEPT:
     * - _next/static  (static files)
     * - _next/image   (image optimization)
     * - favicon.ico, robots.txt, sitemap.xml
     * - public folder files (images, fonts, etc.)
     */
    "/((?!_next/static|_next/image|favicon\\.ico|robots\\.txt|sitemap\\.xml|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff|woff2|ttf|eot)).*)",
  ],
};
