/**
 * E-maile przypominające (cron co godzinę):
 * - „nie dokończono płatności” – 2–40 h po utworzeniu nieopłaconego zamówienia (jeśli klient podał e-mail, sesja Stripe
 *   nie jest w toku, e-mail w Stripe się zgadza i adres nie dostał przypomnienia w ciągu 24 h),
 * - „czy kupiłeś?” – 7 dni po wygenerowaniu raportu, jeśli nie było opinii.
 * Każdy e-mail najwyżej raz na raport. Wymaga EMAIL_PROVIDER=resend|smtp (przy `none` tylko loguje).
 * Uruchom: `npm run followup`.
 */
import { runFollowups } from "../lib/notifications";

async function main() {
  const r = await runFollowups();
  console.log(
    `[followup] Wysłano: przypomnienia o płatności ${r.payment}, prośby o opinię ${r.feedback}, nieudane ${r.failed}, pominięte (płatność w toku / inny e-mail / limit) ${r.skipped}.`,
  );
}

main().catch((e) => {
  console.error("[followup] Błąd:", e);
  process.exit(1);
});
