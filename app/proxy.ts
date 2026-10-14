import { NextResponse, type NextRequest } from "next/server";
import { adminConfigured, checkBasicAuth } from "./lib/admin-auth";

/**
 * Next.js 16 „proxy” (dawniej middleware.ts – w Next 16 przemianowane). Chroni /admin Basic Auth:
 * - brak ADMIN_USER/ADMIN_PASSWORD → 404 (panel nie istnieje),
 * - zły lub brak nagłówka → 401 z WWW-Authenticate.
 */
export function proxy(req: NextRequest) {
  if (!adminConfigured()) return new NextResponse("Not found", { status: 404 });
  if (!checkBasicAuth(req.headers.get("authorization"))) {
    return new NextResponse("Wymagane logowanie", {
      status: 401,
      headers: { "WWW-Authenticate": 'Basic realm="Panel admina", charset="UTF-8"', "Cache-Control": "no-store" },
    });
  }
  const res = NextResponse.next();
  res.headers.set("Cache-Control", "no-store");
  res.headers.set("X-Robots-Tag", "noindex, nofollow");
  return res;
}

export const config = {
  matcher: ["/admin", "/admin/:path*"],
};
