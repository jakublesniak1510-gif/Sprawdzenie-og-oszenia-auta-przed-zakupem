import type { Metadata, Viewport } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Sprawdź ogłoszenie auta przed zakupem", template: "%s · Sprawdź ogłoszenie auta" },
  description:
    "Wklej ogłoszenie używanego auta i dostań raport: czerwone flagi, przebiegi z CEPiK, typowe usterki modelu, pytania do sprzedawcy i checklistę oględzin.",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#1e40af" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pl">
      <body className="min-h-dvh antialiased">
        <header className="no-print border-b border-slate-200 bg-white">
          <nav className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-3">
            <Link href="/" className="truncate font-bold text-brand-900">
              Sprawdź<span className="text-brand-600">Ogłoszenie</span>
            </Link>
            <div className="flex shrink-0 items-center gap-3 whitespace-nowrap text-sm">
              <Link href="/usterki" className="text-slate-700 hover:text-brand-700">
                Usterki
              </Link>
              <Link href="/sprawdz" className="rounded-lg bg-brand-700 px-3 py-2 font-semibold text-white hover:bg-brand-900">
                Sprawdź auto
              </Link>
            </div>
          </nav>
        </header>
        <main className="mx-auto max-w-3xl px-4 py-6">{children}</main>
        <footer className="no-print mx-auto max-w-3xl px-4 pb-10 pt-4 text-xs text-slate-500">
          <p>
            Raport jest pomocą, nie ekspertyzą. Przed zakupem zawsze zrób oględziny u niezależnego mechanika.
          </p>
          <p className="mt-2 flex flex-wrap gap-4">
            <Link href="/regulamin" className="underline">
              Regulamin
            </Link>
            <Link href="/polityka-prywatnosci" className="underline">
              Polityka prywatności
            </Link>
            <Link href="/usterki" className="underline">
              Typowe usterki
            </Link>
          </p>
        </footer>
      </body>
    </html>
  );
}
