import type { Metadata } from "next";
import Link from "next/link";
import { BuyPackage } from "@/components/pakiet/BuyPackage";
import { Icon } from "@/components/ui/icons";
import { formatPln } from "@/lib/offers";
import { packageOffer, paymentsSkipped } from "@/lib/payments";

export const metadata: Metadata = {
  title: "Pakiet 5 raportów – kupon",
  description: "Szukasz dłużej? Kup kupon na 5 raportów i sprawdzaj kolejne ogłoszenia, kiedy chcesz.",
  alternates: { canonical: "/pakiet" },
};
export const dynamic = "force-dynamic";

export default async function PakietPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const p = packageOffer();
  const perReport = formatPln(Math.round(p.cenaGr / p.liczbaRaportow));
  return (
    <div className="space-y-5">
      <header className="space-y-2">
        <h1 className="text-2xl font-extrabold text-brand-900 sm:text-3xl">{p.nazwa}</h1>
        <p className="text-slate-700">
          Szukasz auta dłużej i sprawdzasz kilka ogłoszeń? Kupujesz kod, a potem wpisujesz go w formularzu przy każdym raporcie – bez
          kolejnych płatności. Wychodzi ok. {perReport} za raport.
        </p>
      </header>
      {sp.anulowano === "1" && (
        <p className="rounded-xl border border-slate-300 bg-white p-3 text-sm">Płatność została anulowana – możesz spróbować ponownie.</p>
      )}
      <div className="rounded-2xl border-2 border-brand-600 bg-white p-4 sm:p-5">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-lg font-bold">{p.nazwa}</h2>
          <span className="text-3xl font-extrabold text-brand-700">{formatPln(p.cenaGr)}</span>
        </div>
        <ul className="mt-3 space-y-1 text-sm">
          {p.zawiera.map((z) => (
            <li key={z} className="flex gap-2">
              <Icon name="check" className="mt-0.5 h-4 w-4 text-emerald-700" strokeWidth={2.5} />
              {z}
            </li>
          ))}
        </ul>
      </div>
      <BuyPackage priceLabel={formatPln(p.cenaGr)} skipPayment={paymentsSkipped()} />
      <p className="text-sm text-slate-700">
        Masz już kod?{" "}
        <Link href="/sprawdz" className="font-semibold text-brand-700 underline">
          Przejdź do formularza
        </Link>{" "}
        i wpisz go w polu „Kod kuponu”.
      </p>
    </div>
  );
}
