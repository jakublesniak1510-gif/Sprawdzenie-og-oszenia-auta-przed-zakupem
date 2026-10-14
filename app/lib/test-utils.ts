import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { resetDbForTests } from "./db";

/** Tylko do testów: świeża baza SQLite w katalogu tymczasowym (ustawia DATABASE_PATH). */
export function useTempDb(): string {
  resetDbForTests();
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "sprawdz-test-"));
  const file = path.join(dir, "app.db");
  process.env.DATABASE_PATH = file;
  return file;
}

export function tempDir(prefix = "sprawdz-test-"): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}
