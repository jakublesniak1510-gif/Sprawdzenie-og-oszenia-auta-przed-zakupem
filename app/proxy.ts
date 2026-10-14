import { NextResponse, type NextRequest } from "next/server";
import { adminConfigured, checkBasicAuth } from "./lib/admin-auth";
import { clientIpFromHeaders, peekToken, takeToken, tooManyRequests } from "./lib/rate-limit";

/**
 * Next.js 16 „proxy” (dawniej middleware.ts – w Next 16 przemianowane; domyślnie runtime Node.js). Chroni /admin Basic Auth:
 * - brak ADMIN_USER/ADMIN_PASSWORD → 404 (panel nie istnieje),
 * - zły lub brak nagłówka → 401 z WWW-Authenticate; nieudane próby z błędnym hasłem: limit 10 / 10 min / IP (potem 429).
 */
export function proxy(req: NextRequest) {
  if (!adminConfigured()) return new NextResponse("Not found", { status: 404 });
  const auth = req.headers.get("authorization");
  const ip = clientIpFromHeaders(req.headers);
  // Po 10 błędnych hasłach blokujemy na czas odnowienia limitu – także poprawne (inaczej brute force dalej działa).
  const blocked = auth ? peekToken("adminAuthFail", ip) : 0;
  if (blocked > 0) return tooManyRequests(blocked);
  if (!checkBasicAuth(auth)) {
    // Liczymy tylko próby z podanym hasłem (pierwsze wejście bez nagłówka to normalne pytanie przeglądarki).
    if (auth) takeToken("adminAuthFail", ip);
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
