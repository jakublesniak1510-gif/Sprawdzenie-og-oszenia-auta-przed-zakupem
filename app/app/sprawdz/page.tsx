import type { Metadata } from "next";
import { CheckForm } from "@/components/CheckForm";
import { offers, paymentsSkipped } from "@/lib/payments";

export const metadata: Metadata = { title: "Sprawdź ogłoszenie" };
export const dynamic = "force-dynamic";

export default async function SprawdzPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-extrabold text-brand-900">Sprawdź ogłoszenie</h1>
        <p className="text-sm text-slate-600">4 krótkie kroki. Wymagany jest tylko tekst ogłoszenia.</p>
      </div>
      {paymentsSkipped() && (
        <p className="rounded-lg border border-fuchsia-300 bg-fuchsia-50 p-2 text-xs text-fuchsia-900">
          Tryb testowy: płatność wyłączona (DEV_SKIP_PAYMENT=1){process.env.AI_MOCK === "1" ? ", raport z atrapy AI (AI_MOCK=1)" : ""}.
        </p>
      )}
      <CheckForm offers={offers()} skipPayment={paymentsSkipped()} cancelled={sp.anulowano === "1"} />
    </div>
  );
}
