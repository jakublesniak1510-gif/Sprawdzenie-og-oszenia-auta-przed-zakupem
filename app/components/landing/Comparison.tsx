import { Icon } from "@/components/ui/icons";
import { Md } from "./Md";

function kind(v: string): "yes" | "no" | "partial" | "text" {
  const s = v.trim().toLowerCase();
  if (/^(tak|✓|✔|yes)\b/.test(s)) return "yes";
  if (/^(nie|✗|✘|×|no|—|-)\b/.test(s) || s === "—" || s === "-") return "no";
  if (/^(częściowo|czesciowo|czasem|partial|~|z doświadczenia)/.test(s)) return "partial";
  return "text";
}

/** Komórka porównania: ikona + oryginalny tekst (informacja nie tylko kolorem). */
function Cell({ v, ours = false }: { v: string; ours?: boolean }) {
  const k = kind(v);
  return (
    <span className={`inline-flex items-start gap-1.5 ${ours ? "font-semibold" : ""}`}>
      {k === "yes" && <Icon name="check" className="mt-0.5 h-4 w-4 text-emerald-700" strokeWidth={3} />}
      {k === "no" && <Icon name="x" className="mt-0.5 h-4 w-4 text-slate-500" strokeWidth={3} />}
      {k === "partial" && <Icon name="minus" className="mt-0.5 h-4 w-4 text-amber-700" strokeWidth={3} />}
      <Md text={v} />
    </span>
  );
}

export function Comparison({ head, rows, note }: { head: string[]; rows: string[][]; note: string | null }) {
  const cols = head.slice(1);
  return (
    <div className="space-y-3">
      {/* Telefon: karty per kryterium */}
      <ul className="space-y-2 sm:hidden">
        {rows.map((r, i) => (
          <li key={i} className="rounded-xl bg-white p-3 shadow-sm">
            <Md text={r[0]} as="p" className="font-semibold" />
            <dl className="mt-2 space-y-1.5 text-sm">
              {cols.map((c, j) => (
                <div key={j} className={`grid grid-cols-[minmax(0,7.5rem)_1fr] gap-2 ${j === 0 ? "rounded-md bg-brand-50 p-1 -m-1" : ""}`}>
                  <dt className="text-slate-600">
                    <Md text={c} />
                  </dt>
                  <dd>
                    <Cell v={r[j + 1] ?? ""} ours={j === 0} />
                  </dd>
                </div>
              ))}
            </dl>
          </li>
        ))}
      </ul>
      {/* Tablet/desktop: tabela */}
      <div className="hidden overflow-hidden rounded-2xl bg-white shadow-sm sm:block">
        <table className="w-full text-sm">
          <caption className="sr-only">Porównanie: nasz raport, raport historii pojazdu i mechanik na oględzinach</caption>
          <thead>
            <tr className="bg-slate-100 text-left align-bottom">
              <th scope="col" className="w-1/4 px-3 py-2">
                <span className="sr-only">Kryterium</span>
              </th>
              {cols.map((c, j) => (
                <th key={j} scope="col" className={`px-3 py-2 font-semibold ${j === 0 ? "bg-brand-100 text-brand-900" : "text-slate-800"}`}>
                  <Md text={c} />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className="border-t border-slate-200 align-top">
                <th scope="row" className="px-3 py-2 text-left font-medium text-slate-900">
                  <Md text={r[0]} />
                </th>
                {cols.map((_, j) => (
                  <td key={j} className={`px-3 py-2 ${j === 0 ? "bg-brand-50" : ""}`}>
                    <Cell v={r[j + 1] ?? ""} ours={j === 0} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {note && <Md text={note} as="p" className="text-sm text-slate-700" />}
    </div>
  );
}
