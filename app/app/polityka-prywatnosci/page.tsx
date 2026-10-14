import type { Metadata } from "next";
import { MarkdownPage } from "@/components/MarkdownPage";
import { readRepoMarkdown } from "@/lib/markdown";

export const metadata: Metadata = { title: "Polityka prywatności" };
export const revalidate = 3600;

export default async function PolitykaPrywatnosci() {
  return (
    <MarkdownPage
      html={await readRepoMarkdown("docs/polityka-prywatnosci.md")}
      fallbackTitle="Polityka prywatności"
      fallbackText="Polityka prywatności jest w przygotowaniu i pojawi się tu wkrótce."
    />
  );
}
