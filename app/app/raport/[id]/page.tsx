import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { after } from "next/server";
import { Disclaimer } from "@/components/Disclaimer";
import { AutoRefresh } from "@/components/report/AutoRefresh";
import { FeedbackForm } from "@/components/report/FeedbackForm";
import { PrintButton } from "@/components/report/PrintButton";
import { PrintHeader } from "@/components/report/PrintHeader";
import { ReportView } from "@/components/report/ReportView";
import { getReport, hasFeedback, markPaid, parseInput, parseReport } from "@/lib/db";
import { checkSessionPaid, paymentsSkipped } from "@/lib/payments";
import { enqueueGeneration } from "@/lib/queue";
import { retryGeneration } from "./actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Raport", robots: { index: false, follow: false } };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function RaportPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  if (!UUID_RE.test(id)) notFound();
  let row = getReport(id);
  if (!row) notFound();

  // Powrót ze Stripe: jeśli webhook jeszcze nie dotarł, sprawdzamy sesję bezpośrednio.
  const sessionId = typeof sp.session_id === "string" ? sp.session_id : null;
  // Powrót z e-maila „Czy kupiłeś?” (link jednego kliknięcia) – zamiast formularza pokazujemy podziękowanie.
  const fbRaw = sp.feedback ?? sp.kupil ?? sp.odp;
  const feedbackParam = fbRaw === "tak" || fbRaw === "nie" ? fbRaw : null;
  if (row.status === "pending_payment" && sessionId && !paymentsSkipped() && sessionId === row.stripe_session_id) {
    try {
      const s = await checkSessionPaid(sessionId);
      if (s.paid && s.reportId === id) markPaid(id);
    } catch (e) {
      console.warn("[stripe] Nie udało się sprawdzić sesji:", (e as Error).message);
    }
    row = getReport(id)!;
  }
  // Opłacony, ale generowanie nie wystartowało (np. restart serwera) – uruchamiamy. Idempotentne.
  if (row.status === "paid") after(() => enqueueGeneration(id));

  const input = parseInput(row);
  const created = new Date(row.created_at).toLocaleDateString("pl-PL");
  const expires = new Date(row.expires_at).toLocaleDateString("pl-PL");

  if (row.status === "expired") {
    return (
      <div className="space-y-4 py-8 text-center">
        <h1 className="text-2xl font-bold">Płatność nie została dokończona</h1>
        <p className="text-slate-700">Sesja płatności wygasła. Dane z formularza są zapisane – możesz dokończyć płatność bez ponownego wypełniania.</p>
        <a href={`/api/reports/${id}/zaplac`} className="inline-block rounded-xl bg-brand-700 px-6 py-3 font-bold text-white hover:bg-brand-900">
          Dokończ płatność
        </a>
        <p className="text-xs text-slate-600">Raport będzie dostępny pod tym adresem przez 30 dni (do {expires}).</p>
      </div>
    );
  }

  if (row.status === "pending_payment" || row.status === "paid" || row.status === "generating") {
    const waitingForPayment = row.status === "pending_payment";
    return (
      <div className="space-y-4 py-8 text-center">
        <AutoRefresh ms={3000} />
        <div className="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-brand-100 border-t-brand-600" aria-hidden />
        <h1 className="text-2xl font-bold">{waitingForPayment ? "Czekamy na potwierdzenie płatności…" : "Przygotowujemy Twój raport…"}</h1>
        <p className="text-slate-600">
          {waitingForPayment
            ? "Zwykle trwa to kilka sekund. Strona odświeży się sama."
            : "Analizujemy ogłoszenie, przebiegi i bazę usterek. Zwykle 1–3 minuty. Strona odświeży się sama."}
        </p>
        <p className="text-xs text-slate-600">Zapisz ten adres – raport będzie dostępny pod nim przez 30 dni (do {expires}).</p>
        {waitingForPayment && !paymentsSkipped() && (
          <p className="text-sm">
            Płatność przerwana?{" "}
            <a href={`/api/reports/${id}/zaplac`} className="font-semibold text-brand-700 underline">
              Dokończ płatność
            </a>
          </p>
        )}
      </div>
    );
  }

  if (row.status === "error") {
    return (
      <div className="space-y-4 py-8">
        <h1 className="text-2xl font-bold">Nie udało się wygenerować raportu</h1>
        <p className="text-slate-700">
          Przepraszamy – wystąpił błąd po naszej stronie. Płatność jest zachowana; możesz spróbować ponownie. Jeśli problem
          się powtarza, skontaktuj się z nami, podając numer raportu: <code className="text-xs">{id}</code>.
        </p>
        {process.env.NODE_ENV !== "production" && row.error && (
          <pre className="whitespace-pre-wrap rounded-lg bg-slate-100 p-3 text-xs text-slate-700">{row.error}</pre>
        )}
        <form action={retryGeneration}>
          <input type="hidden" name="id" value={id} />
          <button className="rounded-xl bg-brand-700 px-6 py-3 font-bold text-white">Spróbuj ponownie</button>
        </form>
      </div>
    );
  }

  const report = parseReport(row);
  if (!report) notFound();

  const affiliates = [
    { name: "autoDNA", url: process.env.AFFILIATE_AUTODNA_URL },
    { name: "carVertical", url: process.env.AFFILIATE_CARVERTICAL_URL },
  ].filter((a): a is { name: string; url: string } => !!a.url);

  const title = report.rozpoznany_pojazd.marka !== "nie ustalono"
    ? `${report.rozpoznany_pojazd.marka} ${report.rozpoznany_pojazd.model}`
    : input.model_label ?? "auto z ogłoszenia";

  return (
    <article className="space-y-4">
      <PrintHeader title={`Raport: ${title}`} reportNo={id.slice(0, 8)} date={created} />
      <header className="space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-brand-600">
              {row.offer === "raport_plus" ? "Raport+" : "Raport"} · {created}
            </p>
            <h1 className="text-2xl font-extrabold text-brand-900">Raport: {title}</h1>
            <p className="text-xs text-slate-500">
              Ważny do {expires} · nr {id.slice(0, 8)}
              {input.cena_pln !== null && <> · cena w ogłoszeniu {input.cena_pln.toLocaleString("pl-PL")} zł</>}
            </p>
          </div>
          <PrintButton />
        </div>
        <Disclaimer className="print:hidden" />
      </header>

      <ReportView report={report} offer={row.offer} fallbackName={input.model_label ?? undefined} />

      {affiliates.length > 0 && (
        <section className="no-print rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <h2 className="text-lg font-bold">Chcesz sprawdzić historię z zagranicy?</h2>
          <p className="mt-1 text-sm text-slate-600">
            Jeśli auto jest sprowadzone, płatne raporty z zagranicznych baz mogą pokazać szkody i przebiegi sprzed importu
            (potrzebny VIN). Linki partnerskie – możemy otrzymać prowizję.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {affiliates.map((a) => (
              <a
                key={a.name}
                href={a.url}
                target="_blank"
                rel="sponsored noopener noreferrer"
                className="rounded-xl border-2 border-brand-600 px-4 py-2.5 font-semibold text-brand-700 hover:bg-brand-50"
              >
                Sprawdź w {a.name} →
              </a>
            ))}
          </div>
        </section>
      )}

      <section className="no-print rounded-2xl bg-white p-4 shadow-sm sm:p-5">
        {feedbackParam ? (
          <p className="text-sm font-semibold text-emerald-800" role="status">
            Dziękujemy za odpowiedź{feedbackParam === "tak" ? " – powodzenia z autem!" : " – trzymamy kciuki za kolejne ogłoszenie."} To pomaga
            nam ulepszać raporty.
          </p>
        ) : (
          <FeedbackForm reportId={id} alreadySent={hasFeedback(id)} />
        )}
      </section>

      <p className="no-print text-center text-sm">
        <Link href="/sprawdz" className="font-semibold text-brand-700 underline">
          Sprawdź kolejne ogłoszenie
        </Link>
      </p>
      <p className="hidden text-center text-[10px] text-slate-500 print:block">
        Raport jest pomocą, nie ekspertyzą. Przed zakupem zrób oględziny u niezależnego mechanika.
      </p>
    </article>
  );
}
