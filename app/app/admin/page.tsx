import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { adminConfigured, checkBasicAuth } from "@/lib/admin-auth";
import { adminDashboard, type Funnel } from "@/lib/admin-stats";
import { formatCouponCode } from "@/lib/coupons";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Panel admina", robots: { index: false, follow: false } };

const pln = (gr: number) => `${(gr / 100).toLocaleString("pl-PL", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} zł`;
const usd = (v: number) => `$${v.toFixed(2)}`;
const dt = (iso: string) => new Date(iso).toLocaleString("pl-PL", { timeZone: "Europe/Warsaw", dateStyle: "short", timeStyle: "short" });
const pct = (a: number, b: number) => (b > 0 ? `${Math.round((a / b) * 100)}%` : "–");
const num = (n: number) => n.toLocaleString("pl-PL");

function Th({ children }: { children: React.ReactNode }) {
  return <th className="border-b border-slate-200 px-2 py-1 text-left font-semibold text-slate-600">{children}</th>;
}
function Td({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <td className={`border-b border-slate-100 px-2 py-1 align-top ${className}`}>{children}</td>;
}
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="text-lg font-bold">{title}</h2>
      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">{children}</div>
    </section>
  );
}

function FunnelRows({ okresy }: { okresy: Funnel[] }) {
  const rows: [string, (f: Funnel) => React.ReactNode][] = [
    ["Szybkie testy", (f) => num(f.szybkie_testy)],
    ["Raporty utworzone (formularz)", (f) => `${num(f.raporty_utworzone)} (${pct(f.raporty_utworzone, f.szybkie_testy)} testów)`],
    ["Płatności rozpoczęte", (f) => num(f.platnosci_rozpoczete)],
    ["Opłacone (w tym kupony)", (f) => `${num(f.oplacone)} (${pct(f.oplacone, f.raporty_utworzone)} utworzonych)`],
    ["Wygenerowane", (f) => `${num(f.wygenerowane)} (${pct(f.wygenerowane, f.oplacone)} opłaconych)`],
    ["Błędy końcowe", (f) => num(f.bledy)],
    ["Pakiety 5 raportów", (f) => num(f.pakiety)],
    ["Przychód (brutto)", (f) => `${pln(f.przychod_gr)} (raporty ${pln(f.przychod_raporty_gr)}, pakiety ${pln(f.przychod_pakiety_gr)})`],
    ["Koszt AI (szac.)", (f) => `${usd(f.koszt_ai_usd)}${f.wygenerowane ? ` · ${usd(f.koszt_ai_usd / f.wygenerowane)}/raport` : ""}`],
    ["Tokeny: wejście / z cache / wyjście", (f) => `${num(f.tokeny_wejscie)} / ${num(f.tokeny_cache)} / ${num(f.tokeny_wyjscie)}`],
    ["Średni czas generowania", (f) => (f.sredni_czas_s === null ? "–" : `${f.sredni_czas_s} s`)],
    ["Opinie: pomógł / nie pomógł", (f) => `${f.feedback_tak} / ${f.feedback_nie}`],
    ["„Kupiłeś?” (e-mail): tak / nie", (f) => `${f.kupil_tak} / ${f.kupil_nie}`],
  ];
  return (
    <table className="w-full text-sm">
      <thead>
        <tr>
          <Th>Metryka</Th>
          {okresy.map((f) => (
            <Th key={f.dni}>Ostatnie {f.dni} dni</Th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map(([label, get]) => (
          <tr key={label}>
            <Td className="font-medium">{label}</Td>
            {okresy.map((f) => (
              <Td key={f.dni}>{get(f)}</Td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default async function AdminPage() {
  // Proxy (proxy.ts) wymusza Basic Auth; sprawdzamy ponownie na wypadek błędnej konfiguracji matchera.
  if (!adminConfigured() || !checkBasicAuth((await headers()).get("authorization"))) notFound();
  const d = adminDashboard();

  return (
    <div className="space-y-8 py-4">
      <div>
        <h1 className="text-2xl font-bold">Panel admina</h1>
        <p className="text-sm text-slate-600">
          Statusy raportów:{" "}
          {Object.entries(d.statusy)
            .map(([k, v]) => `${k}: ${v}`)
            .join(" · ") || "brak"}
          {" · "}kolejka: {d.kolejka.active} w toku, {d.kolejka.waiting} czeka
        </p>
      </div>

      <Section title="Lejek i finanse">
        <FunnelRows okresy={d.okresy} />
      </Section>

      <Section title="Ostatnie opinie (20)">
        <table className="w-full text-sm">
          <thead>
            <tr>
              <Th>Data</Th>
              <Th>Pomógł?</Th>
              <Th>Komentarz</Th>
              <Th>Model / pakiet</Th>
              <Th>Raport</Th>
            </tr>
          </thead>
          <tbody>
            {d.feedback.length === 0 && (
              <tr>
                <Td className="text-slate-500">Brak opinii.</Td>
              </tr>
            )}
            {d.feedback.map((f) => (
              <tr key={`${f.report_id}-${f.created_at}`}>
                <Td className="whitespace-nowrap">{dt(f.created_at)}</Td>
                <Td>{f.helpful ? "✓ tak" : "✗ nie"}</Td>
                <Td className="max-w-md whitespace-pre-wrap">{f.comment ?? "–"}</Td>
                <Td>
                  {f.model_label ?? "–"} / {f.offer ?? "–"}
                </Td>
                <Td>
                  <a className="text-brand-700 underline" href={`/raport/${f.report_id}`}>
                    {f.report_id.slice(0, 8)}
                  </a>
                </Td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>

      <Section title="Ostatnie błędy generowania (20)">
        <table className="w-full text-sm">
          <thead>
            <tr>
              <Th>Data</Th>
              <Th>Raport</Th>
              <Th>Próba</Th>
              <Th>Powód</Th>
            </tr>
          </thead>
          <tbody>
            {d.bledy.length === 0 && (
              <tr>
                <Td className="text-slate-500">Brak błędów.</Td>
              </tr>
            )}
            {d.bledy.map((e, i) => (
              <tr key={i}>
                <Td className="whitespace-nowrap">{dt(e.created_at)}</Td>
                <Td>{e.report_id ? <code className="text-xs">{e.report_id}</code> : "–"}</Td>
                <Td>{e.proba ?? "–"}</Td>
                <Td className="max-w-lg break-words font-mono text-xs">{e.powod ?? "–"}</Td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>

      <Section title="Kupony (50 najnowszych)">
        <table className="w-full text-sm">
          <thead>
            <tr>
              <Th>Kod</Th>
              <Th>Pozostało</Th>
              <Th>Użyto</Th>
              <Th>Pakiet</Th>
              <Th>Źródło</Th>
              <Th>Ważny do</Th>
              <Th>Utworzony</Th>
            </tr>
          </thead>
          <tbody>
            {d.kupony.length === 0 && (
              <tr>
                <Td className="text-slate-500">Brak kuponów. Utwórz: npm run coupon -- create --uses 5 --days 365</Td>
              </tr>
            )}
            {d.kupony.map((c) => (
              <tr key={c.code} className={c.uses_left === 0 || c.expires_at < new Date().toISOString() ? "text-slate-400" : ""}>
                <Td className="font-mono">{formatCouponCode(c.code)}</Td>
                <Td>{c.uses_left}</Td>
                <Td>{c.uses_total}</Td>
                <Td>{c.offer}</Td>
                <Td>{c.source}</Td>
                <Td className="whitespace-nowrap">{dt(c.expires_at)}</Td>
                <Td className="whitespace-nowrap">{dt(c.created_at)}</Td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>
    </div>
  );
}
