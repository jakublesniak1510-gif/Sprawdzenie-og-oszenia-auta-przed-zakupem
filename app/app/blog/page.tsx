import type { Metadata } from "next";
import Link from "next/link";
import { formatDatePl, loadPosts } from "@/components/content/blog";

export const metadata: Metadata = {
  title: "Blog – jak kupić używane auto i nie przepłacić",
  description: "Poradniki przed zakupem używanego auta: jak czytać Historię Pojazdu, cofnięte liczniki, auta z Niemiec, pytania do sprzedawcy.",
  alternates: { canonical: "/blog" },
};
// Artykuły czytane z content/blog przy renderze (cache 1 h) – nowe pliki pojawiają się bez przebudowy.
export const revalidate = 3600;

export default async function BlogPage() {
  const posts = await loadPosts();
  return (
    <div className="space-y-5">
      <header className="space-y-2">
        <h1 className="text-2xl font-extrabold text-brand-900 sm:text-3xl">Blog: kupujesz używane auto?</h1>
        <p className="text-slate-700">Konkretne poradniki – co sprawdzić w ogłoszeniu, w dokumentach i na oględzinach.</p>
      </header>
      {posts.length === 0 ? (
        <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5 text-center">
          <p className="font-semibold">Wkrótce pierwsze artykuły.</p>
          <p className="text-sm text-slate-700">
            Tymczasem zajrzyj do{" "}
            <Link href="/usterki" className="font-semibold text-brand-700 underline">
              typowych usterek popularnych modeli
            </Link>{" "}
            albo pobierz{" "}
            <Link href="/checklista" className="font-semibold text-brand-700 underline">
              checklistę oględzin do druku
            </Link>
            .
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {posts.map((p) => (
            <li key={p.slug}>
              <Link href={`/blog/${p.slug}`} className="block rounded-2xl bg-white p-4 shadow-sm hover:ring-2 hover:ring-brand-100 sm:p-5">
                {p.date && (
                  <time dateTime={p.date} className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                    {formatDatePl(p.date)}
                  </time>
                )}
                <h2 className="mt-1 text-lg font-bold text-brand-900">{p.title}</h2>
                {p.description && <p className="mt-1 text-sm text-slate-700">{p.description}</p>}
                <span className="mt-2 inline-block text-sm font-semibold text-brand-700">Czytaj →</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
