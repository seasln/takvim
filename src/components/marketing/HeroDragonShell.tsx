"use client";

/**
 * Vollflächiger Hintergrund für Marketing & Auth: Poster + Vignette,
 * angepasst an Takvim (tiefes Rot-Schwarz, Amber-Akzent).
 */
export function HeroDragonShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex min-h-full flex-1 flex-col">
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden" aria-hidden>
        <div className="absolute inset-0 bg-[#100706]" />
        <div
          className="absolute inset-0 bg-cover bg-[center_28%] opacity-[0.42] mix-blend-normal sm:bg-[center_25%]"
          style={{
            backgroundImage: "url(/images/americandragon.jpg)",
          }}
        />
        {/* Warmes „Drachenfeuer“ in der Mitte, zu den Rändern abgedunkelt */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_85%_65%_at_50%_42%,rgba(240,160,70,0.14)_0%,transparent_55%)]" />
        <div className="absolute inset-0 bg-gradient-to-b from-[#0c0b09]/95 via-[#0c0b09]/55 to-[#0c0b09]/98" />
        <div className="absolute inset-0 bg-gradient-to-r from-[#0c0b09]/90 via-transparent to-[#0c0b09]/90" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0c0b09] via-transparent to-[#0c0b09]/80" />
      </div>
      <div className="relative z-0 flex flex-1 flex-col">{children}</div>
    </div>
  );
}
