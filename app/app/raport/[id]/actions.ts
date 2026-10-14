"use server";

import { headers } from "next/headers";
import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { track } from "@/lib/analytics";
import { addFeedback, getReport, hasFeedback, resetErrorToPaid } from "@/lib/db";
import { enqueueGeneration } from "@/lib/queue";
import { clientIpFromHeaders, takeToken } from "@/lib/rate-limit";

export interface FeedbackState {
  ok: boolean;
  message: string | null;
}

export async function sendFeedback(_prev: FeedbackState, form: FormData): Promise<FeedbackState> {
  const id = String(form.get("id") ?? "");
  const helpful = form.get("pomogl");
  const comment = String(form.get("komentarz") ?? "").trim().slice(0, 2000) || null;
  if (!getReport(id)) return { ok: false, message: "Raport nie istnieje lub wygasł." };
  if (helpful !== "tak" && helpful !== "nie") return { ok: false, message: "Wybierz „Tak” albo „Nie”." };
  if (hasFeedback(id)) return { ok: true, message: "Już mamy Twoją odpowiedź – dziękujemy!" };
  if (takeToken("boughtAnswer", clientIpFromHeaders(await headers())) > 0) return { ok: false, message: "Zbyt wiele prób – spróbuj za kilka minut." };
  addFeedback(id, helpful === "tak", comment);
  track("feedback", { report_id: id, pomogl: helpful === "tak", komentarz: !!comment });
  return { ok: true, message: "Dziękujemy! To pomaga nam ulepszać raporty." };
}

/**
 * „Spróbuj ponownie”: najwyżej 1 ręczne ponowienie na raport (manual_retries, warunek w SQL)
 * i limit 3 kliknięć / 10 min / IP – płatne wywołania AI nie mogą być wyzwalane w pętli.
 */
export async function retryGeneration(form: FormData): Promise<void> {
  const id = String(form.get("id") ?? "");
  const ip = clientIpFromHeaders(await headers());
  if (takeToken("retryGeneration", ip) === 0 && resetErrorToPaid(id)) after(() => enqueueGeneration(id));
  revalidatePath(`/raport/${id}`);
}
