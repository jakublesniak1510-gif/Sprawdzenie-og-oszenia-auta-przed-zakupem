import { ImageResponse } from "next/og";
import { OgCard } from "@/components/site/OgCard";
import { shortGeneration } from "@/components/site/config";
import { getModel } from "@/lib/models";

export const alt = "Typowe usterki modelu – na co uważać przy zakupie";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const revalidate = 3600;

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const m = await getModel((await params).slug);
  const name = m ? `${m.make} ${m.model} ${shortGeneration(m.generation)}` : "Używane auto";
  return new ImageResponse(
    <OgCard eyebrow="Typowe usterki i na co uważać przy zakupie" title={name} subtitle="Silniki · koszty napraw · co sprawdzić na oględzinach" />,
    size,
  );
}
