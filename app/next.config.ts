import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  // better-sqlite3 to moduł natywny – nie bundlujemy go.
  serverExternalPackages: ["better-sqlite3"],
  // Repo ma katalogi data/ i docs/ poziom wyżej – ustawiamy root, żeby Next nie zgadywał.
  outputFileTracingRoot: path.join(process.cwd(), ".."),
  turbopack: { root: path.join(process.cwd(), "..") },
  poweredByHeader: false,
  experimental: {
    serverActions: { bodySizeLimit: "12mb" },
  },
};

export default nextConfig;
