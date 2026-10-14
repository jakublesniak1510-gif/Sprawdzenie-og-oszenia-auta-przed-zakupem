import type { Metadata } from "next";
import { CouponResult } from "@/components/pakiet/CouponResult";

export const metadata: Metadata = { title: "Dziękujemy – Twój kod", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function PakietDziekujemy({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const sessionId = typeof sp.session_id === "string" && /^cs_[A-Za-z0-9_]{10,200}$/.test(sp.session_id) ? sp.session_id : null;
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-extrabold text-brand-900">Dziękujemy za zakup pakietu</h1>
      {sessionId ? (
        <CouponResult sessionId={sessionId} />
      ) : (
        <p className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-amber-900">
          Brak numeru płatności w adresie. Jeśli zapłaciłeś, kod znajdziesz w e-mailu – albo napisz do nas.
        </p>
      )}
    </div>
  );
}
