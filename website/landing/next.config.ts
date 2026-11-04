import type { NextConfig } from "next";
import path from "node:path";
const workspace = path.resolve(process.cwd(), "..");
const nextConfig: NextConfig = {
  output: "export",
  images: { unoptimized: true },
  transpilePackages: ["@edvio/shared"],
  outputFileTracingRoot: workspace,
  turbopack: {
    root: workspace,
  },
};
export default nextConfig;
