import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { JsonLd } from "@/components/JsonLd";
import { formatDatePl, getPost, loadPosts, renderPostHtml } from "@/components/content/blog";
import { SITE_NAME, baseUrl, shortGeneration } from "@/components/site/config";
import { loadModels } from "@/lib/models";

export const revalidate = 3600;
export const dynamicParams = true; // nowe pliki w content/blog działają bez przebudowy

export async function generateStaticParams() {
  return (await loadPosts()).map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const p = await getPost((await params).slug);
  if (!p) return { title: "Nie znaleziono" };
  return {
    title: p.title,
    description: p.description || undefined,
    keywords: p.keywords.length ? p.keywords : undefined,
    alternates: { canonical: `/blog/${p.slug}` },
    openGraph: { type: "article", title: p.title, description: p.description || undefined, publishedTime: p.date || undefined },
  };
}

export default async function BlogPostPage({ params }: { params: Promise<{ slug: string }> }) {
  const post = await getPost((await params).slug);
  if (!post) notFound();
  const [html, models] = await Promise.all([renderPostHtml(post), loadModels()]);
  const linked = post.models.map((id) => models.find((m) => m.id === id)).filter((m): m is NonNullable<typeof m> => !!m);

  return (
    <article className="space-y-5">
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "Article",
          headline: post.title,
          description: post.description || undefined,
          datePublished: post.date || undefined,
          inLanguage: "pl-PL",
          mainEntityOfPage: `${baseUrl()}/blog/${post.slug}`,
          publisher: { "@type": "Organization", name: SITE_NAME },
          keywords: post.keywords.join(", ") || undefined,
        }}
      />
      <header className="space-y-2">
        <p className="text-sm text-slate-600">
          <Link href="/blog" className="underline">
            Blog
          </Link>
          {post.date && (
            <>
              {" · "}
              <time dateTime={post.date}>{formatDatePl(post.date)}</time>
            </>
          )}
        </p>
        <h1 className="text-2xl font-extrabold leading-tight text-brand-900 sm:text-3xl">{post.title}</h1>
        {post.description && <p className="text-lg text-slate-700">{post.description}</p>}
      </header>

      <div className="prose-md overflow-x-auto rounded-2xl bg-white p-4 shadow-sm sm:p-6" dangerouslySetInnerHTML={{ __html: html }} />

      <section className="space-y-3 rounded-2xl bg-brand-900 p-5 text-white">
        <h2 className="text-xl font-extrabold">Masz konkretne ogłoszenie?</h2>
        <p className="text-brand-100">Wklej je do darmowego szybkiego testu – w kilka sekund zobaczysz, o co zapytać sprzedawcę.</p>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Link href="/szybki-test" className="rounded-xl bg-white px-5 py-3 text-center font-bold text-brand-900 hover:bg-brand-50">
            Darmowy szybki test
          </Link>
          <Link href="/sprawdz" className="rounded-xl border-2 border-white px-5 py-3 text-center font-bold text-white hover:bg-white/10">
            Pełny raport 19 zł
          </Link>
        </div>
      </section>

      {linked.length > 0 && (
        <section className="rounded-2xl bg-white p-4 shadow-sm sm:p-5">
          <h2 className="mb-2 text-lg font-bold">Typowe usterki modeli z artykułu</h2>
          <ul className="grid gap-2 sm:grid-cols-2">
            {linked.map((m) => (
              <li key={m.id}>
                <Link href={`/usterki/${m.id}`} className="block rounded-xl border border-slate-200 p-3 font-semibold text-brand-700 hover:bg-brand-50">
                  {m.make} {m.model} {shortGeneration(m.generation)} – usterki →
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </article>
  );
}
