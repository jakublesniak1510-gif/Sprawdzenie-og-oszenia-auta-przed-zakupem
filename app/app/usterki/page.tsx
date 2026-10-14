import type { Metadata } from "next";
import Link from "next/link";
import { loadModels } from "@/lib/models";

export const metadata: Metadata = {
  title: "Typowe usterki popularnych aut – na co uważać przy zakupie",
  alternates: { canonical: "/usterki" },
  description: "Na co uważać przy zakupie używanego auta: typowe usterki modeli i silników z orientacyjnymi kosztami napraw.",
};
// Lista czytana z data/models przy żądaniu (cache 1 h) – nowe pliki pojawiają się bez przebudowy.
export const revalidate = 3600;

export default async function UsterkiPage() {
  const models = await loadModels();
  const byMake = new Map<string, typeof models>();
  for (const m of models) byMake.set(m.make, [...(byMake.get(m.make) ?? []), m]);

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-extrabold text-brand-900">Typowe usterki popularnych aut</h1>
      <p className="text-slate-700">
        Zebraliśmy najczęstsze usterki modeli popularnych na polskim rynku wtórnym – z orientacyjnymi kosztami napraw i
        wskazówkami, jak je sprawdzić przed zakupem.
      </p>
      {models.length === 0 ? (
        <p className="rounded-xl border border-slate-200 bg-white p-5 text-center text-slate-600">
          Wkrótce – baza modeli jest w przygotowaniu.
        </p>
      ) : (
        [...byMake.entries()].map(([make, list]) => (
          <section key={make}>
            <h2 className="mb-2 text-lg font-bold">{make}</h2>
            <ul className="grid gap-2 sm:grid-cols-2">
              {list.map((m) => (
                <li key={m.id}>
                  <Link href={`/usterki/${m.id}`} className="block rounded-xl bg-white p-3 shadow-sm hover:ring-2 hover:ring-brand-100">
                    <span className="font-semibold">
                      {m.make} {m.model}
                    </span>{" "}
                    <span className="text-sm text-slate-500">{m.generation}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
    </div>
  );
}
