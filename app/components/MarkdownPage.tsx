export function MarkdownPage({ html, fallbackTitle, fallbackText }: { html: string | null; fallbackTitle: string; fallbackText: string }) {
  if (!html) {
    return (
      <div className="space-y-3">
        <h1 className="text-2xl font-extrabold">{fallbackTitle}</h1>
        <p className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-amber-900">{fallbackText}</p>
      </div>
    );
  }
  return <div className="prose-md rounded-2xl bg-white p-4 shadow-sm sm:p-6" dangerouslySetInnerHTML={{ __html: html }} />;
}
