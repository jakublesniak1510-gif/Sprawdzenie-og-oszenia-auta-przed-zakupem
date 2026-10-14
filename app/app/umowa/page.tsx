import type { Metadata } from "next";
import { MarkdownPage } from "@/components/MarkdownPage";
import { PrintButton } from "@/components/report/PrintButton";
import { findDataMarkdown } from "@/lib/markdown";

export const metadata: Metadata = { title: "Wzór umowy kupna-sprzedaży", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function Umowa() {
  const html = await findDataMarkdown("umowa");
  return (
    <div className="space-y-3">
      {html && (
        <div className="flex justify-end">
          <PrintButton label="Drukuj umowę" />
        </div>
      )}
      <MarkdownPage html={html} fallbackTitle="Wzór umowy kupna-sprzedaży" fallbackText="Wzór umowy jest w przygotowaniu." />
    </div>
  );
}
