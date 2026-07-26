import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // E2E builds use their own dist dir (.next-e2e) so `npm run test:e2e`
  // never clobbers a running `next dev`'s .next.
  distDir: process.env.NEXT_DIST_DIR || ".next",
};

export default nextConfig;
