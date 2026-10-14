/**
 * Sprzątanie (cron raz dziennie / co godzinę – w Dockerze robi to usługa `cron`):
 * - raporty (i opinie) starsze niż 30 dni,
 * - katalogi zdjęć starsze niż 48 h (np. nieopłacone zamówienia),
 * - stare identyfikatory zdarzeń Stripe (30 dni) i zdarzenia analityczne (400 dni),
 * - e-maile kupujących z kuponów wygasłych / wyczerpanych / starszych niż 30 dni,
 * - VACUUM bazy raz w tygodniu (secure_delete=ON nadpisuje usunięte dane na bieżąco).
 * Uruchom: `npm run cleanup`.
 */
import { deleteOldEvents } from "../lib/analytics";
import { deleteExpired, deleteOldStripeEvents, getDb, scrubCouponEmails, vacuumIfDue } from "../lib/db";
import { IMAGE_MAX_AGE_HOURS, cleanupImages } from "../lib/image-cache";

function main() {
  const reports = deleteExpired();
  const images = cleanupImages(IMAGE_MAX_AGE_HOURS);
  const stripe = deleteOldStripeEvents(30);
  const events = deleteOldEvents(400);
  const emails = scrubCouponEmails();
  const vacuum = vacuumIfDue(7);
  getDb().pragma("wal_checkpoint(TRUNCATE)");
  console.log(
    `[cleanup] Usunięto: raporty ${reports}, katalogi zdjęć ${images}, zdarzenia Stripe ${stripe}, zdarzenia analityczne ${events}, e-maile z kuponów ${emails}${vacuum ? "; VACUUM wykonany" : ""}.`,
  );
}

main();
