import type { Metadata } from "next";
import { MarkdownPage } from "@/components/MarkdownPage";
import { readRepoMarkdown } from "@/lib/markdown";

export const metadata: Metadata = { title: "Regulamin", alternates: { canonical: "/regulamin" } };
export const revalidate = 3600;

export default async function Regulamin() {
  return (
    <MarkdownPage
      html={await readRepoMarkdown("docs/regulamin.md")}
      fallbackTitle="Regulamin"
      fallbackText="Regulamin jest w przygotowaniu i pojawi się tu wkrótce."
    />
  );
}
