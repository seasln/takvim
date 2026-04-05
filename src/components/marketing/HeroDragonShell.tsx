"use client";

/**
 * Marketing & Auth only: Poster + grading + stacked animated white-noise (screen / soft-light).
 * Kalender nach Login nutzt diese Shell nicht.
 */
function noiseDataUrl(baseFrequency: string, octaves: string): string {
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 256 256'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='${baseFrequency}' numOctaves='${octaves}' stitchTiles='stitch'/></filter><rect width='100%' height='100%' filter='url(#n)'/></svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}

const NOISE_FINE = noiseDataUrl("0.9", "4");
const NOISE_COARSE = noiseDataUrl("0.38", "3");

export function HeroDragonShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex min-h-full flex-1 flex-col">
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden" aria-hidden>
        <div className="absolute inset-0 bg-[#120506]" />

        <div className="absolute inset-0 overflow-hidden">
          <div
            className="hero-dragon-photo absolute inset-[-10%] bg-cover bg-[center_30%] opacity-[0.52] sm:bg-[center_28%] sm:opacity-[0.48]"
            style={{
              backgroundImage: "url(/images/americandragon.jpg)",
            }}
          />
        </div>

        <div className="absolute inset-0 bg-[radial-gradient(ellipse_72%_58%_at_50%_36%,rgba(255,210,120,0.18)_0%,rgba(200,90,40,0.06)_38%,transparent_62%)]" />

        <div className="absolute inset-0 bg-[#3a0618]/35 mix-blend-multiply" />
        <div className="absolute inset-0 bg-[#1a0508]/25 mix-blend-color" />

        <div className="absolute inset-0 bg-[radial-gradient(ellipse_95%_42%_at_50%_108%,rgba(52,211,153,0.11)_0%,transparent_55%)]" />

        <div className="absolute inset-0 bg-[radial-gradient(ellipse_105%_90%_at_50%_42%,transparent_0%,rgba(8,2,4,0.4)_55%,rgba(5,1,3,0.92)_100%)]" />

        <div className="absolute inset-0 bg-gradient-to-b from-[#0a0406]/95 via-[#0c0b09]/25 to-[#080305]/96" />
        <div className="absolute inset-0 bg-gradient-to-r from-[#0c0b09]/80 via-transparent to-[#0c0b09]/80" />

        <div className="absolute inset-0 bg-[radial-gradient(ellipse_55%_40%_at_50%_48%,rgba(240,160,70,0.07)_0%,transparent_60%)]" />

        {/* White-noise stack: hellere Körnung + groberes „Rauschen“, leicht gegeneinander verschoben */}
        <div
          className="hero-dragon-noise-fine absolute inset-0 opacity-[0.14] mix-blend-screen"
          style={{
            backgroundImage: NOISE_FINE,
            backgroundRepeat: "repeat",
            backgroundSize: "128px 128px",
          }}
        />
        <div
          className="hero-dragon-noise-coarse absolute inset-[-5%] opacity-[0.11] mix-blend-soft-light"
          style={{
            backgroundImage: NOISE_COARSE,
            backgroundRepeat: "repeat",
            backgroundSize: "256px 256px",
          }}
        />
        {/* Hochfrequente „Schnee“-Spur — kaum bewegt, nur Textur */}
        <div
          className="absolute inset-0 opacity-[0.06] mix-blend-overlay contrast-125"
          style={{
            backgroundImage: NOISE_FINE,
            backgroundRepeat: "repeat",
            backgroundSize: "64px 64px",
          }}
        />
      </div>
      <div className="relative z-0 flex flex-1 flex-col">{children}</div>
    </div>
  );
}
