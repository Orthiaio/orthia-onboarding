import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  outputFileTracingExcludes: {
    "*": ["**/@swc/core*", "**/@esbuild*"],
  },
};

export default nextConfig;
