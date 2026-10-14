import { ImageResponse } from "next/og";
import { OgCard } from "@/components/site/OgCard";

export const alt = "SprawdźOgłoszenie – sprawdź ogłoszenie auta przed zakupem";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    <OgCard
      eyebrow="Zanim pojedziesz oglądać auto"
      title="Sprawdź ogłoszenie auta przed zakupem"
      subtitle="Czerwone flagi · typowe usterki · pytania do sprzedawcy · szybki test za darmo"
    />,
    size,
  );
}
