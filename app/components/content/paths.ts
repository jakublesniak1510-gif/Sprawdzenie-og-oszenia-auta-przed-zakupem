import path from "node:path";

/** Katalog `content/` w korzeniu repo (treści marketingowe, blog, przykładowy raport). */
export function contentDir(): string {
  return process.env.CONTENT_DIR ? path.resolve(process.env.CONTENT_DIR) : path.resolve(/*turbopackIgnore: true*/ process.cwd(), "..", "content");
}

export function contentPath(...parts: string[]): string {
  return path.join(/*turbopackIgnore: true*/ contentDir(), ...parts);
}
