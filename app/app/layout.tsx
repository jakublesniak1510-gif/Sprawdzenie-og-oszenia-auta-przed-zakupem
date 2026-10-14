import type { Metadata, Viewport } from "next";
import { SiteFooter } from "@/components/site/SiteFooter";
import { SiteHeader } from "@/components/site/SiteHeader";
import { SITE_NAME, SITE_TITLE, baseUrl } from "@/components/site/config";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(baseUrl()),
  title: { default: `${SITE_TITLE} – raport i darmowy szybki test`, template: "%s · SprawdźOgłoszenie" },
  description:
    "Wklej ogłoszenie używanego auta i dostań raport: czerwone flagi, przebiegi z CEPiK, typowe usterki modelu, pytania do sprzedawcy i checklistę oględzin. Szybki test za darmo.",
  applicationName: SITE_NAME,
  openGraph: { type: "website", locale: "pl_PL", siteName: SITE_NAME },
  twitter: { card: "summary_large_image" },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#1e40af" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pl">
      <body className="flex min-h-dvh flex-col antialiased">
        <a href="#tresc" className="sr-only z-50 rounded-lg bg-white px-4 py-2 font-semibold text-brand-900 focus:not-sr-only focus:fixed focus:left-2 focus:top-2">
          Przejdź do treści
        </a>
        <SiteHeader />
        <main id="tresc" className="mx-auto w-full max-w-3xl flex-1 px-4 py-6">
          {children}
        </main>
        <SiteFooter />
      </body>
    </html>
  );
}
