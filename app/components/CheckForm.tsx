"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { QUICK_PREFILL_KEY } from "@/components/site/config";
import { Icon } from "@/components/ui/icons";
import { formatPln, type Offer } from "@/lib/offers";

/* ---------- typy ---------- */

interface ModelOption {
  id: string;
  label: string;
  years: [number, number];
  engines: { code: string; fuel: string }[];
}
interface Candidate {
  modelId: string;
  label: string;
  engineCode: string | null;
  score: number;
}
interface ManualRow {
  data: string;
  km: string;
}
interface SimilarRow {
  tekst: string;
  cena: string;
  rocznik: string;
  przebieg_km: string;
}
interface Draft {
  tekst: string;
  cena: string;
  przebieg: string;
  rocznik: string;
  historia: string;
  reczne: ManualRow[];
  podobne: SimilarRow[];
  oferta: OfferChoice;
}
type OfferChoice = Offer["id"] | "pakiet5";
export interface PackageInfo {
  nazwa: string;
  cenaGr: number;
  zawiera: string[];
}
type CouponState = { state: "idle" | "checking" | "valid" | "invalid" | "unavailable"; message: string | null };

const MAX_PHOTOS = 8;
const MAX_SIDE = 1280;
const JPEG_QUALITY = 0.8;
const MIN_TEXT = 100;
const MAX_TEXT = 30000;
/** Szkic formularza (bez zdjęć) – localStorage, przetrwa zamknięcie karty i powrót z płatności/zakupu pakietu. */
const DRAFT_KEY = "sprawdz-draft-v2";
const STEPS = ["Ogłoszenie", "Historia", "Podobne oferty", "Model i płatność"] as const;

const emptyDraft: Draft = {
  tekst: "",
  cena: "",
  przebieg: "",
  rocznik: "",
  historia: "",
  reczne: [{ data: "", km: "" }],
  podobne: [],
  oferta: "raport",
};

/* ---------- pomocnicze ---------- */

const toInt = (s: string): number | null => {
  const n = Number(s.replace(/[\s .,złkm]/gi, ""));
  return s.trim() === "" || !Number.isFinite(n) ? null : Math.round(n);
};

