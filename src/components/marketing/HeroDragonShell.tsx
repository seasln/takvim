"use client";

/**
 * Vollflächiger Hintergrund: Poster als „Kinoleinwand“ mit Farbgrading,
 * Sonnen-Glow, Smaragd-Akzent (Drachenflossen), Vignette und feinem Grain —
 * Lesbarkeit für Glas-Karten bleibt im Zentrum erhalten.
 */
const NOISE_SVG = encodeURIComponent(
  `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 512 512'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='4' stitchTiles='stitch'/></filter><rect width='100%' height='100%' filter='url(#n)' opacity='0.5'/></svg>`,
);

export function HeroDragonShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex min-h-full flex-1 flex-col">
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden" aria-hidden>
        {/* Tiefes Burgunder — Farbraum des Posters */}
        <div className="absolute inset-0 bg-[#120506]" />

        {/* Poster: leicht gezoomt, langsamer Drift */}
        <div className="absolute inset-0 overflow-hidden">
          <div
            className="hero-dragon-photo absolute inset-[-10%] bg-cover bg-[center_30%] opacity-[0.52] sm:bg-[center_28%] sm:opacity-[0.48]"
            style={{
              backgroundImage: "url(/images/americandragon.jpg)",
            }}
          />
        </div>

        {/* Goldene „Sonne“ aus dem Motiv — weich, nicht zu hell (Kontrast fürs Formular) */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_72%_58%_at_50%_36%,rgba(255,210,120,0.18)_0%,rgba(200,90,40,0.06)_38%,transparent_62%)]" />

        {/* Farbton: mehr Karmin + Tiefe */}
        <div className="absolute inset-0 bg-[#3a0618]/35 mix-blend-multiply" />
        <div className="absolute inset-0 bg-[#1a0508]/25 mix-blend-color" />

        {/* Smaragd-Streifen unten — Anspielung auf die Rückenflossen */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_95%_42%_at_50%_108%,rgba(52,211,153,0.11)_0%,transparent_55%)]" />

        {/* Kino-Vignette: Fokus zur Mitte, Ränder für UI abgedunkelt */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_105%_90%_at_50%_42%,transparent_0%,rgba(8,2,4,0.4)_55%,rgba(5,1,3,0.92)_100%)]" />

        {/* Vertikale Lesbarkeit: oben/unten */}
        <div className="absolute inset-0 bg-gradient-to-b from-[#0a0406]/95 via-[#0c0b09]/25 to-[#080305]/96" />
        {/* Seiten für schmale Viewports / Karten */}
        <div className="absolute inset-0 bg-gradient-to-r from-[#0c0b09]/80 via-transparent to-[#0c0b09]/80" />

        {/* Dezentes Amber-Leuchten — Takvim-Akzent */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_55%_40%_at_50%_48%,rgba(240,160,70,0.07)_0%,transparent_60%)]" />

        {/* Filmkorn */}
        <div
          className="absolute inset-0 opacity-[0.045] mix-blend-overlay"
          style={{
            backgroundImage: `url("data:image/svg+xml,${NOISE_SVG}")`,
            backgroundRepeat: "repeat",
            backgroundSize: "256px 256px",
          }}
        />

        {/* Sehr feine „Promo“-Kante */}
        <div className="absolute inset-3 rounded-lg ring-1 ring-[#f0a046]/[0.09] sm:inset-5 sm:rounded-xl" />
        <div className="absolute inset-3 rounded-lg ring-1 ring-inset ring-black/40 sm:inset-5 sm:rounded-xl" />
      </div>
      <div className="relative z-0 flex flex-1 flex-col">{children}</div>
    </div>
  );
}
