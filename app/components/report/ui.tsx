import type { Waga } from "@/lib/report-schema";

export const WAGA_LABEL: Record<Waga, string> = { niska: "niska", srednia: "średnia", wysoka: "wysoka" };

const WAGA_CLS: Record<Waga, string> = {
  wysoka: "bg-red-100 text-red-800 border-red-300",
  srednia: "bg-amber-100 text-amber-900 border-amber-300",
  niska: "bg-slate-100 text-slate-700 border-slate-300",
};
const WAGA_BORDER: Record<Waga, string> = { wysoka: "border-l-red-600", srednia: "border-l-amber-500", niska: "border-l-slate-400" };
const WAGA_ICON: Record<Waga, string> = { wysoka: "▲▲▲", srednia: "▲▲", niska: "▲" };

export function WagaBadge({ waga, prefix = "waga" }: { waga: Waga; prefix?: string }) {
  return (
    <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-semibold ${WAGA_CLS[waga]}`}>
      <span aria-hidden className="text-[9px] tracking-tighter">{WAGA_ICON[waga]}</span>
      {prefix} {WAGA_LABEL[waga]}
    </span>
  );
}

export function wagaBorder(w: Waga) {
  return WAGA_BORDER[w];
}

export function Section({ id, title, children, className = "" }: { id?: string; title: string; children: React.ReactNode; className?: string }) {
  return (
    <section id={id} className={`print-card rounded-2xl bg-white p-4 shadow-sm sm:p-5 ${className}`}>
      <h2 className="mb-3 text-lg font-bold text-slate-900">{title}</h2>
      {children}
    </section>
  );
}

export const pln = (n: number | null) => (n === null ? "—" : `${n.toLocaleString("pl-PL")} zł`);
export const km = (n: number | null) => (n === null ? "—" : `${n.toLocaleString("pl-PL")} km`);
