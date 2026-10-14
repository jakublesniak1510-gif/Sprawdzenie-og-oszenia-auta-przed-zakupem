/** Kopiowanie do schowka z fallbackiem (stare przeglądarki / brak HTTPS): ukryte textarea + execCommand. */
export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* fallback niżej */
  }
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

/** Web Share API z fallbackiem: kopiuje tekst + link. Zwraca, co się stało. */
export async function shareOrCopy(data: { title: string; text: string; url?: string }): Promise<"shared" | "copied" | "cancelled" | "failed"> {
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
  if (typeof nav.share === "function") {
    try {
      await nav.share(data);
      return "shared";
    } catch (e) {
      if ((e as DOMException)?.name === "AbortError") return "cancelled";
      /* np. brak uprawnień – kopiujemy */
    }
  }
  return (await copyText(data.url ? `${data.text}\n${data.url}` : data.text)) ? "copied" : "failed";
}
