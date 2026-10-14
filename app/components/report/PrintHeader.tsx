/**
 * Nagłówek i stopka wydruku powtarzane na każdej stronie – przez marginesy strony CSS (`@page @top-left` itd.,
 * Chrome/Edge 131+). Dodatkowo blok `print:block` na początku wydruku (działa w każdej przeglądarce).
 * Wartości są bezpieczne: data i numer raportu (UUID zweryfikowany regexem), tekst stały.
 */
const esc = (s: string) => s.replace(/[\\"]/g, "\\$&").replace(/[\n\r<>]/g, " ");

export function PrintHeader({ title, reportNo, date }: { title: string; reportNo: string; date: string }) {
  const left = esc(`${title} · nr ${reportNo}`);
  const right = esc(`Wygenerowano ${date}`);
  const css = `@page{@top-left{content:"${left}";font-size:8pt;color:#475569}@top-right{content:"${right}";font-size:8pt;color:#475569}@bottom-left{content:"Raport jest pomocą, nie ekspertyzą. Przed zakupem zrób oględziny u niezależnego mechanika.";font-size:7pt;color:#475569}@bottom-right{content:"str. " counter(page) " / " counter(pages);font-size:8pt;color:#475569}}`;
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: css }} />
      <div className="hidden border-b border-slate-400 pb-2 text-[9pt] text-slate-700 print:block">
        <div className="flex justify-between gap-4">
          <strong>SprawdźOgłoszenie – {title}</strong>
          <span>
            nr {reportNo} · {date}
          </span>
        </div>
        <div>Raport jest pomocą, nie ekspertyzą. Przed zakupem zrób oględziny u niezależnego mechanika.</div>
      </div>
    </>
  );
}
