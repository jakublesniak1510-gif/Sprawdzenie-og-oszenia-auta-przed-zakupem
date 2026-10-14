import type { Metadata } from "next";
import { CheckForm } from "@/components/CheckForm";
import { offers, packageOffer, paymentsSkipped } from "@/lib/payments";

export const metadata: Metadata = {
  title: "Pełny raport – sprawdź ogłoszenie auta",
  description: "Zamów pełny raport z analizy ogłoszenia: czerwone flagi, przebiegi z CEPiK, typowe usterki z kosztami, pytania do sprzedawcy i checklista oględzin.",
  alternates: { canonical: "/sprawdz" },
};
export const dynamic = "force-dynamic";

const OFFER_IDS = ["raport", "raport_plus", "pakiet5"] as const;

export default async function SprawdzPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const initialOffer = OFFER_IDS.find((o) => o === sp.oferta) ?? null;
  const initialCoupon = typeof sp.kupon === "string" ? sp.kupon.slice(0, 20) : "";
  const p = packageOffer();
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-extrabold text-brand-900">Pełny raport</h1>
        <p className="text-sm text-slate-700">4 krótkie kroki. Wymagany jest tylko tekst ogłoszenia.</p>
      </div>
      {sp.wygaslo === "1" && (
        <p className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900" role="status">
          Ten raport wygasł lub został usunięty (przechowujemy je 30 dni). Możesz przygotować nowy.
        </p>
      )}
      {paymentsSkipped() && (
        <p className="rounded-lg border border-fuchsia-300 bg-fuchsia-50 p-2 text-xs text-fuchsia-900">
          Tryb testowy: płatność wyłączona (DEV_SKIP_PAYMENT=1){process.env.AI_MOCK === "1" ? ", raport z atrapy AI (AI_MOCK=1)" : ""}.
        </p>
      )}
      <CheckForm
        offers={offers()}
        skipPayment={paymentsSkipped()}
        cancelled={sp.anulowano === "1"}
        initialOffer={initialOffer}
        initialCoupon={initialCoupon}
        pkg={{ nazwa: p.nazwa, cenaGr: p.cenaGr, zawiera: p.zawiera }}
      />
    </div>
  );
}
