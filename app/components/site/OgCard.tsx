/** Wspólny wygląd obrazków Open Graph (ImageResponse – tylko style inline i flexbox). */
export function OgCard({ eyebrow, title, subtitle }: { eyebrow: string; title: string; subtitle: string }) {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: "64px 72px",
        background: "linear-gradient(135deg, #172554 0%, #1e40af 100%)",
        color: "#ffffff",
        fontFamily: "sans-serif",
      }}
    >
      <div style={{ display: "flex", fontSize: 34, fontWeight: 700 }}>
        <span>Sprawdź</span>
        <span style={{ color: "#93c5fd" }}>Ogłoszenie</span>
      </div>
      <div style={{ display: "flex", flexDirection: "column" }}>
        <div style={{ fontSize: 30, color: "#bfdbfe", marginBottom: 16 }}>{eyebrow}</div>
        <div style={{ fontSize: title.length > 40 ? 60 : 72, fontWeight: 800, lineHeight: 1.1 }}>{title}</div>
      </div>
      <div style={{ display: "flex", fontSize: 28, color: "#dbeafe" }}>{subtitle}</div>
    </div>
  );
}
