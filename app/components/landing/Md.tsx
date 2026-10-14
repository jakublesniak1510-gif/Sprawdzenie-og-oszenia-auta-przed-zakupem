import { inlineHtml } from "@/components/content/landing-parse";

/** Tekst z markdown inline (pogrubienia, linki) – treści z repo, zaufane. */
export function Md({ text, as: Tag = "span", className }: { text: string; as?: "span" | "p" | "div"; className?: string }) {
  return <Tag className={className} dangerouslySetInnerHTML={{ __html: inlineHtml(text) }} />;
}
