/**
 * Minimalny parser frontmattera YAML (podzbiór): `klucz: wartość`, listy `[a, b]` i listy blokowe `- a`.
 * Bez zależności – wystarcza do plików content/blog/*.md.
 */
export type FrontValue = string | string[];

function unquote(s: string): string {
  const t = s.trim();
  if ((t.startsWith('"') && t.endsWith('"')) || (t.startsWith("'") && t.endsWith("'"))) return t.slice(1, -1);
  return t;
}

export function parseFrontmatter(src: string): { data: Record<string, FrontValue>; body: string } {
  const text = src.replace(/^﻿/, "");
  const m = /^---\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/.exec(text);
  if (!m) return { data: {}, body: text };
  const data: Record<string, FrontValue> = {};
  let currentList: string | null = null;
  for (const line of m[1].split(/\r?\n/)) {
    if (!line.trim() || line.trim().startsWith("#")) continue;
    const item = /^\s*-\s+(.*)$/.exec(line);
    if (item && currentList) {
      (data[currentList] as string[]).push(unquote(item[1]));
      continue;
    }
    const kv = /^([A-Za-z0-9_-]+)\s*:\s*(.*)$/.exec(line);
    if (!kv) continue;
    const [, key, rawVal] = kv;
    const val = rawVal.trim();
    if (val === "") {
      data[key] = [];
      currentList = key;
    } else if (val.startsWith("[") && val.endsWith("]")) {
      data[key] = val
        .slice(1, -1)
        .split(",")
        .map(unquote)
        .filter(Boolean);
      currentList = null;
    } else {
      data[key] = unquote(val);
      currentList = null;
    }
  }
  return { data, body: text.slice(m[0].length) };
}

export const asString = (v: FrontValue | undefined): string => (Array.isArray(v) ? v.join(", ") : (v ?? ""));
export const asList = (v: FrontValue | undefined): string[] =>
  Array.isArray(v) ? v : v ? v.split(",").map((s) => s.trim()).filter(Boolean) : [];
