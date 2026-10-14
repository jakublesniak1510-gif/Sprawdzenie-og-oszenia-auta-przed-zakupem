/**
 * Wysyłka e-maili. Dostawca wybierany przez EMAIL_PROVIDER:
 * - `resend` – REST API Resend (fetch, bez SDK): RESEND_API_KEY,
 * - `smtp`   – dowolny serwer SMTP przez nodemailer: SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD, SMTP_SECURE,
 * - `none`   – (domyślnie) nic nie wysyła, tylko loguje temat i adresata.
 * Nadawca: EMAIL_FROM, np. „Sprawdź Ogłoszenie <raporty@twojadomena.pl>”; odpowiedzi: EMAIL_REPLY_TO (opcjonalnie).
 */

export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  text: string;
}

export interface SendResult {
  ok: boolean;
  provider: string;
  id?: string;
  error?: string;
}

type Provider = "resend" | "smtp" | "none";

export function emailProvider(): Provider {
  const p = (process.env.EMAIL_PROVIDER ?? "none").toLowerCase();
  return p === "resend" || p === "smtp" ? p : "none";
}

const from = () => process.env.EMAIL_FROM || "Sprawdź Ogłoszenie <no-reply@localhost>";

/** Maskuje adres w logach: j***@gmail.com. */
export function maskEmail(e: string): string {
  const [u, d] = e.split("@");
  return `${u?.[0] ?? ""}***@${d ?? ""}`;
}

async function sendResend(msg: EmailMessage): Promise<SendResult> {
  const key = process.env.RESEND_API_KEY;
  if (!key) return { ok: false, provider: "resend", error: "Brak RESEND_API_KEY" };
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: from(),
      to: [msg.to],
      subject: msg.subject,
      html: msg.html,
      text: msg.text,
      ...(process.env.EMAIL_REPLY_TO ? { reply_to: process.env.EMAIL_REPLY_TO } : {}),
    }),
    signal: AbortSignal.timeout(15_000),
  });
  const body = (await res.json().catch(() => ({}))) as { id?: string; message?: string };
  if (!res.ok) return { ok: false, provider: "resend", error: `HTTP ${res.status}: ${body.message ?? "błąd"}` };
  return { ok: true, provider: "resend", id: body.id };
}

type Transporter = { sendMail(m: Record<string, unknown>): Promise<{ messageId?: string }> };
let smtpTransport: Transporter | null = null;

async function sendSmtp(msg: EmailMessage): Promise<SendResult> {
  if (!process.env.SMTP_HOST) return { ok: false, provider: "smtp", error: "Brak SMTP_HOST" };
  if (!smtpTransport) {
    const nodemailer = await import("nodemailer");
    const port = Number(process.env.SMTP_PORT || 587);
    smtpTransport = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port,
      secure: process.env.SMTP_SECURE === "1" || port === 465,
      auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD ?? "" } : undefined,
    }) as unknown as Transporter;
  }
  const info = await smtpTransport.sendMail({
    from: from(),
    to: msg.to,
    subject: msg.subject,
    html: msg.html,
    text: msg.text,
    ...(process.env.EMAIL_REPLY_TO ? { replyTo: process.env.EMAIL_REPLY_TO } : {}),
  });
  return { ok: true, provider: "smtp", id: info.messageId };
}

/** Wysyła e-mail. Nie rzuca wyjątków – błąd zwraca w wyniku i loguje. */
export async function sendEmail(msg: EmailMessage): Promise<SendResult> {
  const provider = emailProvider();
  try {
    let r: SendResult;
    if (provider === "resend") r = await sendResend(msg);
    else if (provider === "smtp") r = await sendSmtp(msg);
    else {
      console.log(`[email] (EMAIL_PROVIDER=none) do ${maskEmail(msg.to)}: „${msg.subject}”`);
      return { ok: false, provider: "none", error: "Wysyłka wyłączona" };
    }
    if (!r.ok) console.warn(`[email] Nie wysłano do ${maskEmail(msg.to)} (${provider}): ${r.error}`);
    return r;
  } catch (e) {
    console.warn(`[email] Błąd wysyłki do ${maskEmail(msg.to)} (${provider}):`, (e as Error).message);
    return { ok: false, provider, error: (e as Error).message };
  }
}

export function appUrl(): string {
  return (process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "");
}
