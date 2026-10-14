/**
 * IP klienta: pierwszy element `x-forwarded-for` (albo `x-real-ip`), ale TYLKO gdy TRUST_PROXY=1
 * (aplikacja za Caddy/nginx, które ten nagłówek ustawiają). Bez TRUST_PROXY nagłówek może podrobić każdy,
 * więc zwracamy wspólne „local”.
 */
export function clientIp(req: Request): string {
  if (process.env.TRUST_PROXY === "1") {
    const xff = req.headers.get("x-forwarded-for");
    const first = xff?.split(",")[0]?.trim();
    if (first) return first;
    const real = req.headers.get("x-real-ip")?.trim();
    if (real) return real;
  }
  return "local";
}
