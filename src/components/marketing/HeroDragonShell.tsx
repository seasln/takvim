"use client";

/**
 * Ruhiger, flächiger Hintergrund für Marketing & Auth — weiche Verläufe,
 * kein Foto (weniger visuelle Last als starkes Poster).
 */
export function HeroDragonShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex min-h-full flex-1 flex-col">
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden" aria-hidden>
        <div className="absolute inset-0 bg-[#0b0d11]" />
        <div className="absolute inset-0 bg-gradient-to-b from-[#10141c] via-[#0c0e12] to-[#090a0c]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_120%_90%_at_50%_-30%,rgba(90,110,140,0.22),transparent_55%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_55%_at_0%_100%,rgba(45,65,88,0.2),transparent_50%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_50%_at_100%_85%,rgba(120,95,70,0.1),transparent_48%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_50%_40%_at_70%_30%,rgba(240,160,70,0.06),transparent_42%)]" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#080809]/95 via-transparent to-[#0c0b09]/75" />
      </div>
      <div className="relative z-0 flex flex-1 flex-col">{children}</div>
    </div>
  );
}
