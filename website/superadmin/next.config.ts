import type { NextConfig } from "next";
import path from "node:path";
const workspace = path.resolve(process.cwd(), "..");
const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  transpilePackages: ["@edvio/shared"],
  outputFileTracingRoot: workspace,
  turbopack: {
    root: workspace,
  },
};
export default nextConfig;
