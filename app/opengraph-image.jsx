import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "Le Pouls du Monde — Carte de l’actualité mondiale";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    <div style={{ height: "100%", width: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: "74px", color: "#effafa", background: "radial-gradient(circle at 16% 25%, #236f70 0, transparent 27%), radial-gradient(circle at 79% 60%, #1f496e 0, transparent 31%), #051117" }}>
      <div style={{ display: "flex", color: "#72dfcf", fontSize: 25, fontWeight: 700, letterSpacing: 5 }}>OBSERVATOIRE VISUEL</div>
      <div style={{ display: "flex", flexDirection: "column" }}>
        <div style={{ display: "flex", fontSize: 82, fontWeight: 800, letterSpacing: -4 }}>Le Pouls du Monde</div>
        <div style={{ display: "flex", marginTop: 20, maxWidth: 850, color: "#b7d0d2", fontSize: 32 }}>Les actualités prennent place sur la carte.</div>
      </div>
      <div style={{ display: "flex", color: "#76dccc", fontSize: 23 }}>Sources publiques · Localisation prudente · Méthode transparente</div>
    </div>,
    size,
  );
}
