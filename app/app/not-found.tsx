import Link from "next/link";

export default function NotFound() {
  return (
    <div className="space-y-3 py-10 text-center">
      <h1 className="text-2xl font-bold">Nie znaleziono strony</h1>
      <p className="text-slate-600">Raporty są dostępne przez 30 dni od zakupu – potem są automatycznie usuwane.</p>
      <Link href="/" className="font-semibold text-brand-700 underline">
        Wróć na stronę główną
      </Link>
    </div>
  );
}
