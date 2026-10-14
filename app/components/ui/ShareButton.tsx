"use client";

import { useState } from "react";
import { shareOrCopy } from "./clipboard";
import { Icon } from "./icons";

/** „Udostępnij”: Web Share API (telefon), w przeciwnym razie kopiuje tekst i link do schowka. */
export function ShareButton({
  title,
  text,
  url,
  label = "Udostępnij",
  className = "",
}: {
  title: string;
  text: string;
  /** Domyślnie bieżący adres strony. Pusty string = bez linku. */
  url?: string;
  label?: string;
  className?: string;
}) {
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <>
      <button
        type="button"
        onClick={async () => {
          const link = url === undefined ? window.location.href : url || undefined;
          const r = await shareOrCopy({ title, text, url: link });
          setMsg(r === "copied" ? "Skopiowano do schowka – wklej w wiadomości." : r === "failed" ? "Nie udało się udostępnić. Skopiuj tekst ręcznie." : null);
          if (r === "copied") setTimeout(() => setMsg(null), 3500);
        }}
        className={`no-print inline-flex items-center justify-center gap-2 rounded-xl bg-brand-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-900 ${className}`}
      >
        <Icon name="share" className="h-4 w-4" />
        {label}
      </button>
      <span role="status" aria-live="polite" className={msg ? "mt-1 block text-xs text-slate-700" : "sr-only"}>
        {msg ?? ""}
      </span>
    </>
  );
}
