import fs from "node:fs/promises";
import path from "node:path";
import { marked } from "marked";

const repoRoot = () => path.resolve(process.cwd(), "..");

/** Czyta markdown z repo (np. docs/regulamin.md). Zwraca HTML albo null, gdy pliku brak. */
export async function readRepoMarkdown(relPath: string): Promise<string | null> {
  try {
    const md = await fs.readFile(path.join(/*turbopackIgnore: true*/ repoRoot(), relPath), "utf8");
    return await marked.parse(md, { gfm: true });
  } catch {
    return null;
  }
}

/** Szuka pierwszego pliku .md w data/ (do 2 poziomów), którego nazwa zawiera fragment (np. „umowa”). */
export async function findDataMarkdown(fragment: string): Promise<string | null> {
  const dataDir = path.join(repoRoot(), "data");
  const walk = async (dir: string, depth: number): Promise<string | null> => {
    let entries: import("node:fs").Dirent[];
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      return null;
    }
    for (const e of entries.sort((a, b) => a.name.localeCompare(b.name))) {
      if (e.isFile() && e.name.endsWith(".md") && e.name.toLowerCase().includes(fragment)) return path.join(dir, e.name);
    }
    if (depth > 0) {
      for (const e of entries) if (e.isDirectory() && !["schema", "node_modules", "models"].includes(e.name) && !e.name.startsWith(".")) {
        const f = await walk(path.join(dir, e.name), depth - 1);
        if (f) return f;
      }
    }
    return null;
  };
  const file = await walk(dataDir, 2);
  if (!file) return null;
  return readRepoMarkdown(path.relative(repoRoot(), file));
}
