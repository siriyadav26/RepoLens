import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // output: "standalone", // disabled for stable preview serving

  typescript: {
    // TypeScript errors are now surfaced — keep code type-safe
    ignoreBuildErrors: false,
  },

  // Re-enable React strict mode for double-render safety checks
  reactStrictMode: true,

  // ── HTTP Security Headers ──────────────────────────────────────
  // Applied to all page responses. API routes also get these via
  // src/middleware.ts which runs at the edge.
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
          },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          { key: "X-DNS-Prefetch-Control", value: "on" },
        ],
      },
    ];
  },
};

export default nextConfig;
