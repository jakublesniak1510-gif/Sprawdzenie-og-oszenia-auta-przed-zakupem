/**
 * Kasuje raporty (i powiązane opinie), którym minął termin 30 dni.
 * Uruchamiaj z crona, np. raz dziennie: `npm run cleanup`.
 */
import { deleteExpired, getDb } from "../lib/db";

const n = deleteExpired();
getDb().pragma("wal_checkpoint(TRUNCATE)");
console.log(`[cleanup] Usunięto wygasłych raportów: ${n}`);
