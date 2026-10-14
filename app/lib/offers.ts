import type { OfferId } from "./report-schema";

/** Oferty – bez zależności serwerowych, można importować w komponentach klienckich. */
export interface Offer {
  id: OfferId;
  nazwa: string;
  cenaGr: number;
  zawiera: string[];
}

export function offerList(prices: { raport: number; raport_plus: number }): Offer[] {
  return [
    {
      id: "raport",
      nazwa: "Raport",
      cenaGr: prices.raport,
      zawiera: ["Czerwone flagi w ogłoszeniu", "Przebiegi z CEPiK vs deklaracja", "Typowe usterki modelu i koszty", "Pytania do sprzedawcy i checklista oględzin"],
    },
    {
      id: "raport_plus",
      nazwa: "Raport+",
      cenaGr: prices.raport_plus,
      zawiera: ["Wszystko z Raportu", "Porównanie ceny z maks. 5 podobnymi ofertami", "Wzór umowy kupna-sprzedaży", "Checklista oględzin do druku"],
    },
  ];
}

export function formatPln(gr: number): string {
  const zl = gr / 100;
  return `${Number.isInteger(zl) ? zl : zl.toFixed(2).replace(".", ",")} zł`;
}
