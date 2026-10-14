"use client";

import { useState } from "react";
import { copyText } from "./clipboard";
import { Icon } from "./icons";

export function CopyButton({
  text,
  label = "Kopiuj",
  copiedLabel = "Skopiowano!",
  className = "",
}: {
  text: string;
  label?: string;
  copiedLabel?: string;
  className?: string;
}) {
  const [state, setState] = useState<"idle" | "ok" | "fail">("idle");
  return (
    <>
      <button
        type="button"
        onClick={async () => {
          setState((await copyText(text)) ? "ok" : "fail");
          setTimeout(() => setState("idle"), 2500);
        }}
        className={`no-print inline-flex items-center justify-center gap-2 rounded-xl border-2 border-brand-600 bg-white px-4 py-2.5 text-sm font-semibold text-brand-700 hover:bg-brand-50 ${className}`}
      >
        <Icon name={state === "ok" ? "check" : "copy"} className="h-4 w-4" />
        {state === "ok" ? copiedLabel : label}
      </button>
      <span role="status" aria-live="polite" className="sr-only">
        {state === "ok" ? copiedLabel : state === "fail" ? "Nie udało się skopiować – zaznacz tekst ręcznie." : ""}
      </span>
      {state === "fail" && <p className="mt-1 text-xs text-red-700">Nie udało się skopiować – zaznacz tekst ręcznie.</p>}
    </>
  );
}