async function loadImage(file: File): Promise<CanvasImageSource & { width: number; height: number }> {
  if ("createImageBitmap" in window) {
    try {
      return await createImageBitmap(file);
    } catch {
      /* spróbuj przez <img> */
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.decoding = "async";
    img.src = url;
    await img.decode();
    return img;
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Zmniejsza zdjęcie w przeglądarce: max 1280 px dłuższego boku, JPEG q=0.8. */
async function resizeToJpeg(file: File): Promise<string> {
  const img = await loadImage(file);
  const scale = Math.min(1, MAX_SIDE / Math.max(img.width, img.height));
  const w = Math.max(1, Math.round(img.width * scale));
  const h = Math.max(1, Math.round(img.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Brak obsługi canvas");
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(img, 0, 0, w, h);
  if ("close" in img && typeof img.close === "function") img.close();
  return canvas.toDataURL("image/jpeg", JPEG_QUALITY);
}

/* ---------- drobne komponenty ---------- */

const inputCls =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-base text-slate-900 placeholder:text-slate-400 focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-100";

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-semibold text-slate-800">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-slate-500">{hint}</span>}
    </label>
  );
}

/* ---------- formularz ---------- */

/** Komunikat błędu z API → zrozumiały tekst. */
function friendlyError(status: number, j: { error?: string }): string {
  if (status === 413) return j.error || "Zdjęcia są za duże. Usuń część zdjęć albo dodaj zrzuty ekranu zamiast oryginałów.";
  if (status === 429) return "Za dużo prób w krótkim czasie. Odczekaj minutę i spróbuj ponownie.";
  if (status === 400 && j.error) return `Popraw dane: ${j.error}`;
  if (status >= 500) return j.error || "Wystąpił błąd po naszej stronie. Twoje dane są zapisane w tej przeglądarce – spróbuj ponownie za chwilę.";
  return j.error || "Coś poszło nie tak. Spróbuj ponownie.";
}

export function CheckForm({
  offers,
  skipPayment,
  cancelled,
  initialOffer,
  initialCoupon = "",
  pkg,
}: {
  offers: Offer[];
  skipPayment: boolean;
  cancelled: boolean;
  initialOffer?: OfferChoice | null;
  initialCoupon?: string;
  pkg: PackageInfo;
}) {
  const [step, setStep] = useState(0);
  const [d, setD] = useState<Draft>(emptyDraft);
  const [loaded, setLoaded] = useState(false);
  const [fromQuickTest, setFromQuickTest] = useState(false);
  const [kupon, setKupon] = useState(initialCoupon);
  const [kuponState, setKuponState] = useState<CouponState>({ state: "idle", message: null });
  const [photos, setPhotos] = useState<string[]>([]);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);

  const [models, setModels] = useState<ModelOption[] | null>(null);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [modelId, setModelId] = useState<string>("");
  const [engineCode, setEngineCode] = useState<string>("");
  const [detectError, setDetectError] = useState<string | null>(null);

  const [email, setEmail] = useState("");
  const [zgodaTresc, setZgodaTresc] = useState(false);
  const [zgodaRegulamin, setZgodaRegulamin] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const topRef = useRef<HTMLDivElement>(null);

  // Start: szkic z localStorage; dane z szybkiego testu (sessionStorage) mają pierwszeństwo – to nowe ogłoszenie.
  useEffect(() => {
    let next: Draft = emptyDraft;
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (raw) next = { ...emptyDraft, ...(JSON.parse(raw) as Partial<Draft>) };
    } catch {
      /* brak dostępu do storage – OK */
    }
    try {
      const quick = sessionStorage.getItem(QUICK_PREFILL_KEY);
      if (quick) {
        const q = JSON.parse(quick) as Partial<Pick<Draft, "tekst" | "cena" | "przebieg" | "rocznik">>;
        next = { ...emptyDraft, oferta: next.oferta, tekst: q.tekst ?? "", cena: q.cena ?? "", przebieg: q.przebieg ?? "", rocznik: q.rocznik ?? "" };
        setFromQuickTest(true); // klucz usuwamy dopiero po zapisie szkicu (efekt może się wykonać 2× w StrictMode)
      }
    } catch {
      /* ignoruj */
    }
    if (initialOffer) next = { ...next, oferta: initialOffer };
    setD(next);
    setLoaded(true);
    // tylko przy wejściu na stronę
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (!loaded) return;
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(d));
      sessionStorage.removeItem(QUICK_PREFILL_KEY);
    } catch {
      /* ignoruj (tryb prywatny, brak miejsca) */
    }
  }, [d, loaded]);

  function clearDraft() {
    if (!confirm("Wyczyścić formularz? Wpisane dane zostaną usunięte z tej przeglądarki.")) return;
    setD(emptyDraft);
    setPhotos([]);
    try {
      localStorage.removeItem(DRAFT_KEY);
    } catch {
      /* ignoruj */
    }
  }

  /* --- kupon --- */
  async function checkCoupon() {
    const code = kupon.trim();
    if (!code) {
      setKuponState({ state: "invalid", message: "Wpisz kod kuponu." });
      return;
    }
    setKuponState({ state: "checking", message: null });
    try {
      const res = await fetch("/api/coupons/check", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ code, oferta: d.oferta === "pakiet5" ? "raport" : d.oferta }),
      });
      if (res.status === 404) {
        setKuponState({ state: "unavailable", message: "Sprawdzanie kodów jest chwilowo niedostępne – kod sprawdzimy przy wysyłce formularza." });
        return;
      }
      if (res.status === 429) {
        setKuponState({ state: "invalid", message: "Za dużo prób. Odczekaj chwilę i spróbuj ponownie." });
        return;
      }
      const j = (await res.json().catch(() => ({}))) as { valid?: boolean; message?: string };
      setKuponState(
        j.valid
          ? { state: "valid", message: j.message || "Kod jest ważny." }
          : { state: "invalid", message: j.message || "Ten kod jest nieprawidłowy albo wygasł." },
      );
    } catch {
      setKuponState({ state: "unavailable", message: "Brak połączenia – kod sprawdzimy przy wysyłce formularza." });
    }
  }

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((p) => ({ ...p, [k]: v }));
  const chooseOffer = (o: OfferChoice) => {
    set("oferta", o);
    if (kuponState.state === "valid" || kuponState.state === "invalid") setKuponState({ state: "idle", message: null });
  };
  const textLen = d.tekst.trim().length;

  const goTo = (s: number) => {
    setError(null);
    setStep(s);
    topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  /* --- zdjęcia --- */
  async function onFiles(files: FileList | null) {
    if (!files?.length) return;
    setPhotoError(null);
    const free = MAX_PHOTOS - photos.length;
    const list = Array.from(files).slice(0, free);
    if (files.length > free) setPhotoError(`Można dodać maksymalnie ${MAX_PHOTOS} zdjęć.`);
    setPhotoBusy(true);
    const out: string[] = [];
    for (const f of list) {
      try {
        out.push(await resizeToJpeg(f));
      } catch {
        setPhotoError(`Nie udało się wczytać „${f.name}”. Spróbuj zrzutu ekranu (PNG/JPG).`);
      }
    }
    setPhotos((p) => [...p, ...out].slice(0, MAX_PHOTOS));
    setPhotoBusy(false);
  }

  /* --- rozpoznanie modelu (krok 4) --- */
  useEffect(() => {
    if (step !== 3) return;
    let cancelledReq = false;
    setDetectError(null);
    fetch("/api/models/detect", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: d.tekst, rocznik: toInt(d.rocznik) }),
    })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((j: { models: ModelOption[]; candidates: Candidate[] }) => {
        if (cancelledReq) return;
        setModels(j.models);
        setCandidates(j.candidates);
        if (!modelId && j.candidates[0]) {
          setModelId(j.candidates[0].modelId);
          setEngineCode(j.candidates[0].engineCode ?? "");
        }
      })
      .catch(() => !cancelledReq && setDetectError("Nie udało się pobrać listy modeli. Raport powstanie bez danych z bazy."));
    return () => {
      cancelledReq = true;
    };
    // celowo tylko przy wejściu na krok 4
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  const selectedModel = useMemo(() => models?.find((m) => m.id === modelId) ?? null, [models, modelId]);
  const isPackage = d.oferta === "pakiet5";
  const offer = offers.find((o) => o.id === d.oferta) ?? offers[0];
  const hasCoupon = kupon.trim().length > 0;
  const emailOk = !email.trim() || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

  /* --- wysyłka --- */
  async function submit() {
    setError(null);
    if (isPackage) {
      window.location.assign("/pakiet");
      return;
    }
    if (!emailOk) {
      setError("Adres e-mail wygląda na niepoprawny. Popraw go albo zostaw pole puste.");
      return;
    }
    if (!zgodaTresc || !zgodaRegulamin) {
      setError("Zaznacz obie zgody, aby kontynuować.");
      return;
    }
    setSubmitting(true);
    try {
      const body = {
        input: {
          tekst_ogloszenia: d.tekst,
          cena_pln: toInt(d.cena),
          przebieg_km: toInt(d.przebieg),
          rocznik: toInt(d.rocznik),
          historia_pojazdu: d.historia,
          odczyty_reczne: d.reczne.filter((r) => r.data && r.km).map((r) => ({ data: r.data, km: toInt(r.km) })),
          podobne_oferty:
            d.oferta === "raport_plus"
              ? d.podobne
                  .filter((o) => o.tekst.trim() || o.cena || o.rocznik || o.przebieg_km)
                  .map((o) => ({ tekst: o.tekst, cena: toInt(o.cena), rocznik: toInt(o.rocznik), przebieg_km: toInt(o.przebieg_km) }))
              : [],
          model_id: modelId || null,
          silnik_kod: modelId && engineCode ? engineCode : null,
        },
        zdjecia: photos,
        oferta: d.oferta,
        zgoda_tresc_cyfrowa: zgodaTresc,
        zgoda_regulamin: zgodaRegulamin,
        email: email.trim() || null,
        coupon: kupon.trim() || null,
      };
      let res: Response;
      try {
        res = await fetch("/api/reports", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      } catch {
        throw new Error("Brak połączenia z serwerem. Sprawdź internet – dane formularza są zapisane w tej przeglądarce.");
      }
      const j = (await res.json().catch(() => ({}))) as { redirect?: string; error?: string; field?: string };
      if (!res.ok || !j.redirect) {
        if (j.field === "coupon") {
          setKuponState({ state: "invalid", message: j.error ?? "Kod jest nieprawidłowy." });
          throw new Error(`Kod kuponu: ${j.error ?? "nieprawidłowy"}. Popraw kod albo usuń go, aby zapłacić.`);
        }
        throw new Error(friendlyError(res.status, j));
      }
      try {
        localStorage.removeItem(DRAFT_KEY);
      } catch {
        /* ignoruj */
      }
      window.location.assign(j.redirect);
    } catch (e) {
      setError((e as Error).message);
      setSubmitting(false);
    }
  }

  /* ---------- render ---------- */
  return (
    <div ref={topRef} className="scroll-mt-4 space-y-5">
      {cancelled && (
        <div className="rounded-xl border border-slate-300 bg-white p-3 text-sm" role="status">
          Płatność została anulowana. Twoje dane z formularza zostały zachowane (bez zdjęć) – możesz spróbować ponownie.
        </div>
      )}
      {fromQuickTest && (
        <div className="flex items-start gap-2 rounded-xl border border-brand-100 bg-brand-50 p-3 text-sm text-brand-900" role="status">
          <Icon name="check" className="mt-0.5 h-4 w-4" />
          Przenieśliśmy tekst ogłoszenia z szybkiego testu. Dodaj zrzuty ekranu i przejdź dalej.
        </div>
      )}

      {/* pasek postępu */}
      <ol className="grid grid-cols-4 gap-1" aria-label="Postęp">
        {STEPS.map((s, i) => (
          <li key={s}>
            <button
              type="button"
              onClick={() => (i < step || (i > step && textLen >= MIN_TEXT) ? goTo(i) : undefined)}
              className={`w-full text-left ${i <= step ? "text-brand-700" : "text-slate-400"}`}
              aria-current={i === step ? "step" : undefined}
            >
              <span className={`block h-1.5 rounded-full ${i <= step ? "bg-brand-600" : "bg-slate-200"}`} />
              <span className="mt-1 block truncate text-[11px] font-semibold sm:text-xs">
                {i + 1}. {s}
              </span>
            </button>
          </li>
        ))}
      </ol>

      {/* KROK 1 */}
      {step === 0 && (
        <section className="space-y-4 rounded-2xl bg-white p-4 shadow-sm sm:p-5">
          <h2 className="text-xl font-bold">1. Wklej ogłoszenie</h2>
          <div>
            <label htmlFor="cf-tekst" className="mb-1 block text-sm font-semibold text-slate-800">
              Tekst ogłoszenia <span aria-hidden>*</span>
            </label>
            <textarea
              id="cf-tekst"
              className={`${inputCls} min-h-48`}
              value={d.tekst}
              maxLength={MAX_TEXT}
              onChange={(e) => set("tekst", e.target.value)}
              placeholder="np. Sprzedam VW Golf VII 1.6 TDI, 2015 r., przebieg 185 000 km, serwisowany w ASO…"
              aria-describedby="cf-tekst-hint cf-tekst-count"
              aria-invalid={textLen > 0 && textLen < MIN_TEXT}
              required
            />
            <div className="mt-1 flex items-start justify-between gap-3 text-xs">
              <span id="cf-tekst-hint" className="text-slate-600">
                Skopiuj cały opis z portalu. Telefony, e-maile i nr rejestracyjne usuniemy automatycznie.
              </span>
              <span id="cf-tekst-count" className={`shrink-0 tabular-nums ${textLen < MIN_TEXT ? "font-semibold text-amber-800" : "text-emerald-800"}`} aria-live="polite">
                {textLen < MIN_TEXT ? `${textLen}/${MIN_TEXT} min.` : `${textLen.toLocaleString("pl-PL")} znaków ✓`}
              </span>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Cena (zł)">
              <input className={inputCls} inputMode="numeric" value={d.cena} onChange={(e) => set("cena", e.target.value)} placeholder="32900" />
            </Field>
            <Field label="Przebieg (km)">
              <input className={inputCls} inputMode="numeric" value={d.przebieg} onChange={(e) => set("przebieg", e.target.value)} placeholder="185000" />
            </Field>
            <Field label="Rocznik">
              <input className={inputCls} inputMode="numeric" maxLength={4} value={d.rocznik} onChange={(e) => set("rocznik", e.target.value)} placeholder="2015" />
            </Field>
          </div>

          <div>
            <span className="mb-1 block text-sm font-semibold text-slate-800">Zdjęcia / zrzuty ekranu (do {MAX_PHOTOS})</span>
            <p className="mb-2 text-xs text-slate-500">Zmniejszamy je w Twojej przeglądarce. Nie zapisujemy ich na serwerze – służą tylko do analizy.</p>
            {photos.length > 0 && (
              <ul className="mb-2 grid grid-cols-4 gap-2">
                {photos.map((p, i) => (
                  <li key={i} className="relative">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={p} alt={`Zdjęcie ${i + 1}`} className="aspect-square w-full rounded-lg object-cover" />
                    <button
                      type="button"
                      onClick={() => setPhotos((ps) => ps.filter((_, j) => j !== i))}
                      className="absolute right-1 top-1 flex h-8 w-8 items-center justify-center rounded-full bg-black/75 text-white hover:bg-black"
                      aria-label={`Usuń zdjęcie ${i + 1}`}
                    >
                      <Icon name="x" className="h-4 w-4" strokeWidth={3} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {photos.length < MAX_PHOTOS && (
              <label className="flex cursor-pointer items-center justify-center rounded-lg border-2 border-dashed border-slate-300 bg-slate-50 px-4 py-4 text-sm font-semibold text-slate-700 hover:border-brand-600">
                {photoBusy ? "Przetwarzam zdjęcia…" : `+ Dodaj zdjęcia (${photos.length}/${MAX_PHOTOS})`}
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  className="sr-only"
                  disabled={photoBusy}
                  onChange={(e) => {
                    void onFiles(e.target.files);
                    e.target.value = "";
                  }}
                />
              </label>
            )}
            {photoError && (
              <p className="mt-1 text-sm text-red-700" role="alert">
                {photoError}
              </p>
            )}
          </div>

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
            <button type="button" onClick={clearDraft} className="rounded-xl px-4 py-3 text-sm font-semibold text-slate-600 hover:bg-slate-100">
              Wyczyść formularz
            </button>
            <button
              type="button"
              disabled={textLen < MIN_TEXT || photoBusy}
              onClick={() => goTo(1)}
              className="w-full rounded-xl bg-brand-700 px-6 py-3 font-bold text-white disabled:cursor-not-allowed disabled:bg-slate-400 sm:w-auto"
            >
              {textLen < MIN_TEXT ? `Dalej (jeszcze ${MIN_TEXT - textLen} znaków)` : "Dalej"}
            </button>
          </div>
          <p className="text-xs text-slate-600">Szkic zapisujemy tylko w Twojej przeglądarce (bez zdjęć), żeby nic nie zginęło.</p>
        </section>
      )}

      {/* KROK 2 */}
      {step === 1 && (
        <section className="space-y-4 rounded-2xl bg-white p-4 shadow-sm sm:p-5">
          <h2 className="text-xl font-bold">2. Historia pojazdu (opcjonalnie)</h2>
          <p className="text-sm text-slate-600">
            Sprawdź auto bezpłatnie na gov.pl w usłudze „Historia Pojazdu” (potrzebny VIN, numer rejestracyjny i data pierwszej
            rejestracji – poproś o nie sprzedawcę). Skopiuj całą stronę wyniku i wklej poniżej. Porównamy przebiegi z badań
            technicznych z deklaracją.
          </p>
          <Field label="Wynik z „Historii Pojazdu” (wklej tekst)">
            <textarea className={`${inputCls} min-h-36`} value={d.historia} onChange={(e) => set("historia", e.target.value)} placeholder="Zaznacz wszystko na stronie wyniku (Ctrl+A), skopiuj i wklej tutaj" />
          </Field>

          <div>
            <span className="mb-1 block text-sm font-semibold text-slate-800">…albo wpisz przebiegi z badań ręcznie</span>
            <div className="space-y-2">
              {d.reczne.map((r, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input
                    type="date"
                    className={inputCls}
                    value={r.data}
                    aria-label={`Data badania ${i + 1}`}
                    onChange={(e) => set("reczne", d.reczne.map((x, j) => (j === i ? { ...x, data: e.target.value } : x)))}
                  />
                  <input
                    className={inputCls}
                    inputMode="numeric"
                    placeholder="km"
                    value={r.km}
                    aria-label={`Przebieg ${i + 1}`}
                    onChange={(e) => set("reczne", d.reczne.map((x, j) => (j === i ? { ...x, km: e.target.value } : x)))}
                  />
                  <button
                    type="button"
                    className="shrink-0 rounded-lg px-3 py-2 text-slate-500 hover:bg-slate-100"
                    aria-label="Usuń wiersz"
                    onClick={() => set("reczne", d.reczne.length > 1 ? d.reczne.filter((_, j) => j !== i) : [{ data: "", km: "" }])}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
            {d.reczne.length < 30 && (
              <button type="button" className="mt-2 text-sm font-semibold text-brand-700" onClick={() => set("reczne", [...d.reczne, { data: "", km: "" }])}>
                + Dodaj odczyt
              </button>
            )}
          </div>

          <Nav onBack={() => goTo(0)} onNext={() => goTo(2)} nextLabel={d.historia || d.reczne.some((r) => r.km) ? "Dalej" : "Pomiń"} />
        </section>
      )}

      {/* KROK 3 */}
      {step === 2 && (
        <section className="space-y-4 rounded-2xl bg-white p-4 shadow-sm sm:p-5">
          <h2 className="text-xl font-bold">3. Podobne oferty (opcjonalnie)</h2>
          <p className="text-sm text-slate-600">
            Wklej do 5 podobnych ogłoszeń (ten sam model, zbliżony rocznik i przebieg). Zestawimy ceny w tabeli.{" "}
            <strong>Porównanie cen jest w pakiecie Raport+.</strong>
          </p>
          {d.podobne.map((o, i) => (
            <div key={i} className="space-y-2 rounded-xl border border-slate-200 p-3">
              <div className="flex items-center justify-between">
                <span className="font-semibold">Oferta {i + 1}</span>
                <button type="button" className="text-sm text-slate-500" onClick={() => set("podobne", d.podobne.filter((_, j) => j !== i))}>
                  Usuń
                </button>
              </div>
              <textarea
                className={`${inputCls} min-h-24`}
                placeholder="Wklej tekst ogłoszenia…"
                value={o.tekst}
                onChange={(e) => set("podobne", d.podobne.map((x, j) => (j === i ? { ...x, tekst: e.target.value } : x)))}
              />
              <div className="grid grid-cols-3 gap-2">
                {(["cena", "rocznik", "przebieg_km"] as const).map((k) => (
                  <input
                    key={k}
                    className={inputCls}
                    inputMode="numeric"
                    placeholder={k === "cena" ? "cena zł" : k === "rocznik" ? "rocznik" : "przebieg km"}
                    aria-label={`${k} oferty ${i + 1}`}
                    value={o[k]}
                    onChange={(e) => set("podobne", d.podobne.map((x, j) => (j === i ? { ...x, [k]: e.target.value } : x)))}
                  />
                ))}
              </div>
            </div>
          ))}
          {d.podobne.length < 5 && (
            <button
              type="button"
              className="w-full rounded-lg border-2 border-dashed border-slate-300 py-3 text-sm font-semibold text-slate-700"
              onClick={() => set("podobne", [...d.podobne, { tekst: "", cena: "", rocznik: "", przebieg_km: "" }])}
            >
              + Dodaj podobną ofertę ({d.podobne.length}/5)
            </button>
          )}
          <Nav
            onBack={() => goTo(1)}
            onNext={() => {
              if (d.podobne.length > 0 && d.oferta === "raport") set("oferta", "raport_plus");
              goTo(3);
            }}
            nextLabel={d.podobne.length ? "Dalej" : "Pomiń"}
          />
        </section>
      )}

      {/* KROK 4 */}
      {step === 3 && (
        <section className="space-y-5 rounded-2xl bg-white p-4 shadow-sm sm:p-5">
          <h2 className="text-xl font-bold">4. Model, pakiet i płatność</h2>

          <div className="space-y-3">
            {models === null && !detectError && <p className="text-sm text-slate-500">Rozpoznaję model z ogłoszenia…</p>}
            {detectError && <p className="text-sm text-red-700">{detectError}</p>}
            {models !== null && (
              <>
                {candidates[0] ? (
                  <p className="rounded-lg bg-brand-50 p-3 text-sm">
                    Rozpoznaliśmy: <strong>{candidates[0].label}</strong>
                    {candidates[0].engineCode ? <>, silnik <strong>{candidates[0].engineCode}</strong></> : null}. Popraw, jeśli to nie ten.
                  </p>
                ) : (
                  <p className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
                    {models.length === 0
                      ? "Baza modeli jest jeszcze pusta."
                      : "Nie rozpoznaliśmy modelu z naszej bazy w treści ogłoszenia."}{" "}
                    Wybierz model z listy albo zostaw „Brak w bazie” – wtedy raport pokaże ogólne zasady zamiast typowych usterek konkretnego modelu.
                  </p>
                )}
                <Field label="Model">
                  <select
                    className={inputCls}
                    value={modelId}
                    onChange={(e) => {
                      setModelId(e.target.value);
                      const c = candidates.find((x) => x.modelId === e.target.value);
                      setEngineCode(c?.engineCode ?? "");
                    }}
                  >
                    <option value="">— Brak w bazie / nie wiem —</option>
                    {models.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.label} ({m.years[0]}–{m.years[1]})
                      </option>
                    ))}
                  </select>
                </Field>
                {selectedModel && (
                  <Field label="Silnik" hint="Jeśli nie wiesz – zostaw „nie wiem”, raport uwzględni usterki wszystkich silników.">
                    <select className={inputCls} value={engineCode} onChange={(e) => setEngineCode(e.target.value)}>
                      <option value="">— nie wiem —</option>
                      {selectedModel.engines.map((e) => (
                        <option key={e.code} value={e.code}>
                          {e.code} ({e.fuel})
                        </option>
                      ))}
                    </select>
                  </Field>
                )}
                {!modelId && (
                  <p className="text-sm font-semibold text-amber-800">
                    Tego modelu nie ma w naszej bazie – sekcja „Typowe usterki” będzie zawierać tylko zasady ogólne.
                  </p>
                )}
              </>
            )}
          </div>

          <fieldset>
            <legend className="mb-2 text-sm font-semibold text-slate-800">Wybierz ofertę</legend>
            <div className="grid gap-2 sm:grid-cols-3">
              {[...offers.map((o) => ({ id: o.id as OfferChoice, nazwa: o.nazwa, cenaGr: o.cenaGr, zawiera: o.zawiera })), { id: "pakiet5" as OfferChoice, ...pkg }].map((o) => {
                const active = d.oferta === o.id;
                return (
                  <label
                    key={o.id}
                    className={`relative flex cursor-pointer flex-col rounded-xl border-2 p-3 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-brand-600 ${active ? "border-brand-600 bg-brand-50" : "border-slate-200 bg-white hover:border-slate-400"}`}
                  >
                    <input type="radio" name="oferta" value={o.id} checked={active} onChange={() => chooseOffer(o.id)} className="sr-only" />
                    <span className="flex items-start justify-between gap-2">
                      <span className="font-bold">{o.nazwa}</span>
                      {active && <Icon name="check" className="h-5 w-5 text-brand-700" strokeWidth={3} />}
                    </span>
                    <span className="text-xl font-extrabold text-brand-700">{formatPln(o.cenaGr)}</span>
                    <ul className="mt-1 space-y-0.5 text-xs text-slate-700">
                      {o.zawiera.map((z) => (
                        <li key={z}>• {z}</li>
                      ))}
                    </ul>
                  </label>
                );
              })}
            </div>
            {d.oferta === "raport" && d.podobne.length > 0 && (
              <p className="mt-2 text-xs text-amber-800">Dodane podobne oferty zostaną pominięte – porównanie cen jest tylko w Raport+.</p>
            )}
            {isPackage && (
              <p className="mt-2 rounded-lg border border-brand-100 bg-brand-50 p-3 text-sm text-brand-900">
                Pakiet to kod na kilka raportów. Najpierw kupisz kod, a potem wrócisz tutaj – formularz zostanie zachowany – i wpiszesz go
                w polu „Kod kuponu”. Ten raport nie będzie Cię już nic kosztował.
              </p>
            )}
          </fieldset>

          {!isPackage && (
            <div>
              <label htmlFor="cf-kupon" className="mb-1 block text-sm font-semibold text-slate-800">
                Kod kuponu (opcjonalnie)
              </label>
              <div className="flex gap-2">
                <input
                  id="cf-kupon"
                  className={`${inputCls} font-mono uppercase`}
                  value={kupon}
                  onChange={(e) => {
                    setKupon(e.target.value);
                    setKuponState({ state: "idle", message: null });
                  }}
                  placeholder="np. ABCD-EFGH"
                  autoComplete="off"
                  autoCapitalize="characters"
                  spellCheck={false}
                  maxLength={20}
                  aria-describedby="cf-kupon-msg"
                  aria-invalid={kuponState.state === "invalid"}
                />
                <button
                  type="button"
                  onClick={checkCoupon}
                  disabled={!hasCoupon || kuponState.state === "checking"}
                  className="shrink-0 rounded-lg border-2 border-brand-600 px-4 font-semibold text-brand-700 hover:bg-brand-50 disabled:border-slate-300 disabled:text-slate-500"
                >
                  {kuponState.state === "checking" ? "Sprawdzam…" : "Sprawdź"}
                </button>
              </div>
              <p
                id="cf-kupon-msg"
                aria-live="polite"
                className={`mt-1 text-xs ${kuponState.state === "valid" ? "font-semibold text-emerald-800" : kuponState.state === "invalid" ? "font-semibold text-red-700" : "text-slate-600"}`}
              >
                {kuponState.message ?? "Masz kod z pakietu 5 raportów lub kod promocyjny? Wpisz go tutaj."}
              </p>
            </div>
          )}

          <Field label="E-mail (zalecany)" hint="Wyślemy link do raportu, żeby nie zginął – raport jest dostępny przez 30 dni. Nie wysyłamy reklam.">
            <input
              type="email"
              className={inputCls}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="ty@example.com"
              autoComplete="email"
              inputMode="email"
              aria-invalid={!emailOk}
            />
          </Field>
          {!emailOk && <p className="-mt-3 text-xs font-semibold text-red-700">Sprawdź adres e-mail (np. ty@example.com).</p>}

          <div className="space-y-3 text-sm">
            <label className="flex items-start gap-3">
              <input
                type="checkbox"
                className="mt-0.5 h-5 w-5 shrink-0"
                checked={zgodaTresc}
                onChange={(e) => setZgodaTresc(e.target.checked)}
                aria-required="true"
              />
              {/* Treść 1:1 z docs/regulamin.md § 6 ust. 3 – nie zmieniać bez zmiany regulaminu. */}
              <span>Żądam natychmiastowego dostarczenia raportu. Wiem, że po jego dostarczeniu tracę prawo odstąpienia od umowy.</span>
              <span className="sr-only">(wymagane)</span>
            </label>
            <label className="flex items-start gap-3">
              <input
                type="checkbox"
                className="mt-0.5 h-5 w-5 shrink-0"
                checked={zgodaRegulamin}
                onChange={(e) => setZgodaRegulamin(e.target.checked)}
                aria-required="true"
              />
              <span>
                Akceptuję{" "}
                <a href="/regulamin" target="_blank" className="font-semibold text-brand-700 underline">
                  regulamin
                </a>{" "}
                i zapoznałem/am się z{" "}
                <a href="/polityka-prywatnosci" target="_blank" className="font-semibold text-brand-700 underline">
                  polityką prywatności
                </a>
                . *
              </span>
            </label>
          </div>

          <p className="rounded-lg bg-slate-50 p-3 text-xs text-slate-700">
            Raport tworzy automatycznie sztuczna inteligencja na podstawie tego, co wkleisz – to pomoc w decyzji, nie ekspertyza ani gwarancja
            stanu auta, więc przed zakupem pokaż auto mechanikowi.
          </p>

          {!isPackage && (!zgodaTresc || !zgodaRegulamin) && !error && (
            <p className="text-xs text-slate-600">Zaznacz oba oświadczenia, aby przejść dalej.</p>
          )}
          {error && (
            <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800" role="alert">
              {error}
            </p>
          )}

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
            <button type="button" onClick={() => goTo(2)} className="rounded-xl px-6 py-3 font-semibold text-slate-700 hover:bg-slate-100">
              Wstecz
            </button>
            <button
              type="button"
              onClick={submit}
              disabled={submitting || (!isPackage && (!zgodaTresc || !zgodaRegulamin)) || (models === null && !detectError)}
              className="rounded-xl bg-brand-700 px-6 py-4 text-lg font-bold text-white disabled:cursor-not-allowed disabled:bg-slate-400"
            >
              {submitting
                ? "Przetwarzam…"
                : isPackage
                  ? `Kup pakiet ${formatPln(pkg.cenaGr)} →`
                  : hasCoupon
                    ? "Generuj raport z kodu"
                    : skipPayment
                      ? `Generuj raport (tryb testowy)`
                      : `Zapłać ${formatPln(offer.cenaGr)} – BLIK`}
            </button>
          </div>
        </section>
      )}
    </div>
  );
}

function Nav({ onBack, onNext, nextLabel }: { onBack: () => void; onNext: () => void; nextLabel: string }) {
  return (
    <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
      <button type="button" onClick={onBack} className="rounded-xl px-6 py-3 font-semibold text-slate-700 hover:bg-slate-100">
        Wstecz
      </button>
      <button type="button" onClick={onNext} className="rounded-xl bg-brand-700 px-6 py-3 font-bold text-white">
        {nextLabel}
      </button>
    </div>
  );
}
