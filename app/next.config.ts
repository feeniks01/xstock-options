import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  experimental: {
    // Skip static generation for mock page
    serverActions: {
      bodySizeLimit: '2mb',
    },
  },
};

export default nextConfig;
