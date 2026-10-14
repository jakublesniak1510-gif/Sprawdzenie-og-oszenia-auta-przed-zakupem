"use server";

import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { track } from "@/lib/analytics";
import { addFeedback, getReport, hasFeedback, resetErrorToPaid } from "@/lib/db";
import { enqueueGeneration } from "@/lib/queue";

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
  addFeedback(id, helpful === "tak", comment);
  track("feedback", { report_id: id, pomogl: helpful === "tak", komentarz: !!comment });
  return { ok: true, message: "Dziękujemy! To pomaga nam ulepszać raporty." };
}

export async function retryGeneration(form: FormData): Promise<void> {
  const id = String(form.get("id") ?? "");
  if (resetErrorToPaid(id)) after(() => enqueueGeneration(id));
  revalidatePath(`/raport/${id}`);
}
