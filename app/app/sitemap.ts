import type { MetadataRoute } from "next";
import { loadPosts } from "@/components/content/blog";
import { baseUrl } from "@/components/site/config";
import { loadModels } from "@/lib/models";

// Odświeżana co godzinę – nowe modele i artykuły trafiają do mapy bez przebudowy.
export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = baseUrl();
  const now = new Date();
  const [models, posts] = await Promise.all([loadModels(), loadPosts()]);
  const statics: [string, number, MetadataRoute.Sitemap[number]["changeFrequency"]][] = [
    ["", 1, "weekly"],
    ["/szybki-test", 0.9, "monthly"],
    ["/sprawdz", 0.8, "monthly"],
    ["/przyklad", 0.7, "monthly"],
    ["/usterki", 0.8, "weekly"],
    ["/blog", 0.6, "weekly"],
    ["/checklista", 0.6, "monthly"],
    ["/pakiet", 0.5, "monthly"],
    ["/zastrzezenia", 0.3, "yearly"],
    ["/regulamin", 0.2, "yearly"],
    ["/polityka-prywatnosci", 0.2, "yearly"],
  ];
  return [
    ...statics.map(([p, priority, changeFrequency]) => ({ url: `${base}${p}`, lastModified: now, changeFrequency, priority })),
    ...models.map((m) => ({ url: `${base}/usterki/${m.id}`, lastModified: now, changeFrequency: "monthly" as const, priority: 0.7 })),
    ...posts.map((p) => ({
      url: `${base}/blog/${p.slug}`,
      lastModified: Number.isFinite(Date.parse(p.date)) ? new Date(p.date) : now,
      changeFrequency: "monthly" as const,
      priority: 0.6,
    })),
  ];
}
