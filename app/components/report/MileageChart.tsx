/**
 * Wykres przebiegów z badań technicznych – czysty SVG, bez bibliotek, renderowany na serwerze.
 * Jedna seria (linia 2 px, punkty 8 px), przerywana linia odniesienia = przebieg deklarowany.
 * Spadek licznika: odcinek czerwony I przerywany + znacznik „↓” (nie tylko kolor – czytelne też w druku cz-b).
 * Tabela odczytów obok wykresu pełni rolę widoku tabelarycznego.
 */

interface Reading {
  data: string;
  km: number;
}

const W = 400;
const H = 220;
const PAD = { l: 50, r: 12, t: 22, b: 28 };

const fmtK = (km: number) => `${Math.round(km / 1000).toLocaleString("pl-PL")} tys.`;

function niceStep(range: number): number {
  const raw = range / 4;
  const pow = 10 ** Math.floor(Math.log10(Math.max(raw, 1)));
  const n = raw / pow;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * pow;
}

export function MileageChart({ readings, declaredKm }: { readings: Reading[]; declaredKm: number | null }) {
  const pts = readings
    .map((r) => ({ ...r, t: Date.parse(r.data) }))
    .filter((r) => Number.isFinite(r.t))
    .sort((a, b) => a.t - b.t);
  if (pts.length === 0) return null;

  const t0 = pts[0].t;
  const t1 = pts.length > 1 ? pts[pts.length - 1].t : t0 + 365 * 864e5;
  const maxKm = Math.max(...pts.map((p) => p.km), declaredKm ?? 0);
  const step = niceStep(maxKm || 1);
  const yMax = Math.ceil((maxKm * 1.05) / step) * step || step;

  const x = (t: number) => PAD.l + ((t - t0) / (t1 - t0 || 1)) * (W - PAD.l - PAD.r);
  const y = (km: number) => H - PAD.b - (km / yMax) * (H - PAD.t - PAD.b);

  const yTicks: number[] = [];
  for (let v = 0; v <= yMax; v += step) yTicks.push(v);
  const y0 = new Date(t0).getFullYear();
  const y1 = new Date(t1).getFullYear();
  const yearStep = Math.max(1, Math.ceil((y1 - y0 + 1) / 6));
  const xTicks: number[] = [];
  for (let yr = y0; yr <= y1 + 1; yr += yearStep) {
    const t = Date.UTC(yr, 0, 1);
    if (t >= t0 && t <= t1) xTicks.push(t);
  }

  return (
    <figure className="print-avoid w-full">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="h-auto w-full"
        role="img"
        aria-label={`Wykres przebiegu: ${pts.map((p) => `${p.data} ${p.km} km`).join(", ")}${declaredKm !== null ? `; deklarowany ${declaredKm} km` : ""}`}
      >
        {/* siatka i oś Y */}
        {yTicks.map((v) => (
          <g key={v}>
            <line x1={PAD.l} x2={W - PAD.r} y1={y(v)} y2={y(v)} stroke="#e2e8f0" strokeWidth={1} />
            <text x={PAD.l - 8} y={y(v) + 4} textAnchor="end" fontSize={11} fill="#64748b">
              {fmtK(v)}
            </text>
          </g>
        ))}
        {/* oś X – lata */}
        {xTicks.map((t) => (
          <text key={t} x={x(t)} y={H - 10} textAnchor="middle" fontSize={11} fill="#64748b">
            {new Date(t).getFullYear()}
          </text>
        ))}
        <line x1={PAD.l} x2={W - PAD.r} y1={y(0)} y2={y(0)} stroke="#94a3b8" strokeWidth={1} />

        {/* przebieg deklarowany */}
        {declaredKm !== null && (
          <g>
            <line x1={PAD.l} x2={W - PAD.r} y1={y(declaredKm)} y2={y(declaredKm)} stroke="#475569" strokeWidth={1.5} strokeDasharray="6 4" />
            <text x={PAD.l + 4} y={y(declaredKm) - 6} textAnchor="start" fontSize={11} fill="#334155" fontWeight={600}>
              deklarowany: {declaredKm.toLocaleString("pl-PL")} km
            </text>
          </g>
        )}

        {/* odcinki */}
        {pts.slice(1).map((p, i) => {
          const prev = pts[i];
          const down = p.km < prev.km;
          return (
            <line
              key={`s${i}`}
              x1={x(prev.t)}
              y1={y(prev.km)}
              x2={x(p.t)}
              y2={y(p.km)}
              stroke={down ? "#b91c1c" : "#1d4ed8"}
              strokeWidth={2}
              strokeDasharray={down ? "4 3" : undefined}
              strokeLinecap="round"
            />
          );
        })}

        {/* punkty (z natywnym tooltipem) */}
        {pts.map((p, i) => {
          const down = i > 0 && p.km < pts[i - 1].km;
          return (
            <g key={`p${i}`}>
              <circle cx={x(p.t)} cy={y(p.km)} r={4} fill={down ? "#b91c1c" : "#1d4ed8"} stroke="#fff" strokeWidth={2}>
                <title>{`${p.data}: ${p.km.toLocaleString("pl-PL")} km${down ? " (niższy niż poprzedni odczyt)" : ""}`}</title>
              </circle>
              {down && (
                <text x={x(p.t)} y={y(p.km) + 18} textAnchor="middle" fontSize={12} fontWeight={700} fill="#b91c1c">
                  ↓
                </text>
              )}
            </g>
          );
        })}
      </svg>
      <figcaption className="mt-1 text-xs text-slate-500">
        Linia ciągła: odczyty licznika z badań technicznych. Linia przerywana szara: przebieg deklarowany. Odcinek czerwony
        przerywany ze znakiem ↓: odczyt niższy niż poprzedni – do wyjaśnienia ze sprzedawcą.
      </figcaption>
    </figure>
  );
}
