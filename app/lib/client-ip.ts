/**
 * IP klienta. Nagłówkom ufamy TYLKO przy TRUST_PROXY=1 (aplikacja za naszym Caddy/nginx):
 * 1. `X-Real-IP` (Caddy: `header_up X-Real-IP {client_ip}` – ustawia go nasze proxy, klient nie może go podrobić),
 * 2. OSTATNI element `X-Forwarded-For` (dopisany przez nasze proxy; wcześniejsze elementy może podać klient).
 * Bez TRUST_PROXY zwracamy wspólne „local” (wszyscy dzielą limity).
 */
export function clientIpFromHeaders(h: Headers): string {
  if (process.env.TRUST_PROXY === "1") {
    const real = h.get("x-real-ip")?.trim();
    if (real) return real;
    const last = h.get("x-forwarded-for")?.split(",").map((s) => s.trim()).filter(Boolean).at(-1);
    if (last) return last;
  }
  return "local";
}

export function clientIp(req: Request): string {
  return clientIpFromHeaders(req.headers);
}

/** Rozwija adres IPv6 do 8 grup (bez stref i mapowania IPv4 → zwraca IPv4). */
function expandIpv6(ip: string): string[] | null {
  const addr = ip.replace(/^\[|\]$/g, "").split("%")[0];
  const v4 = /::ffff:(\d+\.\d+\.\d+\.\d+)$/i.exec(addr);
  if (v4) return null;
  const [head, tail] = addr.split("::");
  const h = head ? head.split(":") : [];
  const t = tail !== undefined ? (tail ? tail.split(":") : []) : [];
  if (tail === undefined && h.length !== 8) return null;
  const groups = [...h, ...Array(Math.max(0, 8 - h.length - t.length)).fill("0"), ...t];
  return groups.length === 8 ? groups.map((g) => g.toLowerCase().padStart(4, "0")) : null;
}

/**
 * Klucz do limitów: IPv4 bez zmian, IPv6 – prefiks /64 (jeden klient zwykle dostaje całą podsieć /64,
 * więc limit per pojedynczy adres łatwo obejść). „::ffff:1.2.3.4” → „1.2.3.4”.
 */
export function ipKey(ip: string): string {
  if (!ip.includes(":")) return ip;
  const mapped = /::ffff:(\d+\.\d+\.\d+\.\d+)$/i.exec(ip);
  if (mapped) return mapped[1];
  const g = expandIpv6(ip);
  return g ? `${g.slice(0, 4).join(":")}::/64` : ip;
}
