import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // output: "standalone", // disabled for stable preview serving
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
};

export default nextConfig;
