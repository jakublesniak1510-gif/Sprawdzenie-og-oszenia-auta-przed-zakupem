/**
 * Ręczne kupony (np. dla influencerów).
 *
 *   npm run coupon -- create --uses 5 --days 365 [--offer raport|raport_plus|any] [--count 1] [--note influencer-x]
 *   npm run coupon -- list
 *
 * Kod: 8 znaków bez mylących liter (0/O, 1/I/L). Klient wpisuje go w formularzu – raport bez płatności.
 */
import { createCoupon, formatCouponCode, listCoupons, type CouponOffer } from "../lib/coupons";

function arg(args: string[], name: string, def?: string): string | undefined {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] !== undefined ? args[i + 1] : def;
}

function usage(): never {
  console.log(`Użycie:
  npm run coupon -- create --uses 5 --days 365 [--offer raport|raport_plus|any] [--count 1] [--note opis]
  npm run coupon -- list`);
  process.exit(1);
}

function main(argv: string[]) {
  const [cmd, ...args] = argv;
  if (cmd === "list") {
    for (const c of listCoupons(200)) {
      console.log(`${formatCouponCode(c.code)}  pozostało ${c.uses_left}, użyto ${c.uses_total}, ${c.offer}, do ${c.expires_at.slice(0, 10)}, ${c.source}`);
    }
    return;
  }
  if (cmd !== "create") usage();
  const uses = Number(arg(args, "uses", "5"));
  const days = Number(arg(args, "days", "365"));
  const count = Number(arg(args, "count", "1"));
  const offer = arg(args, "offer", "raport") as CouponOffer;
  if (!["raport", "raport_plus", "any"].includes(offer)) usage();
  if (!Number.isInteger(uses) || uses < 1 || !(days > 0) || !Number.isInteger(count) || count < 1 || count > 1000) usage();
  const note = arg(args, "note");
  for (let i = 0; i < count; i++) {
    const c = createCoupon({ uses, days, offer, source: note ? `manual:${note}` : "manual" });
    console.log(`${formatCouponCode(c.code)}  (${uses} użyć, ${offer}, ważny do ${c.expires_at.slice(0, 10)})`);
  }
}

main(process.argv.slice(2));
