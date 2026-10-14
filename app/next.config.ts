import type { NextConfig } from "next";
import path from "node:path";

const isDev = process.env.NODE_ENV !== "production";

/**
 * Content-Security-Policy. Next.js wstrzykuje skrypty inline (hydratacja), a Tailwind/React używają stylów inline,
 * więc 'unsafe-inline' dla script/style (bez nonce – strony są w większości statyczne). W dev dodatkowo 'unsafe-eval' (HMR).
 * Zdjęcia w formularzu: podgląd z data:/blob:. Płatności: przekierowanie do checkout.stripe.com (nawigacja, nie fetch).
 */
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  `connect-src 'self'${isDev ? " ws: wss:" : ""}`,
  "frame-src 'none'",
  "frame-ancestors 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self' https://checkout.stripe.com",
  ...(isDev ? [] : ["upgrade-insecure-requests"]),
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()" },
  ...(isDev ? [] : [{ key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" }]),
];

const nextConfig: NextConfig = {
  // Docker: samodzielny serwer w .next/standalone (patrz Dockerfile).
  output: "standalone",
  // better-sqlite3 to moduł natywny – nie bundlujemy go.
  serverExternalPackages: ["better-sqlite3"],
  // Repo ma katalogi data/ i docs/ poziom wyżej – ustawiamy root, żeby Next nie zgadywał.
  outputFileTracingRoot: path.join(process.cwd(), ".."),
  turbopack: { root: path.join(process.cwd(), "..") },
  poweredByHeader: false,
  experimental: {
    // Akcje serwerowe przyjmują tylko małe formularze (opinia, ponowienie) – zdjęcia idą przez POST /api/reports.
    serverActions: { bodySizeLimit: "100kb" },
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
