"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
  oferta: Offer["id"];
}

const MAX_PHOTOS = 8;
const MAX_SIDE = 1280;
const JPEG_QUALITY = 0.8;
const MIN_TEXT = 100;
const DRAFT_KEY = "sprawdz-draft-v1";
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

export function CheckForm({ offers, skipPayment, cancelled }: { offers: Offer[]; skipPayment: boolean; cancelled: boolean }) {
  const [step, setStep] = useState(0);
  const [d, setD] = useState<Draft>(emptyDraft);
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

  // Szkic (bez zdjęć) w sessionStorage – przydaje się po powrocie z anulowanej płatności.
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(DRAFT_KEY);
      if (raw) setD({ ...emptyDraft, ...(JSON.parse(raw) as Partial<Draft>) });
    } catch {
      /* brak dostępu do storage – OK */
    }
  }, []);
  useEffect(() => {
    try {
      sessionStorage.setItem(DRAFT_KEY, JSON.stringify(d));
    } catch {
      /* ignoruj */
    }
  }, [d]);

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((p) => ({ ...p, [k]: v }));
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
  const offer = offers.find((o) => o.id === d.oferta)!;

  /* --- wysyłka --- */
  async function submit() {
    setError(null);
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
      };
      const res = await fetch("/api/reports", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      const j = (await res.json().catch(() => ({}))) as { redirect?: string; error?: string };
      if (!res.ok || !j.redirect) throw new Error(j.error || "Coś poszło nie tak. Spróbuj ponownie.");
      try {
        sessionStorage.removeItem(DRAFT_KEY);
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
        <div className="rounded-xl border border-slate-300 bg-white p-3 text-sm">
          Płatność została anulowana. Twoje dane z formularza zostały zachowane (bez zdjęć) – możesz spróbować ponownie.
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
          <Field label="Tekst ogłoszenia *" hint={`Skopiuj cały opis z portalu. Min. ${MIN_TEXT} znaków (teraz: ${textLen}). Telefony, e-maile i nr rejestracyjne usuniemy automatycznie.`}>
            <textarea
              className={`${inputCls} min-h-48`}
              value={d.tekst}
              onChange={(e) => set("tekst", e.target.value)}
              placeholder="np. Sprzedam VW Golf VII 1.6 TDI, 2015 r., przebieg 185 000 km, serwisowany w ASO…"
              required
            />
          </Field>
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
                      className="absolute right-1 top-1 rounded-full bg-black/70 px-2 text-sm text-white"
                      aria-label={`Usuń zdjęcie ${i + 1}`}
                    >
                      ×
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
            {photoError && <p className="mt-1 text-sm text-red-700">{photoError}</p>}
          </div>

          <div className="flex justify-end">
            <button
              type="button"
              disabled={textLen < MIN_TEXT || photoBusy}
              onClick={() => goTo(1)}
              className="w-full rounded-xl bg-brand-700 px-6 py-3 font-bold text-white disabled:cursor-not-allowed disabled:bg-slate-300 sm:w-auto"
            >
              Dalej
            </button>
          </div>
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
            <legend className="mb-2 text-sm font-semibold text-slate-800">Pakiet</legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {offers.map((o) => (
                <label
                  key={o.id}
                  className={`cursor-pointer rounded-xl border-2 p-3 ${d.oferta === o.id ? "border-brand-600 bg-brand-50" : "border-slate-200"}`}
                >
                  <input type="radio" name="oferta" value={o.id} checked={d.oferta === o.id} onChange={() => set("oferta", o.id)} className="sr-only" />
                  <span className="flex items-baseline justify-between">
                    <span className="font-bold">{o.nazwa}</span>
                    <span className="text-lg font-extrabold text-brand-700">{formatPln(o.cenaGr)}</span>
                  </span>
                  <span className="mt-1 block text-xs text-slate-600">{o.zawiera.join(" · ")}</span>
                </label>
              ))}
            </div>
            {d.oferta === "raport" && d.podobne.length > 0 && (
              <p className="mt-2 text-xs text-amber-800">Dodane podobne oferty zostaną pominięte – porównanie cen jest tylko w Raport+.</p>
            )}
          </fieldset>

          <Field label="E-mail (opcjonalnie)" hint="Do potwierdzenia płatności. Nie wysyłamy reklam.">
            <input type="email" className={inputCls} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="ty@example.com" autoComplete="email" />
          </Field>

          <div className="space-y-3 text-sm">
            <label className="flex items-start gap-3">
              <input type="checkbox" className="mt-0.5 h-5 w-5 shrink-0" checked={zgodaTresc} onChange={(e) => setZgodaTresc(e.target.checked)} />
              <span>
                Żądam natychmiastowego dostarczenia treści cyfrowej i przyjmuję do wiadomości utratę prawa odstąpienia od umowy. *
              </span>
            </label>
            <label className="flex items-start gap-3">
              <input type="checkbox" className="mt-0.5 h-5 w-5 shrink-0" checked={zgodaRegulamin} onChange={(e) => setZgodaRegulamin(e.target.checked)} />
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

          <p className="rounded-lg bg-slate-50 p-3 text-xs text-slate-600">
            Raport jest pomocą, nie ekspertyzą. Przed zakupem zrób oględziny auta u niezależnego mechanika.
          </p>

          {error && (
            <p className="rounded-lg bg-red-50 p-3 text-sm text-red-800" role="alert">
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
              disabled={submitting || !zgodaTresc || !zgodaRegulamin || (models === null && !detectError)}
              className="rounded-xl bg-brand-700 px-6 py-4 text-lg font-bold text-white disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              {submitting ? "Przetwarzam…" : skipPayment ? `Generuj raport (tryb testowy)` : `Zapłać ${formatPln(offer.cenaGr)} – BLIK`}
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
